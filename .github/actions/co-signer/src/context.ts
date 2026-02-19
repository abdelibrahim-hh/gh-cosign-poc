import * as github from "@actions/github";
import * as core from "@actions/core";
import picomatch from "picomatch";

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
  linesChanged: number;
  codeowners: CodeownersEntry[];
  affectedOwners: string[];
}

export interface CodeownersEntry {
  pattern: string;
  owners: string[];
}

export function parseCodeowners(content: string): CodeownersEntry[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(/\s+/);
      return {
        pattern: parts[0],
        owners: parts.slice(1),
      };
    });
}

export function getAffectedOwners(
  changedFiles: string[],
  codeowners: CodeownersEntry[],
): string[] {
  const owners = new Set<string>();

  for (const file of changedFiles) {
    for (const entry of codeowners) {
      if (picomatch.isMatch(file, entry.pattern)) {
        entry.owners.forEach((o) => owners.add(o));
      }
    }
  }

  return [...owners];
}

export async function assembleContext(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRContext> {
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  const { data: diffData } = (await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: "diff" },
  })) as unknown as { data: string };

  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  const changedFiles = files.map((f) => f.filename);
  const linesChanged = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);

  let codeownersContent = "";
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "CODEOWNERS",
      ref: pr.base.ref,
    });
    if ("content" in data) {
      codeownersContent = Buffer.from(data.content, "base64").toString();
    }
  } catch {
    core.warning("CODEOWNERS file not found — proceeding without it");
  }

  const codeowners = parseCodeowners(codeownersContent);
  const affectedOwners = getAffectedOwners(changedFiles, codeowners);

  return {
    pr: {
      number: prNumber,
      title: pr.title,
      description: pr.body ?? "",
      author: pr.user?.login ?? "unknown",
      baseBranch: pr.base.ref,
      headSha: pr.head.sha,
      labels: pr.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
    },
    diff: typeof diffData === "string" ? diffData : String(diffData),
    changedFiles,
    linesChanged,
    codeowners,
    affectedOwners,
  };
}
