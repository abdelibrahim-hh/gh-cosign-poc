import { useState, useEffect } from "react";

export interface PRStatus {
  state: "pending" | "approved" | "changes_requested" | "error";
  riskScore: number | null;
  riskTier: string | null;
  loading: boolean;
}

export function usePRStatus(owner: string, repo: string, prNumber: number): PRStatus {
  const [status, setStatus] = useState<PRStatus>({
    state: "pending",
    riskScore: null,
    riskTier: null,
    loading: true,
  });

  useEffect(() => {
    if (!owner || !repo || prNumber <= 0) {
      setStatus((prev) => ({ ...prev, loading: false, state: "error" }));
      return;
    }

    let cancelled = false;

    async function fetchStatus() {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`
        );

        if (!response.ok) {
          throw new Error(`GitHub API returned ${response.status}`);
        }

        const reviews = await response.json();
        const botReview = reviews.find(
          (r: { user: { login: string }; state: string }) =>
            r.user.login.endsWith("[bot]") && r.state === "APPROVED"
        );

        if (cancelled) return;

        if (botReview) {
          const scoreMatch = botReview.body?.match(/Risk Score:\s*(\d+)\/10/);
          setStatus({
            state: "approved",
            riskScore: scoreMatch ? parseInt(scoreMatch[1], 10) : null,
            riskTier: null,
            loading: false,
          });
        } else {
          setStatus({
            state: "pending",
            riskScore: null,
            riskTier: null,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setStatus({ state: "error", riskScore: null, riskTier: null, loading: false });
        }
      }
    }

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [owner, repo, prNumber]);

  return status;
}
