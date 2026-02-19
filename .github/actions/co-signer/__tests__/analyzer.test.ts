import { describe, it, expect } from "vitest";
import {
  checkGuardrails,
  makeDecision,
  validateAssessment,
  Config,
} from "../src/analyzer";

const baseConfig: Config = {
  guardrails: {
    never_approve_paths: [".github/workflows/**", ".github/CODEOWNERS", "deploy/**"],
    always_low_risk_paths: ["**/*.test.*", "**/*.stories.*", "**/*.md"],
    never_approve_dependency_paths: [
      "package.json",
      "**/yarn.lock",
      "**/pnpm-lock.yaml",
      "**/package-lock.json",
    ],
  },
  thresholds: {
    auto_approve_max_risk: 3,
    max_files_changed: 50,
    max_lines_changed: 500,
  },
  claude: { provider: "anthropic", model: "claude-sonnet-4-5" },
};

// --- Guardrail tests ---

describe("checkGuardrails", () => {
  describe("never_approve_paths", () => {
    it.each([
      [".github/workflows/ci.yml", "workflow file"],
      [".github/CODEOWNERS", "CODEOWNERS file"],
      ["deploy/production.yaml", "deploy file"],
    ])("returns ABSTAIN for %s (%s)", (file) => {
      const result = checkGuardrails([file], baseConfig);
      expect(result.triggered).toBe(true);
      expect(result.decision).toBe("abstain");
      expect(result.guardrail).toBe("never_approve_paths");
    });
  });

  describe("never_approve_dependency_paths", () => {
    it.each([
      ["package.json"],
      ["packages/core/yarn.lock"],
      ["packages/core/pnpm-lock.yaml"],
      ["package-lock.json"],
    ])("returns ABSTAIN for %s", (file) => {
      const result = checkGuardrails([file], baseConfig);
      expect(result.triggered).toBe(true);
      expect(result.decision).toBe("abstain");
      expect(result.guardrail).toBe("never_approve_dependency_paths");
    });
  });

  describe("always_low_risk_paths", () => {
    it("returns APPROVE when ALL files match low-risk patterns", () => {
      const files = ["src/App.test.ts", "src/Button.stories.tsx", "README.md"];
      const result = checkGuardrails(files, baseConfig);
      expect(result.triggered).toBe(true);
      expect(result.decision).toBe("approve");
      expect(result.guardrail).toBe("always_low_risk_paths");
    });

    it("does NOT trigger when mixed with non-low-risk files", () => {
      const files = ["src/App.test.ts", "src/App.tsx"];
      const result = checkGuardrails(files, baseConfig);
      expect(result.triggered).toBe(false);
    });
  });

  describe("max_files_changed", () => {
    it("returns ABSTAIN when file count exceeds limit", () => {
      const files = Array.from({ length: 51 }, (_, i) => `src/file${i}.ts`);
      const result = checkGuardrails(files, baseConfig);
      expect(result.triggered).toBe(true);
      expect(result.decision).toBe("abstain");
      expect(result.guardrail).toBe("max_files_changed");
    });
  });

  describe("max_lines_changed", () => {
    it("returns ABSTAIN when line count exceeds limit", () => {
      const result = checkGuardrails(["src/App.tsx"], baseConfig, 501);
      expect(result.triggered).toBe(true);
      expect(result.decision).toBe("abstain");
      expect(result.guardrail).toBe("max_lines_changed");
    });

    it("does not trigger when lines are within limit", () => {
      const result = checkGuardrails(["src/App.tsx"], baseConfig, 200);
      expect(result.triggered).toBe(false);
    });
  });

  it("does not trigger for normal source files", () => {
    const result = checkGuardrails(["src/App.tsx", "src/utils.ts"], baseConfig);
    expect(result.triggered).toBe(false);
  });

  describe("guardrail priority", () => {
    it("never_approve takes precedence over always_low_risk", () => {
      const result = checkGuardrails([".github/workflows/test.yml"], baseConfig);
      expect(result.decision).toBe("abstain");
    });

    it("max_files takes precedence over never_approve", () => {
      const files = Array.from({ length: 51 }, (_, i) => `.github/workflows/w${i}.yml`);
      const result = checkGuardrails(files, baseConfig);
      expect(result.guardrail).toBe("max_files_changed");
    });
  });
});

// --- Decision engine tests ---

describe("makeDecision", () => {
  it.each([
    [1, 3, "approve"],
    [2, 3, "approve"],
    [3, 3, "approve"],
    [4, 3, "abstain"],
    [5, 3, "abstain"],
    [10, 3, "abstain"],
  ] as const)("score %d with threshold %d → %s", (score, threshold, expected) => {
    expect(makeDecision(score, threshold)).toBe(expected);
  });
});

// --- Schema validation tests ---

describe("validateAssessment", () => {
  const validAssessment = {
    risk_score: 3,
    risk_tier: "low",
    reasoning: "Changes are limited to adding a new test file.",
    blast_radius: {
      files_affected: 1,
      modules_affected: ["src/components"],
      owners_affected: ["team-frontend"],
      has_cross_module_impact: false,
    },
    concerns: [],
  };

  it("accepts a valid assessment", () => {
    expect(validateAssessment(validAssessment)).toEqual(validAssessment);
  });

  it.each([
    ["null input", null],
    ["string input", "not an object"],
    ["empty object", {}],
  ])("rejects %s", (_, input) => {
    expect(validateAssessment(input)).toBeNull();
  });

  it("rejects risk_score out of range (0)", () => {
    expect(validateAssessment({ ...validAssessment, risk_score: 0 })).toBeNull();
  });

  it("rejects risk_score out of range (11)", () => {
    expect(validateAssessment({ ...validAssessment, risk_score: 11 })).toBeNull();
  });

  it("rejects non-integer risk_score", () => {
    expect(validateAssessment({ ...validAssessment, risk_score: 3.5 })).toBeNull();
  });

  it("rejects invalid risk_tier", () => {
    expect(validateAssessment({ ...validAssessment, risk_tier: "extreme" })).toBeNull();
  });

  it("rejects empty reasoning", () => {
    expect(validateAssessment({ ...validAssessment, reasoning: "" })).toBeNull();
  });

  it("rejects missing blast_radius", () => {
    const { blast_radius, ...rest } = validAssessment;
    expect(validateAssessment(rest)).toBeNull();
  });

  it("rejects blast_radius with wrong types", () => {
    expect(
      validateAssessment({
        ...validAssessment,
        blast_radius: { ...validAssessment.blast_radius, files_affected: "two" },
      }),
    ).toBeNull();
  });
});
