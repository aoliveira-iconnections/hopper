# Hopper — Features

A complete inventory of what Hopper does today. Everything below is in the running app; nothing here is roadmap.

## At a glance

- **AI-assisted bug filing** — duplicate detection, title/tag/severity suggestions, and summaries powered by a locally-hosted LLM.
- **Semantic search** over the entire bug history (pgvector + embeddings).
- **Real-time updates** across tabs and users (SSE).
- **Full triage workflow** — statuses, severities, assignees, threaded comments, attachments, resolution notes.
- **Real auth** — signed httpOnly session cookies, 6 demo users seeded at boot.
- **Zero hosted-API cost** — Ollama runs locally inside Docker; no OpenAI / Anthropic keys.

---

## Filing a bug (Submit screen)

The Submit form is the AI-heavy surface. As the reporter types:

- **Live duplicate detection.** After the description crosses a minimum length, the form debounces and calls `POST /api/bugs/similar`. The API embeds the in-progress text via `nomic-embed-text` and returns the top 3 existing bugs with cosine similarity ≥ 0.6. The reporter sees suggested matches inline and can **file as duplicate** in one click, attaching their report to the existing bug instead of creating noise.
- **AI title suggestion.** `POST /api/ai/title` — llama3.2:3b drafts a clean one-line title from the description (temp 0.3, max 60 tokens).
- **AI tag suggestion.** `POST /api/ai/tags` — llama3.2:3b classifies the bug into the preset tags (`copilot`, `dashboard`, `auth`, `payments`) at temp 0 for stability.
- **AI severity suggestion.** `POST /api/ai/severity` — llama3.2:3b classifies the bug as `low`, `medium`, `high`, or `critical`.
- **Drag-and-drop attachments.** Images, PDFs, plain text, JSON — up to 5 files, 10 MB each.
- **Manual override** of every AI suggestion is one click away. The AI proposes, the reporter decides.

Each AI call uses `AbortController` so stale calls are cancelled when the input changes.

---

## Triaging bugs (Bug list)

The bug list is the triager's workbench.

- **URL-synced filters.** Status, severity, tag, reporter, assignee, free-text query, and the "exclude duplicates" toggle all live in the URL — share a link, get the same view.
- **Smart search toggle.** Off → keyword search via `ILIKE` on title/description. On → semantic search via `POST /api/bugs/search`, which embeds the query and ranks bugs by cosine similarity (threshold 0.3, up to 50 results). Find "that dashboard timeout last quarter" without guessing the exact words.
- **Sorting.** Newest, severity, duplicate count, recent activity.
- **Cursor-based pagination.** Stable under writes (created_at DESC, id DESC). "Load more" pulls the next page without page-jumping.
- **Sidebar filters.** Tag pills + reporter list, both jump-to-filter.
- **Live refresh.** New bugs and updates land in the list without reload — see Real-time below.

---

## Working a bug (Bug detail)

- **AI summary.** Each bug gets a 2–3 sentence triage summary via `POST /api/ai/summary`. When duplicates are filed onto the bug, their descriptions are merged into the summary prompt — so the summary describes the *cluster*, not just the original report.
- **Threaded comments.** Add, edit, delete (author-only). Up to 5000 chars per comment.
- **Attachments panel.** List, preview (inline for images/PDFs), download, delete (uploader-only). Per-file 10 MB, 5 files per upload, allowed MIMEs: PNG / JPEG / GIF / WebP / PDF / TXT / JSON.
- **Status picker.** `new` → `invest` → `progress` → `fixed` (or `cantrepro` / `needs-info`). Status changes broadcast via SSE.
- **Severity badge** with a colored dot for at-a-glance triage.
- **Assignee picker.** Reassign to any user. Optional — bugs can sit unassigned.
- **Resolution notes.** When marked `fixed`, the resolution field is shown on the detail view as part of the audit trail.
- **Duplicate display.** If this bug is a duplicate, a banner links to its parent. If other reports are filed onto this bug, they appear as a "Other reports" cluster on the detail page.

---

## AI capabilities (in one place)

All AI runs locally inside Docker via Ollama. No API keys, no per-call cost.

