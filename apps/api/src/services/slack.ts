import type { Bug } from "../types";

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? "";
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN ?? "";
const CHANNEL = process.env.SLACK_CHANNEL ?? "";

const SEVERITY_EMOJI: Record<string, string> = {
  low: "⚪",
  medium: "🔵",
  high: "🟠",
  critical: "🔴",
};

interface PostResult {
  ts: string | null;
}

function blocks(bug: Bug, parent: Bug | null): unknown[] {
  const sev = SEVERITY_EMOJI[bug.severity] ?? "⚪";
  const header = parent
    ? `🔁 Duplicate of #${parent.id} — ${parent.title}`
    : `🐛 New bug #${bug.id} — ${bug.title}`;

  const fields: string[] = [];
  fields.push(`*Severity:* ${sev} ${bug.severity}`);
  if (bug.tags.length > 0) fields.push(`*Tags:* ${bug.tags.map((t) => `\`#${t}\``).join(" ")}`);
  if (bug.affected) fields.push(`*Affected:* ${bug.affected}`);
  if (bug.url) fields.push(`*URL:* ${bug.url}`);
  fields.push(`*Reporter:* ${bug.reporter.name}`);

  return [
    { type: "section", text: { type: "mrkdwn", text: `*${header}*` } },
    {
      type: "section",
      text: { type: "mrkdwn", text: bug.what.length > 600 ? bug.what.slice(0, 600) + "…" : bug.what },
    },
    { type: "context", elements: [{ type: "mrkdwn", text: fields.join("  ·  ") }] },
  ];
}

async function postViaBotToken(
  bug: Bug,
  parent: Bug | null,
): Promise<PostResult | null> {
  if (!BOT_TOKEN || !CHANNEL) return null;
  const body: Record<string, unknown> = {
    channel: CHANNEL,
    text: parent
      ? `New report of #${parent.id} ${parent.title}`
      : `New bug #${bug.id}: ${bug.title}`,
    blocks: blocks(bug, parent),
  };
  if (parent && parent.slackTs) body.thread_ts = parent.slackTs;

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${BOT_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; ts?: string; error?: string };
  if (!data.ok) {
    console.warn(`[slack] chat.postMessage failed: ${data.error}`);
    return null;
  }
  return { ts: data.ts ?? null };
}

async function postViaWebhook(
  bug: Bug,
  parent: Bug | null,
): Promise<PostResult | null> {
  if (!WEBHOOK_URL) return null;
  const body = {
    text: parent
      ? `New report of #${parent.id} ${parent.title}`
      : `New bug #${bug.id}: ${bug.title}`,
    blocks: blocks(bug, parent),
  };
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[slack] webhook failed: ${res.status} ${text}`);
    return null;
  }
  return { ts: null };
}

export async function postBugToSlack(
  bug: Bug,
  parent: Bug | null,
): Promise<PostResult | null> {
  if (BOT_TOKEN && CHANNEL) return postViaBotToken(bug, parent);
  if (WEBHOOK_URL) return postViaWebhook(bug, parent);
  console.warn("[slack] no SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL set — skipping post");
  return null;
}
