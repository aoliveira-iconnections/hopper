import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool";
import { rowToBug } from "../types";
import { embed, vectorLiteral } from "../services/ollama";
import { buildEmbedText, refreshParentEmbedding } from "../services/embeddings";
import { postBugToSlack } from "../services/slack";
import { emitBugEvent } from "../services/events";

const SELECT_BUG_SQL = `
  SELECT b.*,
         u.name  AS reporter_name,
         u.email AS reporter_email,
         u.role  AS reporter_role,
         au.id   AS assignee_user_id,
         au.name AS assignee_name,
         au.email AS assignee_email,
         au.role AS assignee_role,
         (SELECT COUNT(*) FROM bugs d WHERE d.duplicate_of = b.id) AS duplicate_count
  FROM bugs b
  JOIN users u ON u.id = b.reporter_id
  LEFT JOIN users au ON au.id = b.assignee_id
`;

const SIMILARITY_THRESHOLD = 0.6;
const SIMILARITY_LIMIT = 3;
const SEARCH_THRESHOLD = 0.3;
const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_MAX_LIMIT = 50;
const PAGE_DEFAULT_LIMIT = 200;
const PAGE_MAX_LIMIT = 200;

interface PageCursor {
  ts: number;
  id: number;
}

function encodeCursor(c: PageCursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

function decodeCursor(raw: string): PageCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed?.ts === "number" &&
      typeof parsed?.id === "number" &&
      Number.isFinite(parsed.ts) &&
      Number.isFinite(parsed.id)
    ) {
      return { ts: parsed.ts, id: parsed.id };
    }
  } catch {
    // fall through
  }
  return null;
}

