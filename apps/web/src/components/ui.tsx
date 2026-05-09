import type { ReactNode, MouseEvent, SVGProps } from "react";
import { STATUSES, SEVERITIES } from "../lib/constants";
import type { BugStatus, Severity } from "../types";

export function StatusBadge({ status }: { status: BugStatus }) {
  const s = STATUSES[status] ?? STATUSES.new;
  return <span className={`s-badge ${s.cls}`}>{s.label}</span>;
}

export function SeverityDot({
  severity,
  withLabel = false,
}: {
  severity: Severity;
  withLabel?: boolean;
}) {
  const s = SEVERITIES[severity] ?? SEVERITIES.low;
  return (
    <span className={`sev ${s.cls}`}>
      <span className="sev__dot"></span>
      {withLabel && <span className="sev__label">{s.label}</span>}
    </span>
  );
}

export function TagPill({
  children,
  variant,
  onClick,
  selected,
  ai,
}: {
  children: ReactNode;
  variant?: "accent" | "ghost";
  onClick?: (e: MouseEvent) => void;
  selected?: boolean;
  ai?: boolean;
}) {
  const cls = [
    "tagpill",
    variant === "accent" && "tagpill--accent",
    variant === "ghost" && "tagpill--ghost",
    onClick && "tagpill--button",
    selected && "tagpill--selected",
    ai && "tagpill--ai",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} onClick={onClick} role={onClick ? "button" : undefined}>
      {children}
    </span>
  );
}

export function Avatar({ name, size }: { name: string; size?: "sm" | "lg" }) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const cls = "avatar" + (size === "sm" ? " avatar--sm" : size === "lg" ? " avatar--lg" : "");
  return <span className={cls}>{initials}</span>;
}

type IconProps = SVGProps<SVGSVGElement>;

export const Icon = {
  bug: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M8 2l1.5 1.5" /><path d="M16 2l-1.5 1.5" />
      <rect x="6" y="6" width="12" height="14" rx="6" />
      <path d="M12 6v14" /><path d="M3 13h3" /><path d="M18 13h3" />
      <path d="M3 8l3 2" /><path d="M21 8l-3 2" />
      <path d="M3 18l3-2" /><path d="M21 18l-3-2" />
    </svg>
  ),
  list: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  plus: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  home: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z" />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  arrowRight: (p: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  arrowLeft: (p: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  ),
  sparkle: (p: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2zM19 14l.9 2.7L22.6 18l-2.7.9L19 22l-.9-2.7L15.4 18l2.7-.9L19 14zM5 15l.6 1.8L7.4 18l-1.8.6L5 21l-.6-2.4L2.6 18l1.8-.6L5 15z" />
    </svg>
  ),
  slack: (p: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="9" width="6" height="6" rx="3" />
      <path d="M14 2v3a3 3 0 0 1-3 3H8" />
      <path d="M22 14h-3a3 3 0 0 1-3-3v-3" />
      <path d="M9 22v-3a3 3 0 0 1 3-3h3" />
      <rect x="16" y="2" width="6" height="6" rx="3" />
      <rect x="9" y="16" width="6" height="6" rx="3" />
      <rect x="16" y="9" width="6" height="6" rx="3" />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  copy: (p: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  alert: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  sun: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  ),
  moon: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  logout: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  upload: (p: IconProps) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  file: (p: IconProps) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};
