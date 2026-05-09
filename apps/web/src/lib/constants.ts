import type { BugStatus, Severity, WhenHint } from "../types";

export const STATUSES: Record<BugStatus, { label: string; cls: string }> = {
  new:        { label: "New",            cls: "s-badge--new" },
  invest:     { label: "Investigating",  cls: "s-badge--invest" },
  progress:   { label: "In progress",    cls: "s-badge--progress" },
  fixed:      { label: "Fixed",          cls: "s-badge--fixed" },
  cantrepro:  { label: "Can't reproduce",cls: "s-badge--cantrepro" },
  needs:      { label: "Needs info",     cls: "s-badge--needs" },
};

export const SEVERITIES: Record<Severity, { label: string; cls: string }> = {
  low:      { label: "Low",      cls: "sev--low" },
  medium:   { label: "Medium",   cls: "sev--medium" },
  high:     { label: "High",     cls: "sev--high" },
  critical: { label: "Critical", cls: "sev--critical" },
};

export const PRESET_TAGS = ["copilot", "dashboard", "auth", "payments"];
export const WHEN_OPTIONS: WhenHint[] = ["Just now", "Earlier today", "Yesterday", "Specific time"];
export const SEV_OPTIONS: Severity[] = ["low", "medium", "high", "critical"];
