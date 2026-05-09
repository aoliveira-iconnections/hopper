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

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface Attachment {
  id: number;
  bugId: number;
  uploaderId: number;
  uploaderName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

export interface Comment {
  id: number;
  bugId: number;
  author: { id: number; name: string; email: string };
  body: string;
  createdAt: number;
  updatedAt: number;
  edited: boolean;
}

export interface SimilarHit {
  bug: Bug;
  score: number;
}
