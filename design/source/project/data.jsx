/* Seed data + similarity for Bug Triage prototype */
/* eslint-disable no-undef */

const NOW = Date.now();
const m = (n) => n * 60 * 1000;
const h = (n) => n * 60 * 60 * 1000;
const d = (n) => n * 24 * 60 * 60 * 1000;

const SEED_BUGS = [
  {
    id: 142,
    title: "Dashboard charts fail to load on Chrome after weekend deploy",
    what: "When I open the main analytics dashboard, the chart widgets show a spinner indefinitely. Network tab shows /api/metrics returning 504 after ~30s. Affects all users in our org. Started Sunday night.",
    expected: "Charts should load within 2 seconds as they did Friday afternoon.",
    affected: "andrea@acme.co",
    url: "https://app.iconnections.io/dashboard",
    when: "Just now",
    severity: "critical",
    status: "invest",
    tags: ["dashboard"],
    reporter: "Maya Patel",
    reporterEmail: "maya@iconnections.io",
    createdAt: NOW - h(2),
    duplicateOf: null,
    duplicateCount: 3,
    slackTs: "1714752123.001200",
  },
  {
    id: 138,
    title: "Copilot suggestions don't appear in nested code blocks",
    what: "Inside a markdown code fence within a doc, the inline copilot panel never opens. Works fine at top level. Confirmed in two different docs.",
    expected: "Copilot panel should open regardless of nesting depth.",
    affected: "ravi@gridline.com",
    url: "",
    when: "Yesterday",
    severity: "high",
    status: "invest",
    tags: ["copilot"],
    reporter: "Sam Chen",
    reporterEmail: "sam@iconnections.io",
    createdAt: NOW - d(1) - h(3),
    duplicateOf: null,
    duplicateCount: 2,
    slackTs: "1714665880.000800",
  },
  {
    id: 134,
    title: "Login redirect loop after SSO timeout",
    what: "If a user sits on the SSO page longer than ~5 min and then submits, they get bounced between the IdP and our callback indefinitely. Have to clear cookies to recover.",
    expected: "Stale token should redirect cleanly to the login page with an error.",
    affected: "operations@northstar.fund",
    url: "https://app.iconnections.io/auth/sso/callback",
    when: "Earlier today",
    severity: "high",
    status: "progress",
    tags: ["auth"],
    reporter: "Jules Romero",
    reporterEmail: "jules@iconnections.io",
    createdAt: NOW - d(2),
    duplicateOf: null,
    duplicateCount: 0,
    slackTs: "1714579420.000400",
  },
  {
    id: 129,
    title: "Stripe webhook duplicates on retry — double-charges customer",
    what: "Stripe webhook retries are not idempotent on our side; we processed the same payment_intent.succeeded twice for one customer.",
    expected: "Webhook handler should dedupe by event id.",
    affected: "billing@acme.co",
    url: "",
    when: "Yesterday",
    severity: "critical",
    status: "fixed",
    tags: ["payments"],
    reporter: "Priya Shah",
    reporterEmail: "priya@iconnections.io",
    createdAt: NOW - d(4),
    duplicateOf: null,
    duplicateCount: 0,
    slackTs: "1714406200.001100",
    resolution: "Added idempotency key on event.id; backfilled deduplication for prior 30 days.",
  },
  {
    id: 121,
    title: "Copilot autocomplete delayed by 3-5 seconds in long docs",
    what: "On documents over ~2k words, copilot inline autocomplete takes 3-5s to appear instead of the usual <800ms. Doesn't seem to be a network issue.",
    expected: "Autocomplete latency should stay under 1s regardless of doc length.",
    affected: "",
    url: "",
    when: "Earlier today",
    severity: "medium",
    status: "invest",
    tags: ["copilot"],
    reporter: "Devon Liu",
    reporterEmail: "devon@iconnections.io",
    createdAt: NOW - d(5) - h(8),
    duplicateOf: null,
    duplicateCount: 1,
    slackTs: "1714312000.000700",
  },
  {
    id: 118,
    title: "Cannot load dashboard widgets — spinner forever",
    what: "Dashboard tiles never finish loading. Refresh doesn't help.",
    expected: "Tiles render.",
    affected: "",
    url: "",
    when: "Just now",
    severity: "high",
    status: "new",
    tags: ["dashboard"],
    reporter: "Ana Reyes",
    reporterEmail: "ana@iconnections.io",
    createdAt: NOW - d(6),
    duplicateOf: 142,
    duplicateCount: 0,
    slackTs: "1714225800.000300",
  },
  {
    id: 109,
    title: "Two-factor codes rejected after clock drift on user device",
    what: "TOTP codes from authenticator apps reject when the device clock drifts more than ~30s.",
    expected: "Allow a slightly larger window or surface a clearer error.",
    affected: "",
    url: "",
    when: "Specific time",
    severity: "medium",
    status: "needs",
    tags: ["auth"],
    reporter: "Sam Chen",
    reporterEmail: "sam@iconnections.io",
    createdAt: NOW - d(8),
    duplicateOf: null,
    duplicateCount: 0,
    slackTs: "1714052000.000500",
  },
  {
    id: 102,
    title: "Settings page renders blank on iPad Safari",
    what: "Account → Settings shows a white screen on iPad. Works on iPhone.",
    expected: "Page should render.",
    affected: "",
    url: "",
    when: "Yesterday",
    severity: "low",
    status: "cantrepro",
    tags: [],
    reporter: "Priya Shah",
    reporterEmail: "priya@iconnections.io",
    createdAt: NOW - d(11),
    duplicateOf: null,
    duplicateCount: 0,
    slackTs: "1713794200.000600",
  },
];

