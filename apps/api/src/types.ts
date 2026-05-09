export type BugStatus =
  | "new"
  | "invest"
  | "progress"
  | "fixed"
  | "cantrepro"
  | "needs";

export type Severity = "low" | "medium" | "high" | "critical";

export type WhenHint =
  | "Just now"
  | "Earlier today"
  | "Yesterday"
  | "Specific time";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface Bug {
  id: number;
  duplicateOf: number | null;
  title: string;
  what: string;
  expected: string;
  affected: string;
  url: string;
  when: WhenHint | string;
  severity: Severity;
  status: BugStatus;
  tags: string[];
  reporter: UserSummary;
  assignee: UserSummary | null;
  slackTs: string | null;
  slackChannel: string | null;
  resolution: string | null;
  duplicateCount: number;
  createdAt: number;
  updatedAt: number;
  resolvedAt: number | null;
}

interface BugRow {
  id: number;
  duplicate_of: number | null;
  title: string;
  what: string;
  expected: string;
  affected: string;
  url: string;
  when_hint: string;
  severity: Severity;
  status: BugStatus;
  tags: string[];
  reporter_id: number;
  reporter_name: string;
  reporter_email: string;
  reporter_role: string;
  assignee_user_id: number | null;
  assignee_name: string | null;
  assignee_email: string | null;
  assignee_role: string | null;
  slack_ts: string | null;
  slack_channel: string | null;
  resolution: string | null;
  duplicate_count: string | number;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
}

export function rowToBug(row: BugRow): Bug {
  return {
    id: row.id,
    duplicateOf: row.duplicate_of,
    title: row.title,
    what: row.what,
    expected: row.expected,
    affected: row.affected,
    url: row.url,
    when: row.when_hint,
    severity: row.severity,
    status: row.status,
    tags: row.tags,
    reporter: {
      id: row.reporter_id,
      name: row.reporter_name,
      email: row.reporter_email,
      role: row.reporter_role,
    },
    assignee: row.assignee_user_id
      ? {
          id: row.assignee_user_id,
          name: row.assignee_name!,
          email: row.assignee_email!,
          role: row.assignee_role!,
        }
      : null,
    slackTs: row.slack_ts,
    slackChannel: row.slack_channel,
    resolution: row.resolution,
    duplicateCount: Number(row.duplicate_count ?? 0),
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
    resolvedAt: row.resolved_at ? row.resolved_at.getTime() : null,
  };
}
