import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, Icon, StatusBadge, SeverityDot } from "../ui";
import { relativeTime } from "../../lib/time";
import { api, type DashboardStats } from "../../lib/api";
import { STATUSES } from "../../lib/constants";
import { useAppCtx } from "../../App";
import type { Bug, BugStatus, Severity } from "../../types";

const SEV_WEIGHT: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// Status order for the pipeline strip — left-to-right reads as the triage flow.
const PIPELINE_STATUSES: BugStatus[] = ["new", "invest", "progress", "needs", "fixed"];

const STALE_THRESHOLD_DAYS = 5;
const STALE_STATUSES: BugStatus[] = ["new", "invest", "progress", "needs"];

export function Dashboard() {
  const { bugs, currentUser } = useAppCtx();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const firstName = currentUser.name.split(" ")[0];

  useEffect(() => {
    let cancelled = false;
    api
      .dashboardStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bugs]);

  const recent = useMemo(
    () =>
      [...bugs]
        .filter((b) => !b.duplicateOf)
        .sort(
          (a, b) =>
            // Critical bugs float to the top; ties broken by recency.
            SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] ||
            b.createdAt - a.createdAt,
        )
        .slice(0, 5),
    [bugs],
  );

  const myQueue = useMemo(
    () =>
      bugs
        .filter(
          (b) =>
            !b.duplicateOf &&
            b.assignee?.id === currentUser.id &&
            !["fixed", "cantrepro"].includes(b.status),
        )
        .sort(
          (a, b) =>
            SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] ||
            a.updatedAt - b.updatedAt,
        )
        .slice(0, 5),
    [bugs, currentUser.id],
  );

  const stale = useMemo(() => {
    const cutoff = Date.now() - STALE_THRESHOLD_DAYS * 24 * 3600 * 1000;
    return bugs
      .filter(
        (b) =>
          !b.duplicateOf &&
          STALE_STATUSES.includes(b.status) &&
          b.updatedAt < cutoff,
      )
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, 5);
  }, [bugs]);

  const hour = new Date().getHours();
  const greeting =
    hour < 5
      ? "Good evening"
      : hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";

  const heroSubtitle =
    stats === null
      ? "Loading…"
      : stats.openCount === 0
        ? "Nothing open right now — nice."
        : stats.openCount === 1
          ? "1 open bug across the platform. We'll find duplicates as you file."
          : `${stats.openCount} open bugs across the platform. We'll find duplicates as you file.`;

  const fmt = (n: number | undefined) => (n === undefined ? "—" : String(n));

  return (
    <div className="main">
      <section className="dash-hero">
        <div>
          <span className="t-eyebrow" style={{ color: "rgba(255,255,255,0.85)" }}>
            Hopper
          </span>
          <h1>
            {greeting}, {firstName}.
          </h1>
          <p>{heroSubtitle}</p>
          <div className="dash-hero__cta">
            <button
              className="btn btn--primary btn--lg"
              onClick={() => navigate("/report")}
              style={{ background: "#fff", color: "var(--purple-700)" }}
            >
              <Icon.plus style={{ marginRight: 4 }} /> Report a bug
            </button>
            <button
              className="btn btn--outline btn--on-dark btn--lg"
              onClick={() => navigate("/bugs")}
            >
              Browse all bugs
            </button>
          </div>
        </div>
        <div className="dash-hero__stats">
          <div className="dash-stat">
            <div className="dash-stat__num">{fmt(stats?.openCount)}</div>
            <div className="dash-stat__label">Open</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__num">{fmt(stats?.filedToday)}</div>
            <div className="dash-stat__label">Filed (24h)</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__num">{fmt(stats?.criticalCount)}</div>
            <div className="dash-stat__label">Critical</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__num">{fmt(stats?.dupesCaught)}</div>
            <div className="dash-stat__label">Dupes caught</div>
          </div>
        </div>
      </section>

      <PipelineStrip
        byStatus={stats?.byStatus}
        onClick={(s) => navigate(`/bugs?status=${s}`)}
      />

      <section className="dash-grid">
        <MyQueueCard
          items={myQueue}
          firstName={firstName}
          userId={currentUser.id}
          onOpen={(id) => navigate(`/bugs/${id}`)}
          onSeeAll={() => navigate(`/bugs?assigneeId=${currentUser.id}`)}
        />
        <StaleCard
          items={stale}
          onOpen={(id) => navigate(`/bugs/${id}`)}
          onSeeAll={() => navigate("/bugs?status=invest")}
        />
        <div className="app-card">
          <div className="dash-section-head">
            <h2>Recent reports</h2>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate("/bugs");
              }}
            >
              View all →
            </a>
          </div>
          <div className="activity">
            {recent.map((bug) => (
              <div
                key={bug.id}
                className="activity-item"
                onClick={() => navigate(`/bugs/${bug.id}`)}
              >
                <Avatar name={bug.reporter.name} size="sm" />
                <div style={{ minWidth: 0 }}>
                  <div className="activity-item__title">{bug.title}</div>
                  <div className="activity-item__meta">
                    <StatusBadge status={bug.status} />
                    <SeverityDot severity={bug.severity} />
                    <span>· {bug.reporter.name}</span>
                    <span>· {relativeTime(bug.createdAt)}</span>
                  </div>
                </div>
                <Icon.arrowRight style={{ color: "var(--app-ink-muted)" }} />
              </div>
            ))}
          </div>
        </div>

        <ClustersCard
          clusters={bugs
            .filter((b) => b.duplicateCount > 0)
            .sort((a, b) => b.duplicateCount - a.duplicateCount)
            .slice(0, 3)}
          onOpen={(id) => navigate(`/bugs/${id}`)}
        />
      </section>
    </div>
  );
}

