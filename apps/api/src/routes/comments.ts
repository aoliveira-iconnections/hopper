import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool";

const MAX_BODY_LEN = 5000;

const createSchema = z.object({
  body: z.string().min(1).max(MAX_BODY_LEN).transform((s) => s.trim()),
});

const updateSchema = z.object({
  body: z.string().min(1).max(MAX_BODY_LEN).transform((s) => s.trim()),
});

interface CommentRow {
  id: string | number;
  bug_id: string | number;
  author_id: number;
  author_name: string;
  author_email: string;
  body: string;
  created_at: Date;
  updated_at: Date;
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

function rowToComment(r: CommentRow): Comment {
  return {
    id: Number(r.id),
    bugId: Number(r.bug_id),
    author: { id: r.author_id, name: r.author_name, email: r.author_email },
    body: r.body,
    createdAt: r.created_at.getTime(),
    updatedAt: r.updated_at.getTime(),
    edited: r.updated_at.getTime() !== r.created_at.getTime(),
  };
}

const SELECT_COMMENT_SQL = `
  SELECT c.id, c.bug_id, c.author_id, u.name AS author_name, u.email AS author_email,
         c.body, c.created_at, c.updated_at
  FROM bug_comments c
  JOIN users u ON u.id = c.author_id
`;

export async function registerCommentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/bugs/:id/comments",
    async (req, reply) => {
      const bugId = Number(req.params.id);
      if (!Number.isInteger(bugId)) {
        return reply.code(400).send({ error: "invalid bug id" });
      }
      const { rows } = await pool.query<CommentRow>(
        `${SELECT_COMMENT_SQL} WHERE c.bug_id = $1 ORDER BY c.created_at ASC`,
        [bugId],
      );
      return rows.map(rowToComment);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/bugs/:id/comments",
    async (req, reply) => {
      const bugId = Number(req.params.id);
      if (!Number.isInteger(bugId)) {
        return reply.code(400).send({ error: "invalid bug id" });
      }
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const bugCheck = await pool.query("SELECT 1 FROM bugs WHERE id = $1", [bugId]);
      if (bugCheck.rowCount === 0) {
        return reply.code(404).send({ error: "bug not found" });
      }

      const { rows } = await pool.query<CommentRow>(
        `WITH inserted AS (
           INSERT INTO bug_comments (bug_id, author_id, body)
           VALUES ($1, $2, $3)
           RETURNING *
         )
         SELECT i.id, i.bug_id, i.author_id, u.name AS author_name, u.email AS author_email,
                i.body, i.created_at, i.updated_at
         FROM inserted i
         JOIN users u ON u.id = i.author_id`,
        [bugId, req.user!.id, parsed.data.body],
      );
      return reply.code(201).send(rowToComment(rows[0]));
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/comments/:id",
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return reply.code(400).send({ error: "invalid id" });
      }
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const existing = await pool.query<{ author_id: number }>(
        "SELECT author_id FROM bug_comments WHERE id = $1",
        [id],
      );
      if (existing.rowCount === 0) return reply.code(404).send({ error: "not found" });
      if (existing.rows[0].author_id !== req.user!.id) {
        return reply.code(403).send({ error: "only the author can edit this comment" });
      }

      const { rows } = await pool.query<CommentRow>(
        `WITH updated AS (
           UPDATE bug_comments
              SET body = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING *
         )
         SELECT u.id, u.bug_id, u.author_id, us.name AS author_name, us.email AS author_email,
                u.body, u.created_at, u.updated_at
         FROM updated u
         JOIN users us ON us.id = u.author_id`,
        [parsed.data.body, id],
      );
      return rowToComment(rows[0]);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/comments/:id",
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return reply.code(400).send({ error: "invalid id" });
      }
      const existing = await pool.query<{ author_id: number }>(
        "SELECT author_id FROM bug_comments WHERE id = $1",
        [id],
      );
      if (existing.rowCount === 0) return reply.code(404).send({ error: "not found" });
      if (existing.rows[0].author_id !== req.user!.id) {
        return reply.code(403).send({ error: "only the author can delete this comment" });
      }

      await pool.query("DELETE FROM bug_comments WHERE id = $1", [id]);
      return { ok: true };
    },
  );
}
