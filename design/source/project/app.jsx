/* Bug Triage — main app shell */
/* eslint-disable no-undef */

const { useState: useStateApp, useEffect: useEffectApp } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "density": "balanced"
}/*EDITMODE-END*/;

function App() {
  const t = useTweaks(TWEAK_DEFAULTS);
  const [bugs, setBugs] = useStateApp(SEED_BUGS);
  const [screen, setScreen] = useStateApp("dashboard");
  const [selectedBugId, setSelectedBugId] = useStateApp(null);
  const [confirmResult, setConfirmResult] = useStateApp(null);

  useEffectApp(() => {
    document.documentElement.dataset.theme = t.theme;
  }, [t.theme]);

  function nav(target, bugId) {
    setScreen(target);
    if (bugId !== undefined) setSelectedBugId(bugId);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleSubmit(newBug, duplicateOfId) {
    if (duplicateOfId) {
      const linked = { ...newBug, duplicateOf: duplicateOfId };
      setBugs(prev => prev.map(b =>
        b.id === duplicateOfId ? { ...b, duplicateCount: b.duplicateCount + 1 } : b
      ).concat(linked));
      setConfirmResult({ newBug: linked, duplicateOfId });
    } else {
      setBugs(prev => [newBug, ...prev]);
      setConfirmResult({ newBug, duplicateOfId: null });
    }
    nav("confirm");
  }

  const selected = bugs.find(b => b.id === selectedBugId);

  return (
    <div className="shell">
      <Sidebar current={screen} onNav={nav} bugs={bugs} theme={t.theme} setTweak={t.setTweak} />
      {screen === "dashboard" && <DashboardScreen bugs={bugs} onNav={nav} />}
      {screen === "submit" && <SubmitScreen bugs={bugs} onSubmit={handleSubmit} onCancel={() => nav("dashboard")} />}
      {screen === "list" && <ListScreen bugs={bugs} onNav={nav} />}
      {screen === "detail" && <DetailScreen bug={selected} bugs={bugs} onNav={nav} />}
      {screen === "confirm" && <ConfirmScreen result={confirmResult} bugs={bugs} onNav={nav} />}
    </div>
  );
}

function Sidebar({ current, onNav, bugs, theme, setTweak }) {
  const openCount = bugs.filter(b => !["fixed","cantrepro"].includes(b.status) && !b.duplicateOf).length;
  const items = [
    { key: "dashboard", label: "Dashboard", icon: <Icon.home /> },
    { key: "list",      label: "Bugs",      icon: <Icon.list />, count: openCount },
    { key: "submit",    label: "Report bug", icon: <Icon.plus />, primary: true },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="6" width="12" height="14" rx="6"/>
            <path d="M12 6v14"/><path d="M3 13h3"/><path d="M18 13h3"/>
          </svg>
        </span>
        <span>Bug Triage</span>
      </div>

      <div className="sidebar__section-label">Workspace</div>
      {items.map(it => (
        <div
          key={it.key}
          className={`nav-item ${current === it.key ? "is-active" : ""}`}
          onClick={() => onNav(it.key)}
        >
          {it.icon}
          <span>{it.label}</span>
          {it.count !== undefined && <span className="nav-item__count">{it.count}</span>}
        </div>
      ))}

      <div className="sidebar__section-label">Tags</div>
      {PRESET_TAGS.map(tag => {
        const n = bugs.filter(b => !b.duplicateOf && b.tags.includes(tag)).length;
        return (
          <div key={tag} className="nav-item" onClick={() => onNav("list")} style={{ fontSize: 13 }}>
            <span style={{ color:"var(--app-ink-muted)" }}>#</span>
            <span>{tag}</span>
            <span className="nav-item__count">{n}</span>
          </div>
        );
      })}

      <div className="sidebar__user">
        <Avatar name="Maya Patel" />
        <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color:"var(--app-ink-strong)" }}>Maya Patel</span>
          <span style={{ fontSize: 11, color:"var(--app-ink-muted)" }}>Customer Success</span>
        </div>
        <button
          className="icon-btn"
          onClick={() => setTweak("theme", theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Icon.sun /> : <Icon.moon />}
        </button>
      </div>
    </aside>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