const createBugSchema = z.object({
  title: z.string().min(1).max(300),
  what: z.string().min(1),
  expected: z.string().default(""),
  affected: z.string().default(""),
  url: z.string().default(""),
  when: z.string().default("Just now"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  tags: z.array(z.string()).default([]),
  asDuplicateOf: z.number().nullable().default(null),
});

const similarSchema = z.object({
  query: z.string().min(1),
});

const updateBugSchema = z.object({
  status: z.enum(["new", "invest", "progress", "fixed", "cantrepro", "needs"]).optional(),
  resolution: z.string().nullable().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
});

const listBugsSchema = z.object({
  status: z.enum(["new", "invest", "progress", "fixed", "cantrepro", "needs"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  tag: z.string().min(1).optional(),
  reporterId: z.coerce.number().int().positive().optional(),
  assigneeId: z.coerce.number().int().positive().optional(),
  q: z.string().min(1).optional(),
  excludeDuplicates: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(PAGE_MAX_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
});

const searchSchema = z.object({
  q: z.string().min(2),
  limit: z.coerce.number().int().min(1).max(SEARCH_MAX_LIMIT).optional(),
});

export async function registerBugRoutes(app: FastifyInstance) {
  app.get("/api/bugs", async (req, reply) => {
    const parsed = listBugsSchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const f = parsed.data;

    const where: string[] = [];
    const params: unknown[] = [];
    if (f.excludeDuplicates) where.push("b.duplicate_of IS NULL");
    if (f.status) {
      params.push(f.status);
      where.push(`b.status = $${params.length}`);
    }
    if (f.severity) {
      params.push(f.severity);
      where.push(`b.severity = $${params.length}`);
    }
    if (f.tag) {
      params.push(f.tag);
      where.push(`$${params.length} = ANY(b.tags)`);
    }
    if (f.reporterId) {
      params.push(f.reporterId);
      where.push(`b.reporter_id = $${params.length}`);
    }
    if (f.assigneeId) {
      params.push(f.assigneeId);
      where.push(`b.assignee_id = $${params.length}`);
    }
    if (f.q) {
      params.push(`%${f.q}%`);
      where.push(`(b.title ILIKE $${params.length} OR b.what ILIKE $${params.length})`);
    }

    if (f.cursor) {
      const cursor = decodeCursor(f.cursor);
      if (!cursor) return reply.code(400).send({ error: "invalid cursor" });
      // Stable pagination ordering by (created_at DESC, id DESC); seek to the
      // first row strictly older than the previous page's tail.
      params.push(new Date(cursor.ts), cursor.id);
      where.push(
        `(b.created_at, b.id) < ($${params.length - 1}, $${params.length})`,
      );
    }

    const limit = f.limit ?? PAGE_DEFAULT_LIMIT;
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    params.push(limit + 1);
    const { rows } = await pool.query(
      `${SELECT_BUG_SQL} ${whereSql} ORDER BY b.created_at DESC, b.id DESC LIMIT $${params.length}`,
      params,
    );
    const items = rows.slice(0, limit).map(rowToBug);
    const last = rows.length > limit ? items[items.length - 1] : null;
    return {
      items,
      nextCursor: last ? encodeCursor({ ts: last.createdAt, id: last.id }) : null,
    };
  });

  app.get<{ Params: { id: string } }>("/api/bugs/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "invalid id" });
    const { rows } = await pool.query(`${SELECT_BUG_SQL} WHERE b.id = $1`, [id]);
    if (rows.length === 0) return reply.code(404).send({ error: "not found" });
    return rowToBug(rows[0]);
  });

  app.patch<{ Params: { id: string } }>("/api/bugs/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "invalid id" });

    const parsed = updateBugSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { status, resolution, assigneeId } = parsed.data;

    const setClauses: string[] = ["updated_at = NOW()"];
    const params: unknown[] = [];

    if (status !== undefined) {
      params.push(status);
      setClauses.push(`status = $${params.length}`);
      setClauses.push(
        status === "fixed" ? "resolved_at = NOW()" : "resolved_at = NULL",
      );
    }
    if (resolution !== undefined) {
      params.push(resolution);
      setClauses.push(`resolution = $${params.length}`);
    }
    if (assigneeId !== undefined) {
      params.push(assigneeId);
      setClauses.push(`assignee_id = $${params.length}`);
    }

    if (params.length === 0) return reply.code(400).send({ error: "nothing to update" });

    params.push(id);
    const { rowCount } = await pool.query(
      `UPDATE bugs SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
      params,
    );
    if (!rowCount) return reply.code(404).send({ error: "not found" });

    const { rows } = await pool.query(`${SELECT_BUG_SQL} WHERE b.id = $1`, [id]);
    const updated = rowToBug(rows[0]);
    emitBugEvent({ type: "bug.updated", bug: updated });
    // If the parent of a duplicate changed status (e.g. fixed), the parent's
    // duplicateCount on the client should still be the same — but if a status
    // change cascades elsewhere, this is where we'd emit those.
    return updated;
  });

  app.post("/api/bugs/search", async (req, reply) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const limit = parsed.data.limit ?? SEARCH_DEFAULT_LIMIT;
    let vec: number[];
    try {
      vec = await embed(parsed.data.q);
    } catch (err) {
      app.log.warn({ err }, "embedding failed in /search");
      return [];
    }
    const { rows } = await pool.query(
      `SELECT b.*,
              u.name  AS reporter_name,
              u.email AS reporter_email,
              u.role  AS reporter_role,
              au.id   AS assignee_user_id,
              au.name AS assignee_name,
              au.email AS assignee_email,
              au.role AS assignee_role,
              (SELECT COUNT(*) FROM bugs d WHERE d.duplicate_of = b.id) AS duplicate_count,
              1 - (b.embedding <=> $1::vector) AS score
       FROM bugs b
       JOIN users u ON u.id = b.reporter_id
       LEFT JOIN users au ON au.id = b.assignee_id
       WHERE b.embedding IS NOT NULL
         AND 1 - (b.embedding <=> $1::vector) > $2
       ORDER BY score DESC
       LIMIT $3`,
      [vectorLiteral(vec), SEARCH_THRESHOLD, limit],
    );
    return rows.map((r) => ({ bug: rowToBug(r), score: Number(r.score) }));
  });

  app.post("/api/bugs/similar", async (req, reply) => {
    const parsed = similarSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    let vec: number[];
    try {
      vec = await embed(parsed.data.query);
    } catch (err) {
      app.log.warn({ err }, "embedding failed in /similar");
      return [];
    }
    const { rows } = await pool.query(
      `SELECT b.*,
              (SELECT COUNT(*) FROM bugs d WHERE d.duplicate_of = b.id) AS duplicate_count,
              1 - (b.embedding <=> $1::vector) AS score
       FROM bugs b
       WHERE b.duplicate_of IS NULL
         AND b.embedding IS NOT NULL
         AND 1 - (b.embedding <=> $1::vector) > $2
       ORDER BY score DESC
       LIMIT $3`,
      [vectorLiteral(vec), SIMILARITY_THRESHOLD, SIMILARITY_LIMIT],
    );
    return rows.map((r) => ({ bug: rowToBug(r), score: Number(r.score) }));
  });

  app.post("/api/bugs", async (req, reply) => {
    const parsed = createBugSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const b = parsed.data;
    const reporterId = req.user!.id;

    let vectorParam: string | null = null;
    try {
      const vec = await embed(buildEmbedText(b.title, b.what));
      vectorParam = vectorLiteral(vec);
    } catch (err) {
      app.log.warn({ err }, "embedding failed on create — bug saved without embedding");
    }

    const { rows: inserted } = await pool.query(
      `INSERT INTO bugs (
         duplicate_of, title, what, expected, affected, url, when_hint,
         severity, status, tags, reporter_id, slack_channel, embedding
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, 'new', $9, $10, $11, $12::vector
       ) RETURNING id`,
      [
        b.asDuplicateOf,
        b.title,
        b.what,
        b.expected,
        b.affected,
        b.url,
        b.when,
        b.severity,
        b.tags,
        reporterId,
        process.env.SLACK_CHANNEL_NAME ?? "#bugs-triage",
        vectorParam,
      ],
    );
    const newId = inserted[0].id;

    const { rows } = await pool.query(`${SELECT_BUG_SQL} WHERE b.id = $1`, [newId]);
    const newBug = rowToBug(rows[0]);

    let parent = null;
    if (newBug.duplicateOf !== null) {
      try {
        await refreshParentEmbedding(pool, newBug.duplicateOf);
      } catch (err) {
        app.log.warn({ err }, "Failed to refresh parent embedding");
      }
      const { rows: parentRows } = await pool.query(
        `${SELECT_BUG_SQL} WHERE b.id = $1`,
        [newBug.duplicateOf],
      );
      if (parentRows.length > 0) parent = rowToBug(parentRows[0]);
    }

    try {
      const slackResult = await postBugToSlack(newBug, parent);
      if (slackResult?.ts) {
        await pool.query(`UPDATE bugs SET slack_ts = $1 WHERE id = $2`, [
          slackResult.ts,
          newId,
        ]);
        newBug.slackTs = slackResult.ts;
      }
    } catch (err) {
      app.log.warn({ err }, "Slack post failed");
    }

    emitBugEvent({ type: "bug.created", bug: newBug });
    // The parent's duplicateCount changed; re-emit it so live lists update.
    if (parent) {
      const { rows: refreshedParentRows } = await pool.query(
        `${SELECT_BUG_SQL} WHERE b.id = $1`,
        [parent.id],
      );
      if (refreshedParentRows.length > 0) {
        emitBugEvent({ type: "bug.updated", bug: rowToBug(refreshedParentRows[0]) });
      }
    }

    return reply.code(201).send(newBug);
  });
}
