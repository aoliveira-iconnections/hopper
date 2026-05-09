import { Link, useLocation } from "react-router-dom";
import { Avatar, Icon } from "./ui";
import { PRESET_TAGS } from "../lib/constants";
import type { Bug, User } from "../types";

interface SidebarProps {
  bugs: Bug[];
  theme: "light" | "dark";
  onToggleTheme: () => void;
  currentUser: User;
  onLogout: () => void;
}

export function Sidebar({
  bugs,
  theme,
  onToggleTheme,
  currentUser,
  onLogout,
}: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentAssigneeId = new URLSearchParams(location.search).get("assigneeId");

  function isItemActive(to: string): boolean {
    const url = new URL(to, "http://x");
    if (url.pathname !== currentPath) return false;
    const targetAssigneeId = url.searchParams.get("assigneeId");
    if (url.pathname === "/bugs") {
      // Distinguish "Bugs" (no assignee filter) from "My queue" (assignee=me).
      return (currentAssigneeId ?? null) === (targetAssigneeId ?? null);
    }
    return true;
  }

  const openCount = bugs.filter(
    (b) => !["fixed", "cantrepro"].includes(b.status) && !b.duplicateOf,
  ).length;
  const myQueueCount = bugs.filter(
    (b) =>
      !["fixed", "cantrepro"].includes(b.status) &&
      !b.duplicateOf &&
      b.assignee?.id === currentUser.id,
  ).length;

  const items: { to: string; label: string; icon: JSX.Element; count?: number }[] = [
    { to: "/dashboard", label: "Dashboard", icon: <Icon.home /> },
    { to: "/bugs", label: "Bugs", icon: <Icon.list />, count: openCount },
    {
      to: `/bugs?assigneeId=${currentUser.id}`,
      label: "My queue",
      icon: <Icon.bug />,
      count: myQueueCount,
    },
    { to: "/report", label: "Report bug", icon: <Icon.plus /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="6" width="12" height="14" rx="6" />
            <path d="M12 6v14" /><path d="M3 13h3" /><path d="M18 13h3" />
          </svg>
        </span>
        <span title="Named for Grace Hopper, who found the first computer bug — a moth in the Mark II, 1947.">
          Hopper
        </span>
      </div>

      <div className="sidebar__section-label">Workspace</div>
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          className={`nav-item ${isItemActive(it.to) ? "is-active" : ""}`}
        >
          {it.icon}
          <span>{it.label}</span>
          {it.count !== undefined && <span className="nav-item__count">{it.count}</span>}
        </Link>
      ))}

      <div className="sidebar__section-label">Tags</div>
      {PRESET_TAGS.map((tag) => {
        const n = bugs.filter((b) => !b.duplicateOf && b.tags.includes(tag)).length;
        return (
          <Link
            key={tag}
            to={`/bugs?tag=${encodeURIComponent(tag)}`}
            className="nav-item"
            style={{ fontSize: 13 }}
          >
            <span style={{ color: "var(--app-ink-muted)" }}>#</span>
            <span>{tag}</span>
            <span className="nav-item__count">{n}</span>
          </Link>
        );
      })}

      <div className="sidebar__user">
        <Avatar name={currentUser.name} />
        <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--app-ink-strong)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {currentUser.name}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--app-ink-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {currentUser.role}
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Icon.sun /> : <Icon.moon />}
        </button>
        <button
          className="icon-btn"
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out"
        >
          <Icon.logout />
        </button>
      </div>
    </aside>
  );
}
