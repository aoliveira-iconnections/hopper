/* Dashboard, List, Detail, Confirmation screens */
/* eslint-disable no-undef */

const { useState: useState2, useMemo: useMemo2 } = React;

/* ─────────── Dashboard ─────────── */
function DashboardScreen({ bugs, onNav }) {
  const open = bugs.filter(b => !["fixed", "cantrepro"].includes(b.status) && !b.duplicateOf);
  const newCount = bugs.filter(b => b.status === "new" && !b.duplicateOf).length;
  const critCount = bugs.filter(b => b.severity === "critical" && !["fixed","cantrepro"].includes(b.status)).length;
  const recent = [...bugs].filter(b => !b.duplicateOf).sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
  const clusters = bugs.filter(b => b.duplicateCount > 0).sort((a,b) => b.duplicateCount - a.duplicateCount).slice(0, 3);

  return (
    <div className="main">
      <section className="dash-hero">
        <div>
          <span className="t-eyebrow" style={{ color:"rgba(255,255,255,0.85)" }}>Bug Triage</span>
          <h1>Good afternoon, Maya.</h1>
          <p>{open.length} open bugs across the platform. We'll find duplicates as you file.</p>
          <div className="dash-hero__cta">
            <button className="btn btn--primary btn--lg" onClick={() => onNav("submit")} style={{ background:"#fff", color:"var(--purple-700)" }}>
              <Icon.plus style={{ marginRight: 4 }}/> Report a bug
            </button>
            <button className="btn btn--outline btn--on-dark btn--lg" onClick={() => onNav("list")}>
              Browse all bugs
            </button>
          </div>
        </div>
        <div className="dash-hero__stats">
          <div className="dash-stat">
            <div className="dash-stat__num">{open.length}</div>
            <div className="dash-stat__label">Open</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__num">{newCount}</div>
            <div className="dash-stat__label">New today</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__num">{critCount}</div>
            <div className="dash-stat__label">Critical</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat__num">{bugs.reduce((s,b) => s + b.duplicateCount, 0)}</div>
            <div className="dash-stat__label">Dupes caught</div>
          </div>
        </div>
      </section>

      <section className="dash-grid">
        <div className="app-card">
          <div className="dash-section-head">
            <h2>Recent reports</h2>
            <a href="#" onClick={(e) => { e.preventDefault(); onNav("list"); }}>View all →</a>
          </div>
          <div className="activity">
            {recent.map(bug => (
              <div key={bug.id} className="activity-item" onClick={() => onNav("detail", bug.id)}>
                <Avatar name={bug.reporter} size="sm" />
                <div style={{ minWidth: 0 }}>
                  <div className="activity-item__title">{bug.title}</div>
                  <div className="activity-item__meta">
                    <StatusBadge status={bug.status} />
                    <SeverityDot severity={bug.severity} />
                    <span>· {bug.reporter}</span>
                    <span>· {relativeTime(bug.createdAt)}</span>
                  </div>
                </div>
                <Icon.arrowRight style={{ color: "var(--app-ink-muted)" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="app-card">
          <div className="dash-section-head">
            <h2>Active clusters</h2>
            <span className="field__hint">Bugs with linked dupes</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap: 10 }}>
            {clusters.map(bug => (
              <div key={bug.id} className="cluster-card" onClick={() => onNav("detail", bug.id)}>
                <div className="cluster-card__head">
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bug.title}</span>
                  <span className="cluster-card__count">{bug.duplicateCount + 1}</span>
                </div>
                <div className="cluster-card__sub">
                  {bug.duplicateCount} duplicate report{bug.duplicateCount === 1 ? "" : "s"} · #{bug.id} · {bug.tags.map(t => "#" + t).join(" ")}
                </div>
              </div>
            ))}
            {clusters.length === 0 && (
              <div style={{ padding: 16, color:"var(--app-ink-muted)", fontSize: 13 }}>
                No active clusters yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ─────────── List ─────────── */
function ListScreen({ bugs, onNav }) {
  const [statusFilter, setStatusFilter] = useState2("all");
  const [sevFilter, setSevFilter] = useState2("all");
  const [search, setSearch] = useState2("");

  const visibleBugs = useMemo2(() => {
    let list = bugs.filter(b => !b.duplicateOf);
    if (statusFilter !== "all") list = list.filter(b => b.status === statusFilter);
    if (sevFilter !== "all") list = list.filter(b => b.severity === sevFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => (b.title + " " + b.what).toLowerCase().includes(q));
    }
    return list.sort((a,b) => b.createdAt - a.createdAt);
  }, [bugs, statusFilter, sevFilter, search]);

  return (
    <div className="main">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bugs</h1>
          <p className="page-subtitle">{visibleBugs.length} of {bugs.filter(b => !b.duplicateOf).length} bugs shown</p>
        </div>
        <button className="btn btn--primary" onClick={() => onNav("submit")}>
          <Icon.plus /> Report new bug
        </button>
      </div>

      <div className="filter-row">
        <div className="filter-search">
          <span className="filter-search__icon"><Icon.search /></span>
          <input
            className="app-input"
            placeholder="Search title or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterGroup
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[["all","All"], ...Object.entries(STATUSES).map(([k,v]) => [k, v.label])]}
        />
        <FilterGroup
          label="Severity"
          value={sevFilter}
          onChange={setSevFilter}
          options={[["all","All"], ...Object.entries(SEVERITIES).map(([k,v]) => [k, v.label])]}
          colorize
        />
      </div>

      {visibleBugs.length > 0 ? (
        <div className="bug-table">
          <div className="bug-table__head">
            <span>Bug</span>
            <span>Status</span>
            <span>Severity</span>
            <span>Reporter</span>
          </div>
          {visibleBugs.map(bug => (
            <BugRow key={bug.id} bug={bug} onClick={() => onNav("detail", bug.id)} />
          ))}
        </div>
      ) : (
        <div className="app-card" style={{ textAlign:"center", padding: "48px 24px" }}>
          <div style={{ fontSize: 15, color:"var(--app-ink-muted)" }}>No bugs match those filters.</div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, value, onChange, options, colorize }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap: 6 }}>
      <span className="field__hint" style={{ marginRight: 4 }}>{label}:</span>
      <div style={{ display:"flex", gap: 4 }}>
        {options.map(([k, lbl]) => (
          <button
            key={k}
            className={`chip chip--mini ${value === k ? "is-selected" : ""}`}
            onClick={() => onChange(k)}
            type="button"
          >
            {colorize && k !== "all" && (
              <span className="chip__sev-dot" style={{ background: value === k ? "rgba(255,255,255,0.95)" : `var(--sev-${k})` }} />
            )}
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function BugRow({ bug, onClick }) {
  return (
    <div className="bug-row" onClick={onClick}>
      <div className="bug-row__title">
        <div className="bug-row__title-line">
          <span className="bug-row__id">#{bug.id}</span>
          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{bug.title}</span>
        </div>
        <div className="bug-row__tags">
          {bug.tags.slice(0, 3).map(t => <TagPill key={t}>#{t}</TagPill>)}
          {bug.tags.length > 3 && <TagPill variant="ghost">+{bug.tags.length - 3}</TagPill>}
          {bug.duplicateCount > 0 && (
            <span className="bug-row__dup">
              <Icon.copy /> {bug.duplicateCount} duplicate{bug.duplicateCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>
      <div><StatusBadge status={bug.status} /></div>
      <div className="bug-row__sev"><SeverityDot severity={bug.severity} withLabel /></div>
      <div className="bug-row__reporter">
        <Avatar name={bug.reporter} size="sm" />
        <div style={{ display:"flex", flexDirection:"column" }}>
          <span style={{ color:"var(--app-ink)", fontWeight: 500 }}>{bug.reporter}</span>
          <span style={{ fontSize: 11 }}>{relativeTime(bug.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Detail ─────────── */
function DetailScreen({ bug, bugs, onNav }) {
  if (!bug) {
    return (
      <div className="main">
        <p>Bug not found.</p>
        <button className="btn btn--ghost" onClick={() => onNav("list")}><Icon.arrowLeft /> Back</button>
      </div>
    );
  }
  const parent = bug.duplicateOf ? bugs.find(b => b.id === bug.duplicateOf) : null;
  const dupes = bugs.filter(b => b.duplicateOf === bug.id);

  return (
    <div className="main">
      <button className="btn btn--ghost btn--sm" onClick={() => onNav("list")} style={{ marginBottom: 16 }}>
        <Icon.arrowLeft /> All bugs
      </button>

      {parent && (
        <div className="detail-banner">
          <Icon.copy />
          <span>
            Duplicate of <a href="#" onClick={(e) => { e.preventDefault(); onNav("detail", parent.id); }}>#{parent.id} {parent.title}</a>
          </span>
        </div>
      )}

      <div style={{ display:"flex", alignItems:"flex-start", gap: 16, marginBottom: 8 }}>
        <span className="bug-row__id" style={{ marginTop: 10 }}>#{bug.id}</span>
        <h1 className="page-title" style={{ flex: 1 }}>{bug.title}</h1>
      </div>
      <div className="flex-row" style={{ marginBottom: 24, gap: 10 }}>
        <StatusBadge status={bug.status} />
        <SeverityDot severity={bug.severity} withLabel />
        <span style={{ color: "var(--app-ink-muted)", fontSize: 13 }}>·</span>
        <Avatar name={bug.reporter} size="sm" />
        <span style={{ fontSize: 13, color: "var(--app-ink)" }}>{bug.reporter}</span>
        <span style={{ fontSize: 13, color: "var(--app-ink-muted)" }}>· {relativeTime(bug.createdAt)} · {bug.when}</span>
        <span style={{ marginLeft:"auto", display:"flex", gap: 6 }}>
          {bug.tags.map(t => <TagPill key={t}>#{t}</TagPill>)}
        </span>
      </div>

      <div className="detail-grid">
        <div>
          <div className="detail-section">
            <div className="detail-section__label">What happened</div>
            <div className="detail-prose">{bug.what}</div>
          </div>
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
              <a className="detail-link" href={bug.url} target="_blank" rel="noreferrer">{bug.url}</a>
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
            <div className="detail-section__label" style={{ marginBottom: 12 }}>Slack</div>
            <button className="btn btn--outline" style={{ width:"100%" }} onClick={(e) => e.preventDefault()}>
              <Icon.slack /> View in Slack
            </button>
            <div className="field__hint" style={{ marginTop: 10 }}>
              Posted to <strong style={{ color:"var(--app-ink)" }}>#bugs-triage</strong>
              {bug.duplicateCount > 0 && ` · ${bug.duplicateCount} reply${bug.duplicateCount === 1 ? "" : "ies"} from dupes`}
            </div>
          </div>

          {dupes.length > 0 && (
            <div className="app-card" style={{ padding: 18 }}>
              <div className="detail-section__label" style={{ marginBottom: 12 }}>
                Duplicate reports · {dupes.length}
              </div>
              <div className="dup-list">
                {dupes.map(d => (
                  <div key={d.id} className="dup-list-item">
                    <Avatar name={d.reporter} size="sm" />
                    <div className="flex-col">
                      <span className="dup-list-item__name">{d.reporter}</span>
                      <span style={{ fontSize: 11, color:"var(--app-ink-muted)" }}>#{d.id}</span>
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

/* ─────────── Confirmation ─────────── */
function ConfirmScreen({ result, bugs, onNav }) {
  if (!result) return null;
  const { newBug, duplicateOfId } = result;
  const parent = duplicateOfId ? bugs.find(b => b.id === duplicateOfId) : null;
  const isDup = !!parent;

  return (
    <div className="main">
      <div className="confirm-wrap">
        <div className={`confirm-icon ${isDup ? "confirm-icon--dup" : ""}`}>
          {isDup ? <Icon.copy width="32" height="32"/> : <Icon.check width="36" height="36"/>}
        </div>
        <h1 className="confirm-title">
          {isDup ? `Linked to bug #${parent.id}` : "Bug filed"}
        </h1>
        <p className="confirm-sub">
          {isDup
            ? "Your report was added as a duplicate. The Slack thread will be updated."
            : "Posted to #bugs-triage in Slack. Triagers have been notified."}
        </p>

        <div className="confirm-summary">
          {isDup ? (
            <>
              <div className="detail-section__label">Parent bug</div>
              <div style={{ fontSize: 16, fontWeight: 600, color:"var(--app-ink-strong)" }}>
                #{parent.id} {parent.title}
              </div>
              <div className="flex-row flex-row--gap-sm" style={{ flexWrap:"wrap" }}>
                <StatusBadge status={parent.status} />
                <SeverityDot severity={parent.severity} withLabel />
                {parent.tags.map(t => <TagPill key={t}>#{t}</TagPill>)}
              </div>
            </>
          ) : (
            <>
              <div className="detail-section__label">Filed as new</div>
              <div style={{ fontSize: 16, fontWeight: 600, color:"var(--app-ink-strong)" }}>
                #{newBug.id} {newBug.title}
              </div>
              <div className="flex-row flex-row--gap-sm" style={{ flexWrap:"wrap" }}>
                <StatusBadge status={newBug.status} />
                <SeverityDot severity={newBug.severity} withLabel />
                {newBug.tags.map(t => <TagPill key={t}>#{t}</TagPill>)}
              </div>
            </>
          )}
        </div>

        <div className="flex-row" style={{ gap: 10 }}>
          <button className="btn btn--outline" onClick={(e) => e.preventDefault()}>
            <Icon.slack /> View in Slack
          </button>
          <button className="btn btn--primary" onClick={() => onNav("detail", isDup ? parent.id : newBug.id)}>
            View bug details <Icon.arrowRight />
          </button>
        </div>
        <a href="#" onClick={(e) => { e.preventDefault(); onNav("submit"); }}
           style={{ color:"var(--app-ink-muted)", fontSize: 13, textDecoration:"none" }}>
          Report another bug
        </a>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardScreen, ListScreen, DetailScreen, ConfirmScreen });
