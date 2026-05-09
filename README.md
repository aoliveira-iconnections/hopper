# Hopper

AI-assisted bug triage tool. As you describe what happened, the backend embeds your text and runs vector similarity against every past bug to flag likely duplicates in real time. Triagers get URL-routed filters, semantic search, assignees, comments, attachments, and a live dashboard that updates across tabs.

> Named for **Grace Hopper**, who in 1947 logged "first actual case of bug being found" after taping a moth into the Mark II's logbook. Reading "bug" as a literal moth was the joke; reading it as a metaphor for software defects stuck.

## Stack

- **Web**: Vite + React + TypeScript, react-router, server-sent events for live updates
- **API**: Node + Fastify + TypeScript, cookie-signed sessions
- **DB**: Postgres 16 + `pgvector` (embeddings + ILIKE search + cursor pagination)
- **LLM**: Ollama running locally — no API keys, no cost
  - `nomic-embed-text` (768-dim embeddings — duplicate detection + semantic search)
  - `llama3.2:3b` (AI title, severity, tag suggestions, bug summary)
- **Slack**: optional (incoming webhook or bot token)

## Quickstart

```bash
cp .env.example .env

# SESSION_SECRET is required and ships empty — generate one:
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env

docker compose up -d
```

Then open <http://localhost:5173>.

**Login credentials** — all six demo users share the same password:

| Email                            | Name                | Role                |
| -------------------------------- | ------------------- | ------------------- |
| `marta@iconnections.io`          | Marta Vieira        | Customer Success    |
| `ronaldinho@iconnections.io`     | Ronaldinho Gaúcho   | Engineering         |
| `pele@iconnections.io`           | Pelé Nascimento     | Engineering Lead    |
| `kaka@iconnections.io`           | Kaká Leite          | Engineering         |
| `neymar@iconnections.io`         | Neymar Júnior       | Engineering         |
| `ronaldo@iconnections.io`        | Ronaldo Nazário     | Customer Success    |

Password: whatever you set as `DEMO_PASSWORD` in `.env` (default `bugtriage` from `.env.example`).

**First boot takes a few minutes** — the API container pulls `llama3.2:3b` (~2 GB) and `nomic-embed-text` (~270 MB). Watch progress:

```bash
docker logs -f hopper-api-1
```

Look for `[ollama] pulled llama3.2:3b`, `[ollama] pulled nomic-embed-text`, then `[embeddings] backfill complete`. After that, AI features are live. The app itself is usable before — only the duplicate panel and AI suggestions need the models.

## What's in the box

- **Real auth** — server-trusted cookie sessions; the client can't spoof `reporterId`
- **Bug submission** with AI title, severity, and tag suggestions; live duplicate detection as you type
- **Attachments** — drag-drop, paste-from-clipboard, image lightbox, uploader-only delete
- **Comments** with edit/delete by author
- **Assignees** + a "My queue" sidebar entry
- **Filters** — status, severity, tag, reporter, assignee, search — all synced to the URL
- **Smart search** — embedding-ranked semantic search ("metrics endpoint timeout" finds the dashboard cluster even without exact words)
- **Cursor pagination** on the bug list
- **Real-time** — SSE pushes `bug.created` / `bug.updated` to every tab; lists and detail re-render live
- **Dashboard** — pipeline strip across statuses, my queue, stale bugs, active duplicate clusters

## How it works

