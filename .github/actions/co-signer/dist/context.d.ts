import * as github from "@actions/github";
type Octokit = ReturnType<typeof github.getOctokit>;
export interface PRContext {
    pr: {
        number: number;
        title: string;
        description: string;
        author: string;
        baseBranch: string;
        headSha: string;
        labels: string[];
    };
    diff: string;
    changedFiles: string[];
    codeowners: CodeownersEntry[];
    affectedOwners: string[];
}
export interface CodeownersEntry {
    pattern: string;
    owners: string[];
}
export declare function parseCodeowners(content: string): CodeownersEntry[];
export declare function getAffectedOwners(changedFiles: string[], codeowners: CodeownersEntry[]): string[];
export declare function assembleContext(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<PRContext>;
export {};
