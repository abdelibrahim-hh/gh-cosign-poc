import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { assembleContext } from "./context";
import {
  checkGuardrails,
  assessRisk,
  makeDecision,
  Config,
  RiskAssessment,
  Decision,
} from "./analyzer";
import {
  postComment,
  submitReview,
  dismissReview,
  findBotReview,
  getPRHeadSha,
} from "./github";

interface TelemetryEvent {
  event: string;
  pr_number: number;
  risk_score: number | null;
  risk_tier: string | null;
  decision: Decision | "error";
  guardrail_triggered: string | null;
  files_changed: number;
  modules_affected: string[];
  owners_affected: string[];
  claude_latency_ms: number | null;
  total_latency_ms: number;
  timestamp: string;
}

function loadConfig(workspacePath: string): Config {
  const configPath = path.join(
    workspacePath,
    ".github",
    "co-signer",
    "config.yml",
  );
  const raw = fs.readFileSync(configPath, "utf-8");
  return yaml.load(raw) as Config;
}

function loadSystemPrompt(workspacePath: string): string {
  const promptPath = path.join(
    workspacePath,
    ".github",
    "co-signer",
    "risk-assessment-prompt.txt",
  );
  return fs.readFileSync(promptPath, "utf-8");
}

function formatRiskComment(
  assessment: RiskAssessment,
  decision: Decision,
): string {
  const decisionText =
    decision === "approve"
      ? "AUTO-APPROVED\nThis PR has been approved as a low-risk change. One human review is still required per branch protection rules."
      : "MANUAL REVIEW REQUIRED\nThis PR's risk score exceeds the auto-approval threshold. Full human review is required.";

  return `## Co-Signer Risk Assessment

**Risk Score:** ${assessment.risk_score}/10 (${assessment.risk_tier})

### Blast Radius
- **Files changed:** ${assessment.blast_radius.files_affected}
- **Modules affected:** ${assessment.blast_radius.modules_affected.join(", ") || "none"}
- **Owners affected:** ${assessment.blast_radius.owners_affected.join(", ") || "none"}
- **Cross-module impact:** ${assessment.blast_radius.has_cross_module_impact ? "Yes" : "No"}

### Reasoning
${assessment.reasoning}

${assessment.concerns.length > 0 ? `### Concerns\n${assessment.concerns.map((c) => `- ${c}`).join("\n")}` : ""}

### Decision: ${decisionText}`;
}

function formatGuardrailComment(
  decision: Decision,
  reason: string,
  guardrail: string,
  filesChanged: number,
): string {
  const decisionText =
    decision === "approve"
      ? "AUTO-APPROVED (guardrail)\nAll changed files match low-risk paths. No AI assessment needed."
      : "MANUAL REVIEW REQUIRED (guardrail)\nA guardrail rule requires human review for this PR.";

  return `## Co-Signer Risk Assessment

**Guardrail triggered:** \`${guardrail}\`
**Files changed:** ${filesChanged}

### Reason
${reason}

### Decision: ${decisionText}`;
}

function formatRevocationComment(
  oldScore: number,
  assessment: RiskAssessment,
): string {
  return `## Co-Signer Approval Revoked

Previous approval was for risk score ${oldScore}/10.
After new commits, risk score is now **${assessment.risk_score}/10** (${assessment.risk_tier}).

**Reason:** ${assessment.reasoning}

This PR now requires human review.`;
}

function formatErrorComment(): string {
  return `## Co-Signer Risk Assessment

**Status:** Assessment unavailable

Risk assessment could not be completed due to an internal error.
Manual review is required.`;
}