function PipelineStrip({
  byStatus,
  onClick,
}: {
  byStatus: Record<BugStatus, number> | undefined;
  onClick: (s: BugStatus) => void;
}) {
  return (
    <section className="pipeline">
      {PIPELINE_STATUSES.map((s) => {
        const count = byStatus?.[s] ?? 0;
        return (
          <button
            key={s}
            type="button"
            className={`pipeline__cell pipeline__cell--${s}`}
            onClick={() => onClick(s)}
          >
            <span className="pipeline__count">{byStatus ? count : "—"}</span>
            <span className="pipeline__label">{STATUSES[s].label}</span>
          </button>
        );
      })}
    </section>
  );
}

function MyQueueCard({
  items,
  firstName,
  userId,
  onOpen,
  onSeeAll,
}: {
  items: Bug[];
  firstName: string;
  userId: number;
  onOpen: (id: number) => void;
  onSeeAll: () => void;
}) {
  return (
    <div className="app-card">
      <div className="dash-section-head">
        <h2>{firstName}'s queue</h2>
        {items.length > 0 ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSeeAll();
            }}
          >
            View all →
          </a>
        ) : (
          <span className="field__hint">Bugs assigned to you</span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="dash-empty">
          <Icon.check />
          <span>Nothing assigned to you. {userId ? "Inbox zero." : ""}</span>
        </div>
      ) : (
        <div className="activity">
          {items.map((bug) => (
            <div
              key={bug.id}
              className="activity-item"
              onClick={() => onOpen(bug.id)}
            >
              <SeverityDot severity={bug.severity} />
              <div style={{ minWidth: 0 }}>
                <div className="activity-item__title">{bug.title}</div>
                <div className="activity-item__meta">
                  <StatusBadge status={bug.status} />
                  <span>· #{bug.id}</span>
                  <span>· updated {relativeTime(bug.updatedAt)}</span>
                </div>
              </div>
              <Icon.arrowRight style={{ color: "var(--app-ink-muted)" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StaleCard({
  items,
  onOpen,
  onSeeAll,
}: {
  items: Bug[];
  onOpen: (id: number) => void;
  onSeeAll: () => void;
}) {
  return (
    <div className="app-card">
      <div className="dash-section-head">
        <h2>Stale</h2>
        {items.length > 0 ? (
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSeeAll();
            }}
          >
            Investigate →
          </a>
        ) : (
          <span className="field__hint">No untouched activity &gt; {STALE_THRESHOLD_DAYS}d</span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="dash-empty">
          <Icon.check />
          <span>Pipeline is moving — nothing stuck.</span>
        </div>
      ) : (
        <div className="activity">
          {items.map((bug) => {
            const days = Math.floor(
              (Date.now() - bug.updatedAt) / (24 * 3600 * 1000),
            );
            return (
              <div
                key={bug.id}
                className="activity-item"
                onClick={() => onOpen(bug.id)}
              >
                <span className="dash-stale-pill">{days}d</span>
                <div style={{ minWidth: 0 }}>
                  <div className="activity-item__title">{bug.title}</div>
                  <div className="activity-item__meta">
                    <StatusBadge status={bug.status} />
                    <SeverityDot severity={bug.severity} />
                    {bug.assignee && <span>· {bug.assignee.name}</span>}
                  </div>
                </div>
                <Icon.arrowRight style={{ color: "var(--app-ink-muted)" }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClustersCard({
  clusters,
  onOpen,
}: {
  clusters: Bug[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="app-card">
      <div className="dash-section-head">
        <h2>Active clusters</h2>
        <span className="field__hint">Bugs with linked dupes</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {clusters.map((bug) => (
          <div
            key={bug.id}
            className="cluster-card"
            onClick={() => onOpen(bug.id)}
          >
            <div className="cluster-card__head">
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {bug.title}
              </span>
              <span className="cluster-card__count">{bug.duplicateCount + 1}</span>
            </div>
            <div className="cluster-card__sub">
              {bug.duplicateCount} duplicate report{bug.duplicateCount === 1 ? "" : "s"}
              {" "}· #{bug.id}
              {bug.tags.length > 0 && " · " + bug.tags.map((t) => "#" + t).join(" ")}
            </div>
          </div>
        ))}
        {clusters.length === 0 && (
          <div className="dash-empty">
            <span>No active clusters yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
