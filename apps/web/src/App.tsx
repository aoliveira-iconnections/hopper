import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useOutletContext,
} from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/screens/Dashboard";
import { Submit } from "./components/screens/Submit";
import { BugList } from "./components/screens/BugList";
import { BugDetail } from "./components/screens/BugDetail";
import { Confirm } from "./components/screens/Confirm";
import { Login } from "./components/screens/Login";
import { api, HttpError } from "./lib/api";
import { onRealtime, startRealtime, stopRealtime } from "./lib/realtime";
import type { Bug, User } from "./types";

type Theme = "light" | "dark";

const THEME_KEY = "hopper:theme";

function readInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

export interface AppCtx {
  bugs: Bug[];
  setBugs: React.Dispatch<React.SetStateAction<Bug[]>>;
  refreshBugs: () => Promise<void>;
  currentUser: User;
}

export function useAppCtx() {
  return useOutletContext<AppCtx>();
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [bugsLoaded, setBugsLoaded] = useState(false);
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Bootstrap: ask the server who we are. The session cookie is httpOnly,
  // so the client can't read it directly — /api/auth/me is the source of truth.
  useEffect(() => {
    // Drop the pre-cookie "trust the client" identity store, if present.
    localStorage.removeItem("hopper:user");
    sessionStorage.removeItem("hopper:user");
    let cancelled = false;
    api
      .me()
      .then((r) => {
        if (!cancelled) setCurrentUser(r.user);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof HttpError && err.status === 401) {
          setCurrentUser(null);
        } else {
          console.error("Failed to bootstrap session:", err);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBugs = useCallback(async () => {
    const page = await api.listBugs();
    setBugs(page.items);
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setBugsLoaded(true);
      return;
    }
    setBugsLoaded(false);
    refreshBugs()
      .catch((err) => console.error("Failed to load bugs:", err))
      .finally(() => setBugsLoaded(true));
  }, [currentUser, refreshBugs]);

  // Real-time bug events: open the SSE connection while logged in and merge
  // server-pushed creates/updates into the global list.
  useEffect(() => {
    if (!currentUser) return;
    startRealtime();
    const off = onRealtime((event) => {
      setBugs((prev) => {
        const idx = prev.findIndex((b) => b.id === event.bug.id);
        if (event.type === "bug.created") {
          if (idx >= 0) return prev.map((b, i) => (i === idx ? event.bug : b));
          return [event.bug, ...prev];
        }
        if (idx < 0) return prev;
        return prev.map((b, i) => (i === idx ? event.bug : b));
      });
    });
    return () => {
      off();
      stopRealtime();
    };
  }, [currentUser]);

  function handleLogin(user: User) {
    setCurrentUser(user);
  }

  async function handleLogout() {
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    setCurrentUser(null);
    setBugs([]);
  }

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  if (!authChecked) {
    // Wait until /me resolves before rendering — avoids a login flash for users
    // who already have a valid session.
    return null;
  }

  if (!currentUser) {
    return <Login theme={theme} onToggleTheme={toggleTheme} onLogin={handleLogin} />;
  }

  const ctx: AppCtx = { bugs, setBugs, refreshBugs, currentUser };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Shell
              ctx={ctx}
              loaded={bugsLoaded}
              theme={theme}
              onToggleTheme={toggleTheme}
              onLogout={handleLogout}
            />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="bugs" element={<BugList />} />
          <Route path="bugs/:id" element={<BugDetail />} />
          <Route path="report" element={<Submit />} />
          <Route path="report/confirm" element={<Confirm />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function Shell({
  ctx,
  loaded,
  theme,
  onToggleTheme,
  onLogout,
}: {
  ctx: AppCtx;
  loaded: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="shell">
      <Sidebar
        bugs={ctx.bugs}
        theme={theme}
        onToggleTheme={onToggleTheme}
        currentUser={ctx.currentUser}
        onLogout={onLogout}
      />
      {!loaded ? (
        <div className="main">
          <p className="page-subtitle">Loading…</p>
        </div>
      ) : (
        <Outlet context={ctx} />
      )}
    </div>
  );
}
