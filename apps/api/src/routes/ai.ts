import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generate } from "../services/ollama";

const PRESET_TAGS = ["copilot", "dashboard", "auth", "payments"];
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

const titleSchema = z.object({ what: z.string().min(8) });
const tagsSchema = z.object({ text: z.string().min(8) });
const summarySchema = z.object({
  title: z.string().min(1),
  what: z.string().min(1),
  additionalReports: z.array(z.string()).optional(),
});
const severitySchema = z.object({ text: z.string().min(8) });

const TITLE_PROMPT = (what: string) => `You are a bug-tracker assistant. Write one short, specific bug-report title for the user's description.

Rules:
- Maximum 80 characters.
- No quotes, no markdown, no leading/trailing whitespace.
- Be concrete; mention the affected feature or symptom.
- Reply with ONLY the title, nothing else.

Description:
${what}

Title:`;

const TAGS_PROMPT = (text: string) => `Available tags: copilot, dashboard, auth, payments.

Examples (one tag per bug):
- "Stripe webhook double-charges customer" is tagged: payments
- "SSO loop after timeout" is tagged: auth
- "Charts not rendering in analytics view" is tagged: dashboard
- "Copilot autocomplete delayed" is tagged: copilot
- "Settings page blank on iPad" is tagged: NONE

Bug: "${text}"
This bug is tagged:`;

function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^["'`*_]+|["'`*_]+$/g, "");
  t = t.replace(/^title\s*[:\-]\s*/i, "");
  t = t.split("\n")[0].trim();
  if (t.length > 100) t = t.slice(0, 97).replace(/\s+\S*$/, "") + "…";
  return t;
}

function parseTag(raw: string): string[] {
  const lower = raw.toLowerCase();
  for (const tag of PRESET_TAGS) {
    const re = new RegExp(`\\b${tag}\\b`);
    if (re.test(lower)) return [tag];
  }
  return [];
}

const SUMMARY_PROMPT = (title: string, what: string, additionalReports?: string[]) => {
  const extras =
    additionalReports && additionalReports.length > 0
      ? `\n\nAdditional reports of this same bug from other users:\n${additionalReports
          .map((r, i) => `Report ${i + 2}: ${r}`)
          .join("\n\n")}`
      : "";
  return `Read this bug report and write a 2-3 sentence triage summary. Help an engineer quickly understand the symptom and where to look first. Be specific and technical, no fluff. ${
    additionalReports && additionalReports.length > 0
      ? "Multiple reports are provided — call out any cross-cutting patterns (browser, user, endpoint, timing) that appear across them."
      : ""
  }

Bug title: ${title}
Report 1 (primary): ${what}${extras}

Triage summary:`;
};

const SEVERITY_PROMPT = (text: string) => `Severity levels (one word each):
- low: cosmetic glitch, edge case, no user-visible impact
- medium: minor feature broken, workaround exists, few users affected
- high: significant feature broken, many users affected, no easy workaround
- critical: data loss, security issue, full outage, billing problem

Examples (one word per bug):
- "Stripe webhook double-charges customers" is severity: critical
- "Login redirect loop after SSO timeout" is severity: high
- "Copilot autocomplete delayed by 3-5 seconds" is severity: medium
- "Settings page renders blank on iPad Safari" is severity: low

Bug: "${text}"
This bug is severity:`;

function cleanSummary(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^here(?:'s| is)? (?:a |the )?(?:\d+[-–]?\d*[ -]?sentence )?(?:triage )?summary\s*[:\-]?\s*/i, "");
  s = s.replace(/^(triage )?summary\s*[:\-]\s*/i, "");
  s = s.replace(/^["'`]+|["'`]+$/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function parseSeverity(raw: string): typeof SEVERITIES[number] | null {
  const lower = raw.toLowerCase();
  let bestSev: typeof SEVERITIES[number] | null = null;
  let bestIdx = Infinity;
  for (const sev of SEVERITIES) {
    const m = lower.match(new RegExp(`\\b${sev}\\b`));
    if (m && m.index !== undefined && m.index < bestIdx) {
      bestIdx = m.index;
      bestSev = sev;
    }
  }
  return bestSev;
}

export async function registerAiRoutes(app: FastifyInstance) {
  app.post("/api/ai/title", async (req, reply) => {
    const parsed = titleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const raw = await generate(TITLE_PROMPT(parsed.data.what), {
        temperature: 0.3,
        maxTokens: 60,
      });
      return { title: cleanTitle(raw) };
    } catch (err) {
      app.log.warn({ err }, "title generation failed");
      return { title: "" };
    }
  });

  app.post("/api/ai/tags", async (req, reply) => {
    const parsed = tagsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const raw = await generate(TAGS_PROMPT(parsed.data.text), {
        temperature: 0,
        maxTokens: 12,
      });
      return { tags: parseTag(raw) };
    } catch (err) {
      app.log.warn({ err }, "tag generation failed");
      return { tags: [] };
    }
  });

  app.post("/api/ai/summary", async (req, reply) => {
    const parsed = summarySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const raw = await generate(
        SUMMARY_PROMPT(parsed.data.title, parsed.data.what, parsed.data.additionalReports),
        { temperature: 0.3, maxTokens: 160 },
      );
      return { summary: cleanSummary(raw) };
    } catch (err) {
      app.log.warn({ err }, "summary generation failed");
      return { summary: "" };
    }
  });

  app.post("/api/ai/severity", async (req, reply) => {
    const parsed = severitySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    try {
      const raw = await generate(SEVERITY_PROMPT(parsed.data.text), {
        temperature: 0,
        maxTokens: 32,
      });
      const severity = parseSeverity(raw);
      if (!severity) app.log.warn({ raw }, "severity parse failed");
      return { severity };
    } catch (err) {
      app.log.warn({ err }, "severity generation failed");
      return { severity: null };
    }
  });
}
