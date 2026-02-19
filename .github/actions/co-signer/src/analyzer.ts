import Anthropic from "@anthropic-ai/sdk";
import * as core from "@actions/core";
import picomatch from "picomatch";
import { PRContext } from "./context";

export interface Config {
  guardrails: {
    never_approve_paths: string[];
    always_low_risk_paths: string[];
    never_approve_dependency_paths: string[];
  };
  thresholds: {
    auto_approve_max_risk: number;
    max_files_changed: number;
    max_lines_changed: number;
  };
  claude: {
    provider: string;
    model: string;
  };
}

export interface RiskAssessment {
  risk_score: number;
  risk_tier: string;
  reasoning: string;
  blast_radius: {
    files_affected: number;
    modules_affected: string[];
    owners_affected: string[];
    has_cross_module_impact: boolean;
  };
  concerns: string[];
  quality_flags: {
    missing_tests: boolean;
    security_concerns: boolean;
    unrelated_changes: boolean;
    anti_patterns: string[];
  };
}

export type Decision = "approve" | "abstain";

export interface GuardrailResult {
  triggered: boolean;
  decision: Decision;
  reason: string;
  guardrail: string | null;
}

export function checkGuardrails(
  changedFiles: string[],
  config: Config,
  linesChanged = 0,
): GuardrailResult {
  if (changedFiles.length > config.thresholds.max_files_changed) {
    return {
      triggered: true,
      decision: "abstain",
      reason: `PR changes ${changedFiles.length} files (max: ${config.thresholds.max_files_changed})`,
      guardrail: "max_files_changed",
    };
  }

  if (linesChanged > config.thresholds.max_lines_changed) {
    return {
      triggered: true,
      decision: "abstain",
      reason: `PR changes ${linesChanged} lines (max: ${config.thresholds.max_lines_changed})`,
      guardrail: "max_lines_changed",
    };
  }

  for (const file of changedFiles) {
    if (picomatch.isMatch(file, config.guardrails.never_approve_paths)) {
      return {
        triggered: true,
        decision: "abstain",
        reason: `File "${file}" matches a never-approve path`,
        guardrail: "never_approve_paths",
      };
    }
  }

  for (const file of changedFiles) {
    if (
      picomatch.isMatch(file, config.guardrails.never_approve_dependency_paths)
    ) {
      return {
        triggered: true,
        decision: "abstain",
        reason: `File "${file}" is a dependency/lockfile change`,
        guardrail: "never_approve_dependency_paths",
      };
    }
  }

  if (changedFiles.length > 0) {
    const allLowRisk = changedFiles.every((file) =>
      picomatch.isMatch(file, config.guardrails.always_low_risk_paths),
    );
    if (allLowRisk) {
      return {
        triggered: true,
        decision: "approve",
        reason: "All changed files match always-low-risk paths",
        guardrail: "always_low_risk_paths",
      };
    }
  }

  return { triggered: false, decision: "abstain", reason: "", guardrail: null };
}

export function makeDecision(riskScore: number, threshold: number): Decision {
  return riskScore <= threshold ? "approve" : "abstain";
}

const VALID_TIERS = ["very low", "low", "medium", "high", "critical"];

export function validateAssessment(data: unknown): RiskAssessment | null {
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;

  if (
    typeof d.risk_score !== "number" ||
    !Number.isInteger(d.risk_score) ||
    d.risk_score < 1 ||
    d.risk_score > 10
  ) {
    return null;
  }

  if (typeof d.risk_tier !== "string" || !VALID_TIERS.includes(d.risk_tier)) {
    return null;
  }

  if (typeof d.reasoning !== "string" || d.reasoning.length === 0) return null;

  if (!d.blast_radius || typeof d.blast_radius !== "object") return null;
  const br = d.blast_radius as Record<string, unknown>;
  if (typeof br.files_affected !== "number") return null;
  if (!Array.isArray(br.modules_affected)) return null;
  if (!Array.isArray(br.owners_affected)) return null;
  if (typeof br.has_cross_module_impact !== "boolean") return null;

  if (!Array.isArray(d.concerns)) return null;

  // quality_flags is required in the schema but we validate gracefully
  if (d.quality_flags && typeof d.quality_flags === "object") {
    const qf = d.quality_flags as Record<string, unknown>;
    if (typeof qf.missing_tests !== "boolean") return null;
    if (typeof qf.security_concerns !== "boolean") return null;
    if (typeof qf.unrelated_changes !== "boolean") return null;
    if (!Array.isArray(qf.anti_patterns)) return null;
  }

  return d as unknown as RiskAssessment;
}

export async function assessRisk(
  context: PRContext,
  config: Config,
  systemPrompt: string,
  apiKey: string,
): Promise<{ assessment: RiskAssessment | null; latencyMs: number }> {
  const client = new Anthropic({ apiKey });

  const userMessage = buildUserMessage(context);

  const startTime = Date.now();

  try {
    const response = await client.messages.create({
      model: config.claude.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const latencyMs = Date.now() - startTime;

    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      core.warning("Claude returned no text content");
      return { assessment: null, latencyMs };
    }

    const jsonStr = text.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "");

    try {
      const parsed = JSON.parse(jsonStr);
      const validated = validateAssessment(parsed);
      if (!validated) {
        core.warning(`Claude response failed schema validation: ${jsonStr}`);
      }
      return { assessment: validated, latencyMs };
    } catch {
      core.warning(`Failed to parse Claude response as JSON: ${text}`);
      return { assessment: null, latencyMs };
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    core.warning(`Claude API call failed: ${error}`);
    return { assessment: null, latencyMs };
  }
}

function buildUserMessage(context: PRContext): string {
  const modules = [
    ...new Set(
      context.changedFiles.map((f) => {
        const parts = f.split("/");
        return parts.length > 1 ? parts.slice(0, 2).join("/") : parts[0];
      }),
    ),
  ];

  return `## PR Metadata
- **Title:** ${context.pr.title}
- **Author:** ${context.pr.author}
- **Base branch:** ${context.pr.baseBranch}
- **Labels:** ${context.pr.labels.join(", ") || "none"}
- **Lines changed:** ${context.linesChanged}
- **Description:** ${context.pr.description || "No description provided"}

## Changed Files (${context.changedFiles.length})
${context.changedFiles.map((f) => `- ${f}`).join("\n")}

## Detected Modules
${modules.map((m) => `- ${m}`).join("\n")}

## Affected Code Owners
${context.affectedOwners.map((o) => `- ${o}`).join("\n") || "No CODEOWNERS mapping found"}

## Diff
\`\`\`diff
${context.diff.slice(0, 100_000)}
\`\`\`
${context.diff.length > 100_000 ? `\n(Diff truncated — ${context.diff.length} chars total, showing first 100,000)` : ""}

Analyze this PR and return your risk assessment as a JSON object.`;
}
