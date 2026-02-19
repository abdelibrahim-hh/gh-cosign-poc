import { usePRStatus } from "../hooks/usePRStatus";

interface PRStatusBadgeProps {
  owner: string;
  repo: string;
  prNumber: number;
}

const STATE_STYLES: Record<string, { bg: string; label: string }> = {
  pending: { bg: "#f0ad4e", label: "Pending Review" },
  approved: { bg: "#5cb85c", label: "Approved" },
  changes_requested: { bg: "#d9534f", label: "Changes Requested" },
  error: { bg: "#888", label: "Unknown" },
};

export function PRStatusBadge({ owner, repo, prNumber }: PRStatusBadgeProps) {
  const status = usePRStatus(owner, repo, prNumber);

  if (status.loading) {
    return <span className="pr-badge pr-badge--loading">Loading...</span>;
  }

  const style = STATE_STYLES[status.state] ?? STATE_STYLES.error;

  return (
    <div className="pr-badge" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <span
        style={{
          backgroundColor: style.bg,
          color: "#fff",
          padding: "4px 12px",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        {style.label}
      </span>
      {status.riskScore !== null && (
        <span style={{ fontSize: "13px", color: "#666" }}>
          Risk: {status.riskScore}/10
        </span>
      )}
    </div>
  );
}