async function run(): Promise<void> {
  const totalStart = Date.now();

  const githubToken = core.getInput("github-token", { required: true });
  const anthropicApiKey = core.getInput("anthropic-api-key", {
    required: true,
  });
  const prNumber = parseInt(core.getInput("pr-number", { required: true }), 10);

  if (isNaN(prNumber) || prNumber <= 0) {
    core.setFailed(`Invalid PR number: ${core.getInput("pr-number")}`);
    return;
  }

  const workspacePath = process.env.GITHUB_WORKSPACE ?? process.cwd();
  const octokit = github.getOctokit(githubToken);
  const [owner, repo] = (
    process.env.GITHUB_REPOSITORY ?? "owner/repo"
  ).split("/");

  let telemetry: Partial<TelemetryEvent> = {
    event: "co-signer-assessment",
    pr_number: prNumber,
    timestamp: new Date().toISOString(),
  };

  try {
    const config = loadConfig(workspacePath);
    const systemPrompt = loadSystemPrompt(workspacePath);

    const context = await assembleContext(octokit, owner, repo, prNumber);
    telemetry.files_changed = context.changedFiles.length;
    telemetry.owners_affected = context.affectedOwners;

    const guardrailResult = checkGuardrails(context.changedFiles, config);

    if (guardrailResult.triggered) {
      telemetry.guardrail_triggered = guardrailResult.guardrail;
      telemetry.decision = guardrailResult.decision;
      telemetry.risk_score = null;
      telemetry.risk_tier = null;
      telemetry.claude_latency_ms = null;
      telemetry.modules_affected = [];

      const comment = formatGuardrailComment(
        guardrailResult.decision,
        guardrailResult.reason,
        guardrailResult.guardrail!,
        context.changedFiles.length,
      );

      await postComment(octokit, owner, repo, prNumber, comment);

      if (guardrailResult.decision === "approve") {
        await submitReview(
          octokit,
          owner,
          repo,
          prNumber,
          "APPROVE",
          `Co-Signer: Auto-approved (guardrail: ${guardrailResult.guardrail})`,
        );
      }

      telemetry.total_latency_ms = Date.now() - totalStart;
      core.info(JSON.stringify(telemetry));
      return;
    }

    const { assessment, latencyMs } = await assessRisk(
      context,
      config,
      systemPrompt,
      anthropicApiKey,
    );

    telemetry.claude_latency_ms = latencyMs;
    telemetry.guardrail_triggered = null;

    if (!assessment) {
      telemetry.decision = "abstain";
      telemetry.risk_score = null;
      telemetry.risk_tier = null;
      telemetry.modules_affected = [];

      await postComment(
        octokit,
        owner,
        repo,
        prNumber,
        formatErrorComment(),
      );

      telemetry.total_latency_ms = Date.now() - totalStart;
      core.info(JSON.stringify(telemetry));
      core.warning(
        "Risk assessment unavailable — defaulting to abstain (manual review required)",
      );
      return;
    }

    const currentHeadSha = await getPRHeadSha(octokit, owner, repo, prNumber);
    if (currentHeadSha !== context.pr.headSha) {
      core.info(
        `Stale evaluation detected (started with ${context.pr.headSha}, now ${currentHeadSha}). Discarding.`,
      );
      return;
    }

    const decision = makeDecision(
      assessment.risk_score,
      config.thresholds.auto_approve_max_risk,
    );

    telemetry.risk_score = assessment.risk_score;
    telemetry.risk_tier = assessment.risk_tier;
    telemetry.decision = decision;
    telemetry.modules_affected = assessment.blast_radius.modules_affected;

    const priorReview = await findBotReview(octokit, owner, repo, prNumber);
    if (priorReview && decision === "abstain") {
      await dismissReview(
        octokit,
        owner,
        repo,
        prNumber,
        priorReview.id,
        `Risk escalated to ${assessment.risk_score}/10`,
      );

      const revocationComment = formatRevocationComment(
        priorReview.risk_score ?? 0,
        assessment,
      );
      await postComment(octokit, owner, repo, prNumber, revocationComment);

      telemetry.total_latency_ms = Date.now() - totalStart;
      core.info(JSON.stringify(telemetry));
      return;
    }

    const comment = formatRiskComment(assessment, decision);
    await postComment(octokit, owner, repo, prNumber, comment);

    if (decision === "approve") {
      await submitReview(
        octokit,
        owner,
        repo,
        prNumber,
        "APPROVE",
        `Co-Signer: Auto-approved (risk score ${assessment.risk_score}/10)`,
      );
    }

    telemetry.total_latency_ms = Date.now() - totalStart;
    core.info(JSON.stringify(telemetry));
  } catch (error) {
    telemetry.decision = "error";
    telemetry.total_latency_ms = Date.now() - totalStart;
    core.info(JSON.stringify(telemetry));

    try {
      await postComment(
        octokit,
        owner,
        repo,
        prNumber,
        formatErrorComment(),
      );
    } catch {
      // If we can't even post a comment, just log the error
    }

    core.setFailed(
      `Co-Signer failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

run();
