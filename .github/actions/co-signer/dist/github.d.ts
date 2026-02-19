import * as github from "@actions/github";
type Octokit = ReturnType<typeof github.getOctokit>;
export declare function postComment(octokit: Octokit, owner: string, repo: string, prNumber: number, body: string): Promise<void>;
export declare function submitReview(octokit: Octokit, owner: string, repo: string, prNumber: number, event: "APPROVE" | "COMMENT", body: string): Promise<void>;
export declare function dismissReview(octokit: Octokit, owner: string, repo: string, prNumber: number, reviewId: number, message: string): Promise<void>;
export declare function findBotReview(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<{
    id: number;
    risk_score?: number;
} | null>;
export declare function getPRHeadSha(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<string>;
export {};