const PRESET_TAGS = ["copilot", "dashboard", "auth", "payments"];

const STOP = new Set("a an and or the of to for in on at by is are was were be been with from as that this it its can cannot doesnt didnt should would could not no but if then i we you they our their my your me him her them so very".split(" "));

function tokens(s) {
  return (s || "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP.has(t));
}

function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  // Jaccard
  return inter / (A.size + B.size - inter);
}

function findDuplicates(query, bugs, limit = 3) {
  if (!query || query.trim().length < 8) return [];
  return bugs
    .filter(b => !b.duplicateOf) // only consider primaries
    .map(b => ({
      bug: b,
      score: Math.max(
        similarity(query, b.title),
        similarity(query, (b.title + " " + b.what)) * 0.95,
      ),
    }))
    .filter(x => x.score > 0.04)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => ({ ...x, score: Math.min(0.98, 0.55 + x.score * 1.6) })); // pretty up the percentage
}

const TAG_KEYWORDS = {
  copilot: ["copilot", "autocomplete", "suggestion", "inline", "completion"],
  dashboard: ["dashboard", "chart", "widget", "tile", "metric", "analytics"],
  auth: ["login", "sso", "auth", "password", "session", "token", "2fa", "totp", "redirect"],
  payments: ["stripe", "payment", "charge", "invoice", "billing", "webhook", "subscription"],
};

function suggestTags(query) {
  const t = tokens(query);
  const hits = [];
  for (const [tag, words] of Object.entries(TAG_KEYWORDS)) {
    const matches = t.filter(tok => words.some(w => tok.includes(w) || w.includes(tok))).length;
    if (matches > 0) hits.push({ tag, matches });
  }
  return hits.sort((a, b) => b.matches - a.matches).slice(0, 2).map(h => h.tag);
}

function suggestTitle(what) {
  const text = (what || "").trim();
  if (text.length < 24) return "";
  // Take the first sentence, strip filler, capitalize.
  const firstSent = text.split(/[.!?\n]/)[0].trim();
  let s = firstSent.length > 8 ? firstSent : text;
  s = s.replace(/^(when|if|whenever|after|hi|hey|hello|so)\s+/i, "");
  s = s.replace(/^i\s+(am|was|just|tried)\s+/i, "");
  s = s.replace(/\s+/g, " ");
  if (s.length > 80) s = s.slice(0, 77).replace(/\s+\S*$/, "") + "…";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

Object.assign(window, {
  SEED_BUGS, PRESET_TAGS,
  findDuplicates, suggestTags, suggestTitle, similarity,
});