| Endpoint | Model | Purpose |
| --- | --- | --- |
| `POST /api/bugs/similar` | `nomic-embed-text` | Live duplicate detection during filing (cosine sim ≥ 0.6, top 3) |
| `POST /api/bugs/search` | `nomic-embed-text` | Semantic search across all bugs (cosine sim ≥ 0.3, up to 50) |
| `POST /api/ai/title` | `llama3.2:3b` | Title draft from description |
| `POST /api/ai/tags` | `llama3.2:3b` | Tag classification (4 preset tags) |
| `POST /api/ai/severity` | `llama3.2:3b` | Severity classification (4 levels) |
| `POST /api/ai/summary` | `llama3.2:3b` | Triage summary (merges in duplicate reports) |

All calls accept an `AbortSignal` so cancelled work doesn't waste cycles.

### How embeddings actually work in the schema

Every bug has an `embedding vector(768)` column (pgvector). On create, the API embeds `title + description` via `nomic-embed-text` and stores the vector. When a bug is filed *as a duplicate* of an existing bug, the parent's embedding is **regenerated** from `parent.title + parent.description + all duplicates' descriptions`. So as the cluster grows, its semantic footprint widens — future similar reports are more likely to hit the cluster instead of slipping through.

On boot, a `backfillEmbeddings()` pass embeds any bug missing a vector. The repo's seed data is therefore vector-searchable from first boot.

---

## Real-time updates (SSE)

- **Transport.** Server-Sent Events at `GET /api/events` (Fastify `reply.hijack()` + an in-process `EventEmitter`).
- **Events.** `bug.created` and `bug.updated`, each carrying the full bug payload.
- **Keepalive.** 25-second `:ping` comment lines keep proxies happy.
- **Client.** A singleton `EventSource` lives in `apps/web/src/lib/realtime.ts`. The bug list subscribes and refreshes the current page on every event. Auto-reconnects on transient drops.
- **Scope.** Workspace-wide — open two tabs as different users and they see each other's writes immediately.

---

## Auth

- **Real session-based auth.** No mocks.
- **HMAC-SHA256 signed cookie** named `hopper_session`, format `{userId}.{signature}`, `httpOnly` + `sameSite=lax`.
- **Remember me.** Optional 30-day `maxAge`. Default: session cookie (cleared on browser close).
- **Constant-time password comparison.** No early-exit timing leak on login.
- **`requireAuth()` preHandler** guards every mutating endpoint.
- **6 demo users** seeded with the same password (`bugtriage` by default, configurable via `DEMO_PASSWORD`). Migration 007 renamed them to Brazilian football players — see the [README](README.md) for the table.

---

## Dashboard

- **Pipeline strip** — open counts at each status (`new`, `invest`, `progress`, `needs-info`).
- **Stat overlay** — open count, filed today, filed this week, critical count, duplicates caught, fixed count. One SQL query (`GET /api/stats/dashboard`) computes them all.
- **My queue** card — bugs assigned to the current user.
- **Stale bugs** card — open bugs untouched for too long.
- **Clusters** card — bugs with the most duplicates piling onto them.
- **Live refresh** via SSE — counters move in front of you.

---

## Slack (optional integration)

Out of the box, Hopper runs without Slack. If a workspace wants notifications, two modes are supported via env:

- **Bot token mode** (`SLACK_BOT_TOKEN` + `SLACK_CHANNEL`): full support including threaded replies for duplicates.
- **Incoming webhook mode** (`SLACK_WEBHOOK_URL`): simpler setup, but duplicates post as new top-level messages (webhooks don't return message timestamps).

When neither is configured, the Bug Detail page shows a "Slack — coming soon" placeholder.

---

## Infrastructure

- **One command to run everything** — `docker compose up` brings up:
  - `api` — Fastify v5 (Node 20)
  - `web` — Vite dev server
  - `db` — Postgres with pgvector extension
  - `ollama` — local LLM runtime with `OLLAMA_KEEP_ALIVE=24h` to avoid cold-start penalties
- **Migrations.** Idempotent SQL files in `apps/api/src/db/migrations/`, tracked in a `_migrations` table. Currently 7 migrations covering schema, users, attachments, comments, assignees, and the player rename.
- **Seed data.** ~10 representative bugs are seeded on first boot with realistic titles, descriptions, severities, reporters, and duplicate clusters — so the AI features have something interesting to find from the moment you log in.

---

## What's intentionally not here

- **External AI APIs.** Everything runs against local Ollama. The trade-off is latency (20–40s per call on a modest server), but the upside is privacy, zero cost, and zero rate limits.
- **Slack as a hard dependency.** Slack is optional; the app is fully usable without it.
- **Tenant isolation.** This is a single-workspace tool — all users see all bugs. Multi-tenancy is out of scope for the MVP.
