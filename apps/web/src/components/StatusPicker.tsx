import { useEffect, useRef, useState } from "react";
import { StatusBadge, Icon } from "./ui";
import type { BugStatus } from "../types";

const ORDER: BugStatus[] = ["new", "invest", "progress", "fixed", "needs", "cantrepro"];

interface Props {
  status: BugStatus;
  hasResolution: boolean;
  onChange: (next: BugStatus, resolution?: string) => Promise<void> | void;
}

export function StatusPicker({ status, hasResolution, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pendingFixed, setPendingFixed] = useState(false);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open && !pendingFixed) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPendingFixed(false);
        setResolution("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, pendingFixed]);

  async function pick(next: BugStatus) {
    if (next === status) {
      setOpen(false);
      return;
    }
    if (next === "fixed" && !hasResolution) {
      setOpen(false);
      setPendingFixed(true);
      return;
    }
    setBusy(true);
    try {
      await onChange(next);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function commitFixed() {
    setBusy(true);
    try {
      await onChange("fixed", resolution.trim() || undefined);
    } finally {
      setBusy(false);
      setPendingFixed(false);
      setResolution("");
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        style={{
          background: "transparent",
          border: 0,
          padding: 0,
          cursor: busy ? "wait" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
        aria-label="Change status"
      >
        <StatusBadge status={status} />
        <Icon.arrowRight
          width="10"
          height="10"
          style={{ transform: "rotate(90deg)", color: "var(--app-ink-muted)" }}
        />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: 10,
            boxShadow: "var(--shadow-pop)",
            padding: 6,
            zIndex: 10,
            minWidth: 180,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              style={{
                background: s === status ? "var(--app-hover)" : "transparent",
                border: 0,
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--app-ink)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--app-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  s === status ? "var(--app-hover)" : "transparent")
              }
            >
              <StatusBadge status={s} />
              {s === status && (
                <span style={{ marginLeft: "auto", color: "var(--app-ink-muted)", fontSize: 11 }}>
                  current
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {pendingFixed && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: 12,
            boxShadow: "var(--shadow-pop)",
            padding: 16,
            zIndex: 10,
            width: 360,
          }}
        >
          <div className="detail-section__label" style={{ marginBottom: 8 }}>
            What was the fix?
          </div>
          <textarea
            className="app-textarea app-textarea--sm"
            placeholder="One line is fine — what change resolved this?"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            autoFocus
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setPendingFixed(false);
                setResolution("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={commitFixed}
              disabled={busy}
            >
              {busy ? "Saving…" : "Mark fixed"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