```
React (Vite, port 5173)
       │  /api/* proxied to API
       ▼
Fastify API (port 3000)        ─────────  cookie auth on every route except /api/auth/*
       │
       ├─ /api/auth/{login,me,logout}
       ├─ /api/bugs               → cursor-paginated list (filters: status, severity, tag, q, reporterId, assigneeId)
       ├─ /api/bugs/:id           → detail + status / assignee / resolution patch
       ├─ /api/bugs/similar       → embed query → top-3 dupe candidates (used during submit)
       ├─ /api/bugs/search        → embed query → semantic search across history
       ├─ /api/bugs/:id/comments
       ├─ /api/bugs/:id/attachments  (multipart upload, 10 MB / 5 files)
       ├─ /api/attachments/:id    → cookie-authed binary stream
       ├─ /api/users              → reporters with at least one bug
       ├─ /api/stats/dashboard    → counts by status + aggregate stats
       ├─ /api/ai/{title,tags,severity,summary}
       └─ /api/events             → SSE: bug.created / bug.updated
       │
       ├─ Postgres + pgvector   (8 demo bugs seeded on first boot)
       ├─ Ollama at :11434      (models pulled automatically)
       └─ Slack webhook / bot   (optional)
```

## Demo flow

1. Log in as Marta. The dashboard shows the pipeline strip, your queue, stale bugs, and recent reports.
2. Click **Report a bug**. Type `Dashboard charts not loading on Chrome` into "What happened" — within ~500 ms the duplicate panel surfaces #142 with a high similarity score. After a moment, AI fills in a suggested title, severity, and tags.
3. Drop a screenshot into the **Evidence** zone (or paste one from clipboard). Submit either as a duplicate of #142 or as a new bug.
4. Open any existing bug. Change its status, post a comment, assign it to Ronaldinho.
5. Open a second browser window logged in as Ronaldinho. Watch the bug list and detail update **without refresh** when Marta makes changes.
6. Click the **Smart** chip in the search bar and try `"two-factor codes don't validate"` — semantic ranking finds the TOTP bug even without keyword overlap.

## Slack (optional)

If `SLACK_BOT_TOKEN`/`SLACK_WEBHOOK_URL` aren't set, bug posts are silently skipped — the rest of the app still works.

**Mode A: bot token** (supports threaded replies for duplicates)

1. Create a Slack app at <https://api.slack.com/apps> → From scratch.
2. OAuth & Permissions → add `chat:write` to **Bot Token Scopes**.
3. Install to workspace, copy the **Bot User OAuth Token** (`xoxb-…`).
4. `/invite @your-app-name` in the target channel.
5. In `.env`: `SLACK_BOT_TOKEN=xoxb-…` and `SLACK_CHANNEL=C0123456789`.
6. `docker compose up -d --force-recreate api`.

**Mode B: incoming webhook** (no app install, no threading)

1. Create a webhook at <https://api.slack.com/messaging/webhooks>.
2. In `.env`: `SLACK_WEBHOOK_URL=https://hooks.slack.com/services/…`.
3. `docker compose up -d --force-recreate api`.

## Project structure

```
apps/api/
  src/db/                pool, migration runner, 6 SQL migrations, seed
  src/routes/            auth, bugs, ai, comments, attachments, events, stats, users
  src/services/          session (cookie auth), attachments (storage), events (pub/sub),
                         ollama, embeddings, slack
apps/web/
  src/components/        Sidebar, AssigneePicker, Attachments, Comments, StatusPicker, ui
  src/components/screens Dashboard, Submit, BugList, BugDetail, Confirm, Login
  src/lib/               api, realtime (SSE singleton), constants, time
  src/styles/            tokens.css, components.css, login.css, app.css
docker-compose.yml       db + ollama + api + web (+ uploads volume)
```

## Troubleshooting

**API logs show `Ollama setup failed`**
The api couldn't reach Ollama. Check `docker logs hopper-ollama-1`. First model pull can take 5+ minutes on a slow connection.

**Submit form's duplicate panel returns nothing**
Wait for `[embeddings] backfill complete` in `docker logs hopper-api-1`. Until it appears, no bugs have embeddings to compare against.

**API container exits immediately with `SESSION_SECRET is required`**
You skipped the `openssl rand -hex 32` step. See Quickstart.

**Web app shows "Loading…" forever**
`/api/bugs` failed. `curl http://localhost:3000/api/health` should return `{"ok":true}`. If the api container isn't ready, give it a few seconds.

## Reset

```bash
docker compose down -v   # nukes db, ollama models, and uploaded files
```
