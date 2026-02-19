import * as github from "@actions/github";

const COMMENT_MARKER = "<!-- co-signer-risk-assessment -->";

type Octokit = ReturnType<typeof github.getOctokit>;

export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  const markedBody = `${COMMENT_MARKER}\n${body}`;

  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });

  const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body: markedBody,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: markedBody,
    });
  }
}

export async function submitReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  event: "APPROVE" | "COMMENT",
  body: string,
): Promise<void> {
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    event,
    body,
  });
}

export async function dismissReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
  message: string,
): Promise<void> {
  await octokit.rest.pulls.dismissReview({
    owner,
    repo,
    pull_number: prNumber,
    review_id: reviewId,
    message,
  });
}

export async function findBotReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ id: number; risk_score?: number } | null> {
  const { data: reviews } = await octokit.rest.pulls.listReviews({
    owner,
    repo,
    pull_number: prNumber,
  });

  const botApprovals = reviews
    .filter((r) => r.state === "APPROVED" && r.user?.login?.endsWith("[bot]"))
    .sort(
      (a, b) =>
        new Date(b.submitted_at ?? 0).getTime() -
        new Date(a.submitted_at ?? 0).getTime(),
    );

  if (botApprovals.length === 0) return null;

  const scoreMatch = botApprovals[0].body?.match(
    /Risk Score:\s*(\d+)\/10/,
  );
  const riskScore = scoreMatch ? parseInt(scoreMatch[1], 10) : undefined;

  return { id: botApprovals[0].id, risk_score: riskScore };
}

export async function getPRHeadSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string> {
  const { data: pr } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return pr.head.sha;
}
