import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Avatar, Icon, SeverityDot, TagPill } from "../ui";
import { StatusPicker } from "../StatusPicker";
import { AttachmentsPanel } from "../Attachments";
import { CommentsPanel } from "../Comments";
import { AssigneePicker } from "../AssigneePicker";
import { relativeTime } from "../../lib/time";
import { api } from "../../lib/api";
import { useAppCtx } from "../../App";
import type { Bug, BugStatus } from "../../types";

export function BugDetail() {
  const { bugs, setBugs, currentUser } = useAppCtx();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const bugId = Number(params.id);
  const bug = Number.isFinite(bugId) ? bugs.find((b) => b.id === bugId) : undefined;
  const onBugUpdated = (updated: Bug) =>
    setBugs((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  const [summary, setSummary] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Refetch summary when bug changes OR when a new duplicate arrives.
  const dupCountForBug = bug ? bugs.filter((b) => b.duplicateOf === bug.id).length : 0;

  useEffect(() => {
    if (!bug) return;
    const additionalReports = bugs
      .filter((b) => b.duplicateOf === bug.id)
      .map((d) => d.what);
    const ctrl = new AbortController();
    setSummary("");
    setSummaryLoading(true);
    api
      .summary({ title: bug.title, what: bug.what, additionalReports }, ctrl.signal)
      .then((r) => {
        if (!ctrl.signal.aborted) setSummary(r.summary || "");
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setSummary("");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSummaryLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bug?.id, dupCountForBug]);

  if (!bug) {
    return (
      <div className="main">
        <p>Bug not found.</p>
        <button className="btn btn--ghost" onClick={() => navigate("/bugs")}>
          <Icon.arrowLeft /> Back
        </button>
      </div>
    );
  }
  const parent = bug.duplicateOf ? bugs.find((b) => b.id === bug.duplicateOf) : null;
  const dupes = bugs.filter((b) => b.duplicateOf === bug.id);

  return (
    <div className="main">
      <button
        className="btn btn--ghost btn--sm"
        onClick={() => navigate("/bugs")}
        style={{ marginBottom: 16 }}
      >
        <Icon.arrowLeft /> All bugs
      </button>

      {parent && (
        <div className="detail-banner">
          <Icon.copy />
          <span>
            Duplicate of{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate(`/bugs/${parent.id}`);
              }}
            >
              #{parent.id} {parent.title}
            </a>
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 8 }}>
        <span className="bug-row__id" style={{ marginTop: 10 }}>
          #{bug.id}
        </span>
        <h1 className="page-title" style={{ flex: 1 }}>
          {bug.title}
        </h1>
      </div>
      <div className="flex-row" style={{ marginBottom: 24, gap: 10 }}>
        <StatusPicker
          status={bug.status}
          hasResolution={!!bug.resolution}
          onChange={async (next: BugStatus, resolution?: string) => {
            const updated = await api.updateBug(bug.id, {
              status: next,
              ...(resolution !== undefined ? { resolution } : {}),
            });
            onBugUpdated(updated);
          }}
        />
        <SeverityDot severity={bug.severity} withLabel />
        <AssigneePicker
          assignee={bug.assignee}
          onChange={async (assigneeId) => {
            const updated = await api.updateBug(bug.id, { assigneeId });
            onBugUpdated(updated);
          }}
        />
        <span style={{ color: "var(--app-ink-muted)", fontSize: 13 }}>·</span>
        <Avatar name={bug.reporter.name} size="sm" />
        <span style={{ fontSize: 13, color: "var(--app-ink)" }}>{bug.reporter.name}</span>
        <span style={{ fontSize: 13, color: "var(--app-ink-muted)" }}>
          · {relativeTime(bug.createdAt)} · {bug.when}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {bug.tags.map((t) => (
            <TagPill key={t}>#{t}</TagPill>
          ))}
        </span>
      </div>

      <div className="detail-grid">
        <div>
          {(summaryLoading || summary) && (
            <div
              className="app-card"
              style={{
                marginBottom: 24,
                padding: 16,
                background:
                  "linear-gradient(180deg, color-mix(in oklab, var(--purple-500) 5%, var(--app-surface)) 0%, var(--app-surface) 80%)",
              }}
            >
              <div
                className="detail-section__label"
                style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}
              >
                <Icon.sparkle style={{ color: "var(--purple-500)" }} />
                <span>AI summary</span>
              </div>
              {summaryLoading ? (
                <div>
                  <div className="dup-skeleton" style={{ height: 14, marginBottom: 6 }} />
                  <div className="dup-skeleton" style={{ height: 14, width: "70%", opacity: 0.7 }} />
                </div>
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--app-ink)" }}>
                  {summary}
                </div>
              )}
            </div>
          )}
          <div className="detail-section">
            <div className="detail-section__label">What happened</div>
            <div className="detail-prose">{bug.what}</div>
          </div>
          <AttachmentsPanel bugId={bug.id} currentUserId={currentUser.id} />
          <CommentsPanel bugId={bug.id} currentUserId={currentUser.id} />
          {dupes.length > 0 && (
            <div className="detail-section">
              <div className="detail-section__label">
                Other reports of this bug · {dupes.length}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {dupes.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      padding: "12px 16px",
                      background: "var(--app-surface-2)",
                      borderRadius: 10,
                      borderLeft: "3px solid var(--purple-400)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                        fontSize: 12,
                        color: "var(--app-ink-muted)",
                      }}
                    >
                      <Avatar name={d.reporter.name} size="sm" />
                      <span style={{ fontWeight: 500, color: "var(--app-ink)" }}>
                        {d.reporter.name}
                      </span>
                      <span>· #{d.id}</span>
                      <span>· {relativeTime(d.createdAt)}</span>
                      {d.affected && <span>· affected: {d.affected}</span>}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--app-ink)" }}>
                      {d.what}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bug.expected && (
            <div className="detail-section">
              <div className="detail-section__label">Expected</div>
              <div className="detail-prose">{bug.expected}</div>
            </div>
          )}
          {bug.affected && (
            <div className="detail-section">
              <div className="detail-section__label">Affected user</div>
              <div className="detail-prose">{bug.affected}</div>
            </div>
          )}
          {bug.url && (
            <div className="detail-section">
              <div className="detail-section__label">URL</div>
              <a className="detail-link" href={bug.url} target="_blank" rel="noreferrer">
                {bug.url}
              </a>
            </div>
          )}
          {bug.status === "fixed" && bug.resolution && (
            <div className="detail-section">
              <div className="detail-section__label">Resolution notes</div>
              <div className="detail-prose">{bug.resolution}</div>
            </div>
          )}
        </div>

        <aside>
          <div className="app-card" style={{ padding: 18, marginBottom: 16 }}>
            <div
              className="detail-section__label"
              style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}
            >
              <span>Slack</span>
              <span className="tagpill tagpill--accent" style={{ fontSize: 10, padding: "2px 8px" }}>
                Coming soon
              </span>
            </div>
            <button
              className="btn btn--outline"
              style={{ width: "100%", opacity: 0.55, cursor: "not-allowed" }}
              disabled
            >
              <Icon.slack /> View in Slack
            </button>
            <div className="field__hint" style={{ marginTop: 10 }}>
              Slack notifications are on the roadmap. For now, bugs are stored
              and surfaced in this UI only.
            </div>
          </div>

          {dupes.length > 0 && (
            <div className="app-card" style={{ padding: 18 }}>
              <div className="detail-section__label" style={{ marginBottom: 12 }}>
                Duplicate reports · {dupes.length}
              </div>
              <div className="dup-list">
                {dupes.map((d) => (
                  <div key={d.id} className="dup-list-item">
                    <Avatar name={d.reporter.name} size="sm" />
                    <div className="flex-col">
                      <span className="dup-list-item__name">{d.reporter.name}</span>
                      <span style={{ fontSize: 11, color: "var(--app-ink-muted)" }}>
                        #{d.id}
                      </span>
                    </div>
                    <span className="dup-list-item__time">{relativeTime(d.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
