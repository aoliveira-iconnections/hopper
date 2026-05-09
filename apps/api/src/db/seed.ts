import type { Pool } from "pg";
import { hashPassword } from "../services/auth";

// All demo users share the same DEMO_PASSWORD so multi-user flows
// (real-time, comments, assignees) can be exercised end-to-end.
const DEMO_USERS: { email: string; name: string; role: string }[] = [
  { email: "marta@iconnections.io",      name: "Marta Vieira",        role: "Customer Success" },
  { email: "ronaldinho@iconnections.io", name: "Ronaldinho Gaúcho",   role: "Engineering" },
  { email: "pele@iconnections.io",       name: "Pelé Nascimento",     role: "Engineering Lead" },
  { email: "kaka@iconnections.io",       name: "Kaká Leite",          role: "Engineering" },
  { email: "neymar@iconnections.io",     name: "Neymar Júnior",       role: "Engineering" },
  { email: "ronaldo@iconnections.io",    name: "Ronaldo Nazário",     role: "Customer Success" },
];

// Idempotent: ensures every demo user exists with a known password hash,
// overwriting any placeholder hash inserted by migration 003.
export async function ensureDemoUserPassword(pool: Pool) {
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    throw new Error("DEMO_PASSWORD is required");
  }

  const hash = await hashPassword(password);
  for (const u of DEMO_USERS) {
    await pool.query(
      `INSERT INTO users (email, name, role, password_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
      [u.email, u.name, u.role, hash],
    );
  }
}

interface SeedBug {
  id: number;
  duplicateOf: number | null;
  title: string;
  what: string;
  expected: string;
  affected: string;
  url: string;
  when: string;
  severity: string;
  status: string;
  tags: string[];
  reporter: string;
  reporterEmail: string;
  ageHours: number;
  slackTs: string;
  resolution?: string;
}

const SEED_BUGS: SeedBug[] = [
  {
    id: 142,
    duplicateOf: null,
    title: "Dashboard charts fail to load on Chrome after weekend deploy",
    what: "When I open the main analytics dashboard, the chart widgets show a spinner indefinitely. Network tab shows /api/metrics returning 504 after ~30s. Affects all users in our org. Started Sunday night.",
    expected: "Charts should load within 2 seconds as they did Friday afternoon.",
    affected: "andrea@acme.co",
    url: "https://app.iconnections.io/dashboard",
    when: "Just now",
    severity: "critical",
    status: "invest",
    tags: ["dashboard"],
    reporter: "Marta Vieira",
    reporterEmail: "marta@iconnections.io",
    ageHours: 2,
    slackTs: "1714752123.001200",
  },
  {
    id: 138,
    duplicateOf: null,
    title: "Copilot suggestions don't appear in nested code blocks",
    what: "Inside a markdown code fence within a doc, the inline copilot panel never opens. Works fine at top level. Confirmed in two different docs.",
    expected: "Copilot panel should open regardless of nesting depth.",
    affected: "ravi@gridline.com",
    url: "",
    when: "Yesterday",
    severity: "high",
    status: "invest",
    tags: ["copilot"],
    reporter: "Ronaldinho Gaúcho",
    reporterEmail: "ronaldinho@iconnections.io",
    ageHours: 27,
    slackTs: "1714665880.000800",
  },
  {
    id: 134,
    duplicateOf: null,
    title: "Login redirect loop after SSO timeout",
    what: "If a user sits on the SSO page longer than ~5 min and then submits, they get bounced between the IdP and our callback indefinitely. Have to clear cookies to recover.",
    expected: "Stale token should redirect cleanly to the login page with an error.",
    affected: "operations@northstar.fund",
    url: "https://app.iconnections.io/auth/sso/callback",
    when: "Earlier today",
    severity: "high",
    status: "progress",
    tags: ["auth"],
    reporter: "Pelé Nascimento",
    reporterEmail: "pele@iconnections.io",
    ageHours: 48,
    slackTs: "1714579420.000400",
  },
  {
    id: 129,
    duplicateOf: null,
    title: "Stripe webhook duplicates on retry — double-charges customer",
    what: "Stripe webhook retries are not idempotent on our side; we processed the same payment_intent.succeeded twice for one customer.",
    expected: "Webhook handler should dedupe by event id.",
    affected: "billing@acme.co",
    url: "",
    when: "Yesterday",
    severity: "critical",
    status: "fixed",
    tags: ["payments"],
    reporter: "Kaká Leite",
    reporterEmail: "kaka@iconnections.io",
    ageHours: 96,
    slackTs: "1714406200.001100",
    resolution: "Added idempotency key on event.id; backfilled deduplication for prior 30 days.",
  },
  {
    id: 121,
    duplicateOf: null,
    title: "Copilot autocomplete delayed by 3-5 seconds in long docs",
    what: "On documents over ~2k words, copilot inline autocomplete takes 3-5s to appear instead of the usual <800ms. Doesn't seem to be a network issue.",
    expected: "Autocomplete latency should stay under 1s regardless of doc length.",
    affected: "",
    url: "",
    when: "Earlier today",
    severity: "medium",
    status: "invest",
    tags: ["copilot"],
    reporter: "Neymar Júnior",
    reporterEmail: "neymar@iconnections.io",
    ageHours: 128,
    slackTs: "1714312000.000700",
  },
  {
    id: 118,
    duplicateOf: 142,
    title: "Cannot load dashboard widgets — spinner forever",
    what: "Dashboard tiles never finish loading. Refresh doesn't help.",
    expected: "Tiles render.",
    affected: "",
    url: "",
    when: "Just now",
    severity: "high",
    status: "new",
    tags: ["dashboard"],
    reporter: "Ronaldo Nazário",
    reporterEmail: "ronaldo@iconnections.io",
    ageHours: 144,
    slackTs: "1714225800.000300",
  },
  {
    id: 109,
    duplicateOf: null,
    title: "Two-factor codes rejected after clock drift on user device",
    what: "TOTP codes from authenticator apps reject when the device clock drifts more than ~30s.",
    expected: "Allow a slightly larger window or surface a clearer error.",
    affected: "",
    url: "",
    when: "Specific time",
    severity: "medium",
    status: "needs",
    tags: ["auth"],
    reporter: "Ronaldinho Gaúcho",
    reporterEmail: "ronaldinho@iconnections.io",
    ageHours: 192,
    slackTs: "1714052000.000500",
  },
  {
    id: 102,
    duplicateOf: null,
    title: "Settings page renders blank on iPad Safari",
    what: "Account → Settings shows a white screen on iPad. Works on iPhone.",
    expected: "Page should render.",
    affected: "",
    url: "",
    when: "Yesterday",
    severity: "low",
    status: "cantrepro",
    tags: [],
    reporter: "Kaká Leite",
    reporterEmail: "kaka@iconnections.io",
    ageHours: 264,
    slackTs: "1713794200.000600",
  },
];

export async function seedIfEmpty(pool: Pool, slackChannel: string) {
  const { rows } = await pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM bugs");
  if (Number(rows[0].count) > 0) return;

  // Look up reporter_id for each unique seed reporter email up front.
  const emails = Array.from(new Set(SEED_BUGS.map((b) => b.reporterEmail.toLowerCase())));
  const userMap = new Map<string, number>();
  for (const email of emails) {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email],
    );
    if (r.rows.length > 0) userMap.set(email, r.rows[0].id);
  }

  for (const b of SEED_BUGS) {
    const reporterId = userMap.get(b.reporterEmail.toLowerCase());
    if (!reporterId) {
      console.warn(`[seed] skipping bug #${b.id} — no user for ${b.reporterEmail}`);
      continue;
    }
    await pool.query(
      `INSERT INTO bugs (
         id, duplicate_of, title, what, expected, affected, url, when_hint,
         severity, status, tags, reporter_id,
         slack_ts, slack_channel, resolution, created_at, updated_at, resolved_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14, $15,
         NOW() - ($16 || ' hours')::interval,
         NOW() - ($16 || ' hours')::interval,
         CASE WHEN $10 = 'fixed' THEN NOW() - ($16 || ' hours')::interval + INTERVAL '6 hours' ELSE NULL END
       )`,
      [
        b.id, b.duplicateOf, b.title, b.what, b.expected, b.affected, b.url, b.when,
        b.severity, b.status, b.tags, reporterId,
        b.slackTs, slackChannel, b.resolution ?? null,
        b.ageHours,
      ],
    );
  }

  await pool.query(`SELECT setval('bugs_id_seq', (SELECT MAX(id) FROM bugs))`);
  console.log(`[seed] inserted ${SEED_BUGS.length} bugs`);
}
