import type { Pool } from "pg";
import { embed, vectorLiteral } from "./ollama";

export function buildEmbedText(title: string, what: string): string {
  return `${title}\n\n${what}`.trim();
}

export async function refreshParentEmbedding(pool: Pool, parentId: number) {
  const { rows: parentRows } = await pool.query<{ title: string; what: string }>(
    `SELECT title, what FROM bugs WHERE id = $1`,
    [parentId],
  );
  if (parentRows.length === 0) return;
  const parent = parentRows[0];

  const { rows: dupRows } = await pool.query<{ what: string }>(
    `SELECT what FROM bugs WHERE duplicate_of = $1 ORDER BY created_at`,
    [parentId],
  );

  const combined =
    `${parent.title}\n\n${parent.what}` +
    (dupRows.length > 0
      ? `\n\nAdditional reports:\n${dupRows.map((d) => d.what).join("\n\n")}`
      : "");

  const vec = await embed(combined);
  await pool.query(
    `UPDATE bugs SET embedding = $1::vector, updated_at = NOW() WHERE id = $2`,
    [vectorLiteral(vec), parentId],
  );
  console.log(
    `[embeddings] refreshed parent #${parentId} embedding (${dupRows.length} dup reports merged)`,
  );
}

export async function backfillEmbeddings(pool: Pool) {
  const { rows } = await pool.query<{ id: number; title: string; what: string }>(
    `SELECT id, title, what FROM bugs WHERE embedding IS NULL`,
  );
  if (rows.length === 0) return;
  console.log(`[embeddings] backfilling ${rows.length} bugs …`);
  for (const r of rows) {
    try {
      const vec = await embed(buildEmbedText(r.title, r.what));
      await pool.query(`UPDATE bugs SET embedding = $1::vector WHERE id = $2`, [
        vectorLiteral(vec),
        r.id,
      ]);
    } catch (err) {
      console.error(`[embeddings] failed for bug #${r.id}:`, err);
    }
  }
  console.log(`[embeddings] backfill complete`);
}
