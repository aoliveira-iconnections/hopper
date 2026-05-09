import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, Icon, StatusBadge, SeverityDot, TagPill } from "../ui";
import { relativeTime } from "../../lib/time";
import { STATUSES, SEVERITIES } from "../../lib/constants";
import { api } from "../../lib/api";
import { onRealtime } from "../../lib/realtime";
import { useAppCtx } from "../../App";
import type { Bug, BugStatus, Severity, SimilarHit, User } from "../../types";

const PAGE_SIZE = 50;

type SortKey = "newest" | "severity" | "duplicates" | "status";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  severity: "Severity",
  duplicates: "Most duplicates",
  status: "Active first",
};

const SEV_WEIGHT: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const STATUS_WEIGHT: Record<BugStatus, number> = {
  new: 4,
  invest: 3,
  progress: 3,
  needs: 2,
  cantrepro: 1,
  fixed: 0,
};

const STATUS_VALUES = new Set<BugStatus>([
  "new", "invest", "progress", "fixed", "cantrepro", "needs",
]);
const SEVERITY_VALUES = new Set<Severity>(["low", "medium", "high", "critical"]);

export function BugList() {
  const { bugs: allBugs } = useAppCtx();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filters live in the URL so they survive refresh and are shareable.
  const status = (searchParams.get("status") ?? "") as BugStatus | "";
  const severity = (searchParams.get("severity") ?? "") as Severity | "";
  const tag = searchParams.get("tag") ?? "";
  const reporterIdRaw = searchParams.get("reporterId");
  const reporterId = reporterIdRaw ? Number(reporterIdRaw) : 0;
  const assigneeIdRaw = searchParams.get("assigneeId");
  const assigneeId = assigneeIdRaw ? Number(assigneeIdRaw) : 0;
  const q = searchParams.get("q") ?? "";

  function setParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        if (value) prev.set(key, value);
        else prev.delete(key);
        return prev;
      },
      { replace: true },
    );
  }

  // Search input: debounce typing into the URL `q` param so we don't refetch
  // on every keystroke.
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== q) setParam("q", searchInput);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Sort is purely view-side, no need to round-trip to the server.
  const [sort, setSort] = useState<SortKey>("newest");

  // Bumped on any realtime bug event so the fetch effect re-runs and pulls
  // a fresh server-filtered list. Cheap because the API is in-process.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    return onRealtime(() => setRefreshTick((n) => n + 1));
  }, []);

  // Reporter dropdown options.
  const [users, setUsers] = useState<User[]>([]);
  useEffect(() => {
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  // Smart search mode: when on, the q is sent to the embedding-based search
  // endpoint and ranks results by semantic similarity. Sort/pagination are
  // ignored in this mode because results are score-ordered.
  const smart = searchParams.get("smart") === "1";

  // Server-filtered list (regular mode) — refetches on filter / cursor change.
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (smart) return;
    let cancelled = false;
    setLoading(true);
    api
      .listBugs({
        status: STATUS_VALUES.has(status as BugStatus) ? (status as BugStatus) : undefined,
        severity: SEVERITY_VALUES.has(severity as Severity) ? (severity as Severity) : undefined,
        tag: tag || undefined,
        reporterId: reporterId || undefined,
        assigneeId: assigneeId || undefined,
        q: q || undefined,
        excludeDuplicates: true,
        limit: PAGE_SIZE,
      })
      .then((page) => {
        if (cancelled) return;
        setBugs(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) {
          setBugs([]);
          setNextCursor(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, severity, tag, reporterId, assigneeId, q, smart, refreshTick]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.listBugs({
        status: STATUS_VALUES.has(status as BugStatus) ? (status as BugStatus) : undefined,
        severity: SEVERITY_VALUES.has(severity as Severity) ? (severity as Severity) : undefined,
        tag: tag || undefined,
        reporterId: reporterId || undefined,
        assigneeId: assigneeId || undefined,
        q: q || undefined,
        excludeDuplicates: true,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setBugs((prev) => {
        const seen = new Set(prev.map((b) => b.id));
        return [...prev, ...page.items.filter((b) => !seen.has(b.id))];
      });
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  // Smart-search results.
  const [searchHits, setSearchHits] = useState<SimilarHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!smart) {
      setSearchHits([]);
      return;
    }
    if (q.trim().length < 2) {
      setSearchHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    api
      .searchBugs(q.trim())
      .then((hits) => {
        if (!cancelled) setSearchHits(hits);
      })
      .catch(() => {
        if (!cancelled) setSearchHits([]);
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [smart, q]);

  const visibleBugs = useMemo(() => {
    switch (sort) {
      case "severity":
        return [...bugs].sort(
          (a, b) =>
            SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity] || b.createdAt - a.createdAt,
        );
      case "duplicates":
        return [...bugs].sort(
          (a, b) => b.duplicateCount - a.duplicateCount || b.createdAt - a.createdAt,
        );
      case "status":
        return [...bugs].sort(
          (a, b) =>
            STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status] || b.createdAt - a.createdAt,
        );
      case "newest":
      default:
        return [...bugs].sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [bugs, sort]);

  const totalPrimary = allBugs.filter((b) => !b.duplicateOf).length;
  const hasActiveFilters =
    status !== "" ||
    severity !== "" ||
    tag !== "" ||
    reporterId !== 0 ||
    assigneeId !== 0 ||
    q !== "";

  function clearFilters() {
    setSearchInput("");
    setSearchParams({}, { replace: true });
  }

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bugs</h1>
          <p className="page-subtitle">
            {loading ? "Loading…" : `${visibleBugs.length} of ${totalPrimary} bugs shown`}
          </p>
        </div>
        <button className="btn btn--primary" onClick={() => navigate("/report")}>
          <Icon.plus /> Report new bug
        </button>
      </div>

      <div className="filter-row">
        <div className="filter-search">
          <span className="filter-search__icon">
            {smart ? <Icon.sparkle style={{ color: "var(--purple-500)" }} /> : <Icon.search />}
          </span>
          <input
            className="app-input"
            placeholder={
              smart
                ? "Smart search — describe the bug…"
                : "Search title or description…"
            }
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button
            type="button"
            className={`smart-toggle ${smart ? "is-on" : ""}`}
            onClick={() => setParam("smart", smart ? "" : "1")}
            title={smart ? "Switch to keyword filter" : "Smart search by meaning"}
          >
            <Icon.sparkle /> Smart
          </button>
        </div>
        {!smart && (
          <>
            <FilterGroup
              label="Status"
              value={status || "all"}
              onChange={(v) => setParam("status", v === "all" ? "" : v)}
              options={[
                ["all", "All"],
                ...(Object.entries(STATUSES) as [BugStatus, { label: string }][]).map(
                  ([k, v]) => [k, v.label] as [string, string],
                ),
              ]}
            />
            <FilterGroup
              label="Severity"
              value={severity || "all"}
              onChange={(v) => setParam("severity", v === "all" ? "" : v)}
              colorize
              options={[
                ["all", "All"],
                ...(Object.entries(SEVERITIES) as [Severity, { label: string }][]).map(
                  ([k, v]) => [k, v.label] as [string, string],
                ),
              ]}
            />
            <UserPicker
              label="Reporter"
              users={users}
              value={reporterId}
              onChange={(id) => setParam("reporterId", id ? String(id) : "")}
            />
            <UserPicker
              label="Assignee"
              users={users}
              value={assigneeId}
              onChange={(id) => setParam("assigneeId", id ? String(id) : "")}
            />
            <SortPicker value={sort} onChange={setSort} />
          </>
        )}
      </div>

      {tag && (
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="field__hint">Filtered by tag:</span>
          <TagPill selected onClick={() => setParam("tag", "")}>
            #{tag} <span style={{ marginLeft: 4, opacity: 0.7 }}>×</span>
          </TagPill>
        </div>
      )}

      {smart ? (
        q.trim().length < 2 ? (
          <div className="app-card" style={{ padding: 32, textAlign: "center" }}>
            <Icon.sparkle style={{ color: "var(--purple-500)" }} />
            <div style={{ marginTop: 8, fontSize: 14, color: "var(--app-ink-muted)" }}>
              Type at least 2 characters to search by meaning.
            </div>
          </div>
        ) : searching ? (
          <div className="dup-skeleton" style={{ height: 80 }} />
        ) : searchHits.length === 0 ? (
          <EmptyState
            hasFilters={true}
            onClear={() => {
              setSearchInput("");
              setParam("q", "");
            }}
            onReport={() => navigate("/report")}
          />
        ) : (
          <div className="bug-table">
            <div className="bug-table__head">
              <span>Bug</span>
              <span>Status</span>
              <span>Severity</span>
              <span>Match</span>
            </div>
            {searchHits.map((hit) => (
              <BugRow
                key={hit.bug.id}
                bug={hit.bug}
                score={hit.score}
                onClick={() => navigate(`/bugs/${hit.bug.id}`)}
                onTagClick={(t) => setParam("tag", t)}
              />
            ))}
          </div>
        )
      ) : visibleBugs.length > 0 ? (
        <>
          <div className="bug-table">
            <div className="bug-table__head">
              <span>Bug</span>
              <span>Status</span>
              <span>Severity</span>
              <span>Reporter</span>
            </div>
            {visibleBugs.map((bug) => (
              <BugRow
                key={bug.id}
                bug={bug}
                onClick={() => navigate(`/bugs/${bug.id}`)}
                onTagClick={(t) => setParam("tag", t)}
              />
            ))}
          </div>
          {nextCursor && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button
                className="btn btn--ghost btn--sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      ) : !loading ? (
        <EmptyState
          hasFilters={hasActiveFilters}
          onClear={clearFilters}
          onReport={() => navigate("/report")}
        />
      ) : null}
    </div>
  );
}

function SortPicker({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="field__hint" style={{ marginRight: 4 }}>
        Sort:
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            className={`chip chip--mini ${value === k ? "is-selected" : ""}`}
            onClick={() => onChange(k)}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  onChange,
  options,
  colorize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  colorize?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="field__hint" style={{ marginRight: 4 }}>
        {label}:
      </span>
      <div style={{ display: "flex", gap: 4 }}>
        {options.map(([k, lbl]) => (
          <button
            key={k}
            className={`chip chip--mini ${value === k ? "is-selected" : ""}`}
            onClick={() => onChange(k)}
            type="button"
          >
            {colorize && k !== "all" && (
              <span
                className="chip__sev-dot"
                style={{
                  background: value === k ? "rgba(255,255,255,0.95)" : `var(--sev-${k})`,
                }}
              />
            )}
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserPicker({
  label,
  users,
  value,
  onChange,
}: {
  label: string;
  users: User[];
  value: number;
  onChange: (id: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span className="field__hint" style={{ marginRight: 4 }}>
        {label}:
      </span>
      <select
        className="app-input"
        style={{ padding: "5px 8px", fontSize: 13, minWidth: 150 }}
        value={value || ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : 0)}
      >
        <option value="">All</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function BugRow({
  bug,
  score,
  onClick,
  onTagClick,
}: {
  bug: Bug;
  score?: number;
  onClick: () => void;
  onTagClick: (t: string) => void;
}) {
  return (
    <div className="bug-row" onClick={onClick}>
      <div className="bug-row__title">
        <div className="bug-row__title-line">
          <span className="bug-row__id">#{bug.id}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bug.title}
          </span>
        </div>
        <div className="bug-row__tags">
          {bug.tags.slice(0, 3).map((t) => (
            <TagPill
              key={t}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick(t);
              }}
            >
              #{t}
            </TagPill>
          ))}
          {bug.tags.length > 3 && <TagPill variant="ghost">+{bug.tags.length - 3}</TagPill>}
          {bug.duplicateCount > 0 && (
            <span className="bug-row__dup">
              <Icon.copy /> {bug.duplicateCount} duplicate{bug.duplicateCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <div>
        <StatusBadge status={bug.status} />
      </div>
      <div className="bug-row__sev">
        <SeverityDot severity={bug.severity} withLabel />
      </div>
      {score !== undefined ? (
        <div className="bug-row__score">
          <span className="sim-bar">
            <span>{Math.round(score * 100)}%</span>
            <span className="sim-bar__track">
              <span className="sim-bar__fill" style={{ width: score * 100 + "%" }} />
            </span>
          </span>
        </div>
      ) : (
        <div className="bug-row__reporter">
          <Avatar name={bug.reporter.name} size="sm" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "var(--app-ink)", fontWeight: 500 }}>{bug.reporter.name}</span>
            <span style={{ fontSize: 11 }}>{relativeTime(bug.createdAt)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
  onReport,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onReport: () => void;
}) {
  return (
    <div
      className="app-card"
      style={{
        textAlign: "center",
        padding: "56px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--app-surface-2)",
          display: "grid",
          placeItems: "center",
          color: "var(--app-ink-muted)",
        }}
      >
        <Icon.bug width="24" height="24" />
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--app-ink-strong)" }}>
        {hasFilters ? "No bugs match those filters" : "No bugs reported yet"}
      </div>
      <div style={{ fontSize: 13, color: "var(--app-ink-muted)", maxWidth: 320 }}>
        {hasFilters
          ? "Try clearing your filters or broadening the search."
          : "When something goes wrong, file it here. Similar reports will surface automatically."}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {hasFilters && (
          <button className="btn btn--ghost btn--sm" onClick={onClear}>
            Clear filters
          </button>
        )}
        <button className="btn btn--primary btn--sm" onClick={onReport}>
          <Icon.plus /> Report a bug
        </button>
      </div>
    </div>
  );
}
