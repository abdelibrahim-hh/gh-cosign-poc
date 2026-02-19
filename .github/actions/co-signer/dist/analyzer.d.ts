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
}
export type Decision = "approve" | "abstain";
export interface GuardrailResult {
    triggered: boolean;
    decision: Decision;
    reason: string;
    guardrail: string | null;
}
export declare function checkGuardrails(changedFiles: string[], config: Config): GuardrailResult;
export declare function makeDecision(riskScore: number, threshold: number): Decision;
export declare function validateAssessment(data: unknown): RiskAssessment | null;
export declare function assessRisk(context: PRContext, config: Config, systemPrompt: string, apiKey: string): Promise<{
    assessment: RiskAssessment | null;
    latencyMs: number;
}>;
