import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { pool } from "../db/pool";
import {
  ALLOWED_MIME,
  MAX_FILES_PER_REQUEST,
  absolutePath,
  deleteStorageFile,
  isAllowedMime,
  makeStorageKey,
  writeStreamToStorage,
} from "../services/attachments";

interface AttachmentRow {
  id: string | number;
  bug_id: string | number;
  uploader_id: number;
  uploader_name: string;
  filename: string;
  mime_type: string;
  size_bytes: string | number;
  storage_key: string;
  created_at: Date;
}

export interface Attachment {
  id: number;
  bugId: number;
  uploaderId: number;
  uploaderName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}

function rowToAttachment(r: AttachmentRow): Attachment {
  return {
    id: Number(r.id),
    bugId: Number(r.bug_id),
    uploaderId: r.uploader_id,
    uploaderName: r.uploader_name,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes),
    createdAt: r.created_at.getTime(),
  };
}

const SELECT_ATTACHMENT_SQL = `
  SELECT a.id, a.bug_id, a.uploader_id, u.name AS uploader_name,
         a.filename, a.mime_type, a.size_bytes, a.storage_key, a.created_at
  FROM bug_attachments a
  JOIN users u ON u.id = a.uploader_id
`;

export async function registerAttachmentRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/bugs/:id/attachments",
    async (req, reply) => {
      const bugId = Number(req.params.id);
      if (!Number.isInteger(bugId)) {
        return reply.code(400).send({ error: "invalid bug id" });
      }
      const { rows } = await pool.query<AttachmentRow>(
        `${SELECT_ATTACHMENT_SQL} WHERE a.bug_id = $1 ORDER BY a.created_at ASC`,
        [bugId],
      );
      return rows.map(rowToAttachment);
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/bugs/:id/attachments",
    async (req, reply) => {
      const bugId = Number(req.params.id);
      if (!Number.isInteger(bugId)) {
        return reply.code(400).send({ error: "invalid bug id" });
      }

      const bugCheck = await pool.query("SELECT 1 FROM bugs WHERE id = $1", [bugId]);
      if (bugCheck.rowCount === 0) {
        return reply.code(404).send({ error: "bug not found" });
      }

      if (!req.isMultipart()) {
        return reply.code(400).send({ error: "expected multipart/form-data" });
      }

      const uploaderId = req.user!.id;
      const created: Attachment[] = [];

      try {
        const parts = req.files({ limits: { files: MAX_FILES_PER_REQUEST } });
        for await (const part of parts) {
          if (!isAllowedMime(part.mimetype)) {
            return reply.code(415).send({
              error: `Unsupported file type: ${part.mimetype}. Allowed: ${[
                ...ALLOWED_MIME,
              ].join(", ")}`,
            });
          }

          const storageKey = makeStorageKey(bugId, part.mimetype);
          await writeStreamToStorage(storageKey, part.file);

          // @fastify/multipart sets `truncated` if the per-file limit was hit.
          if (part.file.truncated) {
            await deleteStorageFile(storageKey);
            return reply.code(413).send({ error: "file too large" });
          }

          const stats = await stat(absolutePath(storageKey));
          const { rows } = await pool.query<AttachmentRow>(
            `WITH inserted AS (
               INSERT INTO bug_attachments
                 (bug_id, uploader_id, filename, mime_type, size_bytes, storage_key)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *
             )
             SELECT i.id, i.bug_id, i.uploader_id, u.name AS uploader_name,
                    i.filename, i.mime_type, i.size_bytes, i.storage_key, i.created_at
             FROM inserted i
             JOIN users u ON u.id = i.uploader_id`,
            [
              bugId,
              uploaderId,
              part.filename ?? "upload",
              part.mimetype,
              stats.size,
              storageKey,
            ],
          );
          created.push(rowToAttachment(rows[0]));
        }
      } catch (err: unknown) {
        const e = err as { code?: string; message?: string };
        if (e?.code === "FST_REQ_FILE_TOO_LARGE") {
          return reply.code(413).send({ error: "file too large" });
        }
        if (e?.code === "FST_FILES_LIMIT") {
          return reply.code(413).send({ error: "too many files" });
        }
        app.log.error({ err }, "attachment upload failed");
        return reply.code(500).send({ error: "upload failed" });
      }

      if (created.length === 0) {
        return reply.code(400).send({ error: "no files in upload" });
      }
      return reply.code(201).send(created);
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/attachments/:id",
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return reply.code(400).send({ error: "invalid id" });
      }
      const { rows } = await pool.query<AttachmentRow>(
        `${SELECT_ATTACHMENT_SQL} WHERE a.id = $1`,
        [id],
      );
      if (rows.length === 0) {
        return reply.code(404).send({ error: "not found" });
      }
      const a = rows[0];
      const filePath = absolutePath(a.storage_key);
      try {
        await stat(filePath);
      } catch {
        return reply.code(404).send({ error: "file missing" });
      }

      const inline = a.mime_type.startsWith("image/") || a.mime_type === "application/pdf";
      reply.header("Content-Type", a.mime_type);
      reply.header(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename="${a.filename.replace(/"/g, "")}"`,
      );
      reply.header("Cache-Control", "private, max-age=3600");
      return reply.send(createReadStream(filePath));
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/attachments/:id",
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return reply.code(400).send({ error: "invalid id" });
      }
      const { rows } = await pool.query<AttachmentRow>(
        `${SELECT_ATTACHMENT_SQL} WHERE a.id = $1`,
        [id],
      );
      if (rows.length === 0) return reply.code(404).send({ error: "not found" });
      const a = rows[0];
      if (a.uploader_id !== req.user!.id) {
        return reply.code(403).send({ error: "only the uploader can delete this file" });
      }

      await pool.query("DELETE FROM bug_attachments WHERE id = $1", [id]);
      await deleteStorageFile(a.storage_key);
      return { ok: true };
    },
  );
}
