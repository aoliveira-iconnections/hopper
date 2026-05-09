import { useState } from "react";
import { Avatar, Icon } from "../ui";
import { api } from "../../lib/api";
import type { User } from "../../types";

interface Props {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogin: (user: User) => void;
}

export function Login({ theme, onToggleTheme, onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid work email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await api.login(email.trim(), password, remember);
      onLogin(user);
    } catch (err) {
      console.error(err);
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        className="icon-btn login-theme"
        onClick={onToggleTheme}
        aria-label="Toggle theme"
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Icon.sun /> : <Icon.moon />}
      </button>

      <div className="login-stage">
        <div className="login-stage__form">
          <div className="login-card">
            <div className="login-brand">
              <span className="login-brand__mark">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="6" y="6" width="12" height="14" rx="6" />
                  <path d="M12 6v14" /><path d="M3 13h3" /><path d="M18 13h3" />
                </svg>
              </span>
              <span title="Named for Grace Hopper, who found the first computer bug — a moth in the Mark II, 1947.">
                Hopper
              </span>
            </div>

            <div>
              <h1 className="login-title">Welcome back</h1>
              <p className="login-sub">Sign in to file and triage bugs across your team.</p>
            </div>

            {error && (
              <div className="login-error">
                <Icon.alert width="14" height="14" />
                <span>{error}</span>
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label className="field__label" htmlFor="email">
                  Work email
                </label>
                <input
                  id="email"
                  className="app-input"
                  type="email"
                  placeholder="you@iconnections.io"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <div className="field__row">
                  <label className="field__label" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    className="login-link"
                    onClick={(e) => e.preventDefault()}
                    disabled
                    style={{ opacity: 0.55, cursor: "not-allowed" }}
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  className="app-input"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="login-row">
                <label className="login-checkbox">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Keep me signed in</span>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--lg"
                style={{ width: "100%" }}
                disabled={submitting}
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="login-divider">or</div>

            <div className="login-sso">
              <button
                className="login-sso-btn"
                type="button"
                disabled
                aria-disabled="true"
                title="Coming soon"
              >
                <Icon.slack />
                Continue with Slack
                <span className="login-sso-soon">Soon</span>
              </button>
              <button
                className="login-sso-btn"
                type="button"
                disabled
                aria-disabled="true"
                title="Coming soon"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                </svg>
                Continue with SSO
                <span className="login-sso-soon">Soon</span>
              </button>
            </div>

            <div className="login-footer">
              New to Hopper?{" "}
              <button
                type="button"
                className="login-link"
                onClick={(e) => e.preventDefault()}
              >
                Request access
              </button>
            </div>
          </div>
        </div>

        <aside className="login-stage__brand">
          <div>
            <span className="brand-eyebrow">Internal · iConnections</span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 32,
              position: "relative",
              zIndex: 1,
            }}
          >
            <h2 className="brand-headline">
              File a bug. We'll <em>find the duplicates</em> before you do.
            </h2>

            <div className="brand-quote-card">
              <p className="brand-quote">
                "It killed our 'is this already filed?' Slack thread. Triage just… happens now."
              </p>
              <div className="brand-quote-author">
                <Avatar name="Pelé Nascimento" />
                <div>
                  <div className="brand-quote-author__name">Pelé Nascimento</div>
                  <div className="brand-quote-author__role">Engineering Lead</div>
                </div>
              </div>
            </div>
          </div>

          <div className="brand-stats-mini">
            <div className="brand-stat-mini">
              <span className="brand-stat-mini__num">142</span>
              <span className="brand-stat-mini__label">Bugs triaged</span>
            </div>
            <div className="brand-stat-mini">
              <span className="brand-stat-mini__num">38</span>
              <span className="brand-stat-mini__label">Dupes caught</span>
            </div>
            <div className="brand-stat-mini">
              <span className="brand-stat-mini__num">2.1d</span>
              <span className="brand-stat-mini__label">Avg time to fix</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
