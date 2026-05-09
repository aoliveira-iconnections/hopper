import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Icon, StatusBadge, SeverityDot, TagPill } from "../ui";
import { useAppCtx } from "../../App";

interface ConfirmState {
  newBugId: number;
  duplicateOfId: number | null;
}

export function Confirm() {
  const { bugs } = useAppCtx();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ConfirmState | null;

  if (!state) return <Navigate to="/dashboard" replace />;

  const newBug = bugs.find((b) => b.id === state.newBugId);
  if (!newBug) return <Navigate to="/dashboard" replace />;

  const parent = state.duplicateOfId
    ? bugs.find((b) => b.id === state.duplicateOfId)
    : null;
  const isDup = !!parent;
  const targetBug = isDup ? parent! : newBug;

  return (
    <div className="main">
      <div className="confirm-wrap">
        <div className={`confirm-icon ${isDup ? "confirm-icon--dup" : ""}`}>
          {isDup ? (
            <Icon.copy width="32" height="32" />
          ) : (
            <Icon.check width="36" height="36" />
          )}
        </div>
        <h1 className="confirm-title">
          {isDup ? `Linked to bug #${parent!.id}` : "Bug filed"}
        </h1>
        <p className="confirm-sub">
          {isDup
            ? "Your report was linked to the existing bug. Triagers can see it in the detail view."
            : "Saved and indexed for similarity search. Triagers can find it in the dashboard."}
        </p>

        <div className="confirm-summary">
          <div className="detail-section__label">{isDup ? "Parent bug" : "Filed as new"}</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--app-ink-strong)" }}>
            #{targetBug.id} {targetBug.title}
          </div>
          <div className="flex-row flex-row--gap-sm" style={{ flexWrap: "wrap" }}>
            <StatusBadge status={targetBug.status} />
            <SeverityDot severity={targetBug.severity} withLabel />
            {targetBug.tags.map((t) => (
              <TagPill key={t}>#{t}</TagPill>
            ))}
          </div>
        </div>

        <div className="flex-row" style={{ gap: 10 }}>
          <button
            className="btn btn--outline"
            disabled
            style={{ opacity: 0.55, cursor: "not-allowed" }}
          >
            <Icon.slack /> Slack — coming soon
          </button>
          <button
            className="btn btn--primary"
            onClick={() => navigate(`/bugs/${targetBug.id}`)}
          >
            View bug details <Icon.arrowRight />
          </button>
        </div>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("/report");
          }}
          style={{ color: "var(--app-ink-muted)", fontSize: 13, textDecoration: "none" }}
        >
          Report another bug
        </a>
      </div>
    </div>
  );
}
