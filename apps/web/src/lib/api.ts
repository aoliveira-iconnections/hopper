import type {
  Attachment,
  Bug,
  BugStatus,
  Comment,
  Severity,
  SimilarHit,
  User,
} from "../types";

export const ATTACHMENT_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxFilesPerRequest: 5,
  allowedMime: [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "application/json",
  ],
};

export interface BugListFilters {
  status?: BugStatus;
  severity?: Severity;
  tag?: string;
  reporterId?: number;
  assigneeId?: number;
  q?: string;
  excludeDuplicates?: boolean;
  limit?: number;
  cursor?: string;
}

export interface BugListPage {
  items: Bug[];
  nextCursor: string | null;
}

export interface DashboardStats {
  openCount: number;
  filedToday: number;
  filedThisWeek: number;
  criticalCount: number;
  dupesCaught: number;
  fixedCount: number;
  byStatus: Record<BugStatus, number>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(res.status, `${method} ${url} ${res.status}: ${text}`);
  }
  return res.json();
}

function toQueryString(params: object) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false) continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const api = {
  listBugs: (filters: BugListFilters = {}) =>
    http<BugListPage>("GET", `/api/bugs${toQueryString(filters)}`),
  searchBugs: (q: string, limit?: number) =>
    http<SimilarHit[]>("POST", "/api/bugs/search", { q, ...(limit ? { limit } : {}) }),
  listUsers: () => http<User[]>("GET", "/api/users"),
  getBug: (id: number) => http<Bug>("GET", `/api/bugs/${id}`),
  similar: (query: string) =>
    http<SimilarHit[]>("POST", "/api/bugs/similar", { query }),
  createBug: (input: {
    title: string;
    what: string;
    expected: string;
    affected: string;
    url: string;
    when: string;
    severity: Severity;
    tags: string[];
    asDuplicateOf: number | null;
  }) => http<Bug>("POST", "/api/bugs", input),
  updateBug: (
    id: number,
    patch: {
      status?: BugStatus;
      resolution?: string | null;
      assigneeId?: number | null;
    },
  ) => http<Bug>("PATCH", `/api/bugs/${id}`, patch),
  suggestTitle: (what: string) =>
    http<{ title: string }>("POST", "/api/ai/title", { what }),
  suggestTags: (text: string) =>
    http<{ tags: string[] }>("POST", "/api/ai/tags", { text }),
  summary: (input: { title: string; what: string; additionalReports?: string[] }) =>
    http<{ summary: string }>("POST", "/api/ai/summary", input),
  suggestSeverity: (text: string) =>
    http<{ severity: Severity | null }>("POST", "/api/ai/severity", { text }),
  dashboardStats: () => http<DashboardStats>("GET", "/api/stats/dashboard"),
  login: (email: string, password: string, remember: boolean) =>
    http<{ user: User }>("POST", "/api/auth/login", { email, password, remember }),
  me: () => http<{ user: User }>("GET", "/api/auth/me"),
  logout: () => http<{ ok: true }>("POST", "/api/auth/logout"),
  listAttachments: (bugId: number) =>
    http<Attachment[]>("GET", `/api/bugs/${bugId}/attachments`),
  uploadAttachments: async (bugId: number, files: File[]): Promise<Attachment[]> => {
    const fd = new FormData();
    for (const f of files) fd.append("file", f, f.name);
    const res = await fetch(`/api/bugs/${bugId}/attachments`, {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new HttpError(res.status, `upload failed ${res.status}: ${text}`);
    }
    return res.json();
  },
  deleteAttachment: (id: number) =>
    http<{ ok: true }>("DELETE", `/api/attachments/${id}`),
  attachmentUrl: (id: number) => `/api/attachments/${id}`,
  listComments: (bugId: number) =>
    http<Comment[]>("GET", `/api/bugs/${bugId}/comments`),
  createComment: (bugId: number, body: string) =>
    http<Comment>("POST", `/api/bugs/${bugId}/comments`, { body }),
  updateComment: (id: number, body: string) =>
    http<Comment>("PATCH", `/api/comments/${id}`, { body }),
  deleteComment: (id: number) =>
    http<{ ok: true }>("DELETE", `/api/comments/${id}`),
};
