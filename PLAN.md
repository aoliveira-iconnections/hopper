# Bug Triage Slack Bot — Implementation Plan

## Context

We're building an internal Slack bot that lives in our `#bugs` channel. Today, our Customer Success team reports bugs there as freeform messages, and our engineering team struggles with vague reports, missing context, and recurring issues. This bot replaces freeform reporting with structured intake, auto-enriches bugs with platform and error-tracking data, routes to the right team via tags, and tracks status through reactions.

## Goals (v1 / demo scope)

1. CS team reports bugs via a `/bug` slash command that opens a structured Slack modal.
2. Bot posts a clean, formatted bug card to the channel.
3. Bot auto-enriches the bug card with: affected user info from our platform, and recent errors from Datadog matching that user/timeframe.
4. **Bug reports include tags (e.g. `#copilot`, `#dashboard`, `#auth`). The bot routes notifications to the team(s) responsible for those tags.**
5. Reactions on the bug card update status (🔍 investigating, ⚙️ in progress, ✅ fixed, 🔁 can't reproduce, 📋 needs info).
6. When marked ✅ fixed, bot prompts the resolver for a one-line resolution summary and stores it.
7. All bugs + resolutions persisted in Postgres (foundation for future "have we seen this before" search).

## Out of scope for v1

- LLM-based similarity search across past bugs
- Automated clarifying questions
- Weekly digest summaries
- Web UI for managing tag → team mappings (config-file driven for v1)

## Tech stack

- **Language**: Node.js + TypeScript
- **Slack framework**: `@slack/bolt` in Socket Mode (no public webhook needed)
- **Database**: Postgres
- **Error tracking**: Datadog Logs API
- **Platform user lookup**: stub interface initially — will plug into our internal API later
- **Containerization**: Everything runs via Docker Compose (app + Postgres in one `docker compose up`)
- **Local dev**: hot reload inside the app container via volume mount + `tsx watch`

## Project structure

```
bug-triage-bot/
├── src/
│   ├── index.ts                    # Entry point, registers handlers
│   ├── config/
│   │   ├── env.ts                  # Validates and exports env vars
│   │   └── teams.ts                # Loads tag → team mapping from teams.yaml
│   ├── handlers/
│   │   ├── bugCommand.ts           # /bug slash command -> opens modal
│   │   ├── bugSubmission.ts        # Modal submission -> creates bug card
│   │   ├── reactionHandler.ts      # Reaction add/remove -> status updates
│   │   └── resolutionHandler.ts    # Captures `fix:` thread replies after ✅
│   ├── services/
│   │   ├── enrichment.ts           # Orchestrates platform + Datadog lookups
│   │   ├── platformUser.ts         # Looks up affected user (stub for v1)
│   │   ├── datadog.ts              # Queries Datadog Logs API for errors
│   │   ├── bugCard.ts              # Formats bug as Slack Block Kit message
│   │   ├── tagParser.ts            # Extracts #tags from text
│   │   └── teamNotifier.ts         # Notifies responsible teams based on tags
│   ├── db/
│   │   ├── pool.ts                 # pg connection pool
│   │   ├── migrate.ts              # Schema migration runner
│   │   └── bugRepo.ts              # CRUD for bugs table
│   ├── types/
│   │   └── bug.ts                  # Shared types
│   └── lib/
│       └── statusMap.ts            # Reaction emoji -> status mapping
├── teams.yaml                      # Tag -> team config (see below)
├── slack-app-manifest.yaml         # Slack app config
├── docker-compose.yml              # App + Postgres
├── Dockerfile                      # App image (dev + prod stages)
├── .dockerignore
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Docker setup

**`Dockerfile`** — multi-stage so the same file works for dev and prod:

- `base`: node:20-alpine, install deps
- `dev`: mounts source, runs `npm run dev` (tsx watch)
- `build`: compiles TypeScript
- `prod`: copies `dist/`, runs `node dist/index.js`

**`docker-compose.yml`** — two services:

- `app`: built from Dockerfile (dev target), volume-mounts `./src` for hot reload, depends on `db`, reads `.env`
- `db`: `postgres:16-alpine`, named volume for persistence, exposes 5432 on host for inspection, healthcheck so `app` waits for it

The README's "getting started" reduces to: `cp .env.example .env`, fill in Slack tokens, `docker compose up`. Migrations run automatically on app startup (or via a one-shot `docker compose run app npm run db:migrate`).

## Database schema

```sql
CREATE TABLE bugs (
  id SERIAL PRIMARY KEY,
  slack_ts TEXT UNIQUE NOT NULL,
  slack_channel TEXT NOT NULL,
  reporter_slack_id TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  affected_user_identifier TEXT,
  what_happened TEXT NOT NULL,
  expected_behavior TEXT,
  when_it_happened TEXT,
  affected_url TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  tags TEXT[] NOT NULL DEFAULT '{}',           -- normalized tags, lowercase, no #
  notified_teams TEXT[] NOT NULL DEFAULT '{}', -- audit of which teams were pinged
  resolution_notes TEXT,
  enrichment_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_bugs_status ON bugs(status);
CREATE INDEX idx_bugs_created_at ON bugs(created_at DESC);
CREATE INDEX idx_bugs_tags ON bugs USING GIN(tags);
```

## Tag → team routing

**Config file: `teams.yaml`** (committed to repo, easy to edit):

```yaml
teams:
  - tag: copilot
    name: Copilot Team
    slack_group_id: S01ABCDEFG     # Slack user group, gets @-mentioned
    channel_id: C0XXXXXX           # Optional: also cross-post bug card here
    aliases: [ai, assistant]       # #ai or #assistant also route here

  - tag: dashboard
    name: Dashboard Team
    slack_group_id: S01HIJKLMN
    aliases: [analytics, reports]

  - tag: auth
    name: Identity Team
    slack_group_id: S01OPQRSTU
    aliases: [login, sso]

  - tag: payments
    name: Payments Team
    slack_group_id: S01VWXYZAB

default:
  # Fallback when no tag matches or none provided
  slack_group_id: S01DEFAULTTM
  name: Platform Team
```

**Behavior:**

- The modal includes a **Tags** field (multi-select with options sourced from `teams.yaml`, plus a free-text input for ad-hoc tags). Sourcing from config means CS sees a curated list, not a free-for-all.
- On submission, `tagParser.ts` also scans the **What happened** description for inline `#tags`, merges them with selected tags, and deduplicates.
- `teamNotifier.ts` resolves each tag to a team (via primary tag or alias). For each unique team:
  - Posts a threaded reply on the bug card: `<!subteam^S01ABCDEFG> heads up — this looks like your area.`
  - If the team has a `channel_id`, also cross-posts a link to the bug card there.
- Records the notified teams in `bugs.notified_teams` for audit.
- If no tags resolve to a team, the `default` team is notified.
- The bug card displays tags as styled badges in the Block Kit message.

## Modal fields (`/bug` command)

1. **Affected user** (text, optional) — email or user ID
2. **What happened** (multiline, required)
3. **What was expected** (multiline, optional)
4. **When did it happen** (static_select: "Just now" / "Earlier today" / "Yesterday" / "Specific time")
5. **Affected URL** (text, optional)
6. **Tags** (multi_static_select, options from `teams.yaml`) — required, at least one
7. **Severity** (static_select, default "medium")

## Bug card format (Block Kit)

- **Header**: 🐛 New bug — [severity badge]
- **Reporter**: @username
- **Tags**: `#copilot` `#auth` (as styled context elements)
- **Affected user**: identifier (or "not specified")
- **What happened**: description
- **Expected**: if provided
- **When**: time hint
- **URL**: if provided
- **Status**: `🆕 New`
- Divider
- **Enrichment** (added as thread reply once async lookups complete)
- **Team notification** (separate thread reply pinging the responsible Slack user group)

## Status reaction flow

- 🔍 → `investigating`
- ⚙️ → `in_progress`
- ✅ → `fixed` (triggers resolution prompt)
- 🔁 → `cant_reproduce`
- 📋 → `needs_info`

When ✅ is added, send an ephemeral message to the reactor: "Nice — what was the fix? Reply in thread starting with `fix:`". `resolutionHandler.ts` listens for `message` events in threads of known bug cards, captures the first message from the resolver starting with `fix:`, stores as `resolution_notes`.

## Datadog enrichment logic

- Use Datadog Logs API: `POST /api/v2/logs/events/search`
- Query from: affected user identifier + time window derived from `when_it_happened` (default ±30 min around report time)
- Filter to `status:error` and `status:warn`
- Return top 5, formatted with timestamp, service, message, stack snippet
- Gracefully skip if credentials aren't set — log a warning, continue without enrichment

## Platform user lookup (stub for v1)

`services/platformUser.ts` exports `lookupUser(identifier: string): Promise<PlatformUserInfo | null>`. Returns mock data if `PLATFORM_API_URL` isn't set. Clear `TODO` marking the real HTTP call.

## Setup steps for the README

1. Create Slack app at api.slack.com using `slack-app-manifest.yaml`
2. Enable Socket Mode, generate App-Level Token with `connections:write` scope
3. Install app to workspace, copy Bot Token + Signing Secret + App Token
4. Create Slack user groups for each team and copy their IDs into `teams.yaml`
5. `cp .env.example .env` and fill in tokens
6. Edit `teams.yaml` with your real teams and Slack group IDs
7. `docker compose up`
8. Invite the bot to `#bugs` and try `/bug`

## Build order (suggested)

1. Docker scaffold (Dockerfile + docker-compose.yml + .env.example) — `docker compose up` runs an empty app that connects to Postgres
2. Postgres schema + migration runner
3. Slack Bolt app boots in Socket Mode, responds to `/bug` with a hello modal
4. Real modal with all fields including tags, modal submission handler, persist to DB, post bug card
5. Tag parser + team notifier (config loader for `teams.yaml`, threaded notification)
6. Reaction handler — emoji → status update + message edit
7. Platform user lookup (stub)
8. Datadog enrichment + threaded enrichment reply
9. Resolution capture flow on ✅
10. README polish

## Things to flag back to me as questions when you start

- Should bug cards post to a fixed channel (env var) or wherever `/bug` was invoked?
- Should the bot DM the reporter with a confirmation/link, or only post in-channel?
- For Datadog: search affected user by email, internal ID, or both?
- For tag routing: if multiple tags match different teams, notify all of them in one threaded message or separate ones?
- Should the `default` team be notified *in addition to* matched teams (a catch-all watcher) or *only when no other team matches*?
- Any PII concerns with storing affected user identifiers in Postgres?

---

## How to use this with Claude Code

Drop this file at the root of an empty repo, then start Claude Code with:

> Read PLAN.md. Let's build this together, starting with step 1 of the build order. Ask me any clarifying questions before you start writing code.
