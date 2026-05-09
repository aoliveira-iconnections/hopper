import type { FastifyInstance } from "fastify";
import { pool } from "../db/pool";

interface StatsRow {
  open_count: string;
  filed_today: string;
  filed_week: string;
  critical_count: string;
  dupes_caught: string;
  fixed_count: string;
}

interface ByStatusRow {
  status: string;
  count: string;
}

export async function registerStatsRoutes(app: FastifyInstance) {
  app.get("/api/stats/dashboard", async () => {
    const [aggregate, byStatusRows] = await Promise.all([
      pool.query<StatsRow>(`
        SELECT
          COUNT(*) FILTER (
            WHERE duplicate_of IS NULL
              AND status NOT IN ('fixed', 'cantrepro')
          ) AS open_count,
          COUNT(*) FILTER (
            WHERE duplicate_of IS NULL
              AND created_at >= NOW() - INTERVAL '24 hours'
          ) AS filed_today,
          COUNT(*) FILTER (
            WHERE duplicate_of IS NULL
              AND created_at >= NOW() - INTERVAL '7 days'
          ) AS filed_week,
          COUNT(*) FILTER (
            WHERE duplicate_of IS NULL
              AND severity = 'critical'
              AND status NOT IN ('fixed', 'cantrepro')
          ) AS critical_count,
          COUNT(*) FILTER (
            WHERE duplicate_of IS NOT NULL
          ) AS dupes_caught,
          COUNT(*) FILTER (
            WHERE duplicate_of IS NULL
              AND status = 'fixed'
          ) AS fixed_count
        FROM bugs
      `),
      pool.query<ByStatusRow>(`
        SELECT status, COUNT(*) AS count
        FROM bugs
        WHERE duplicate_of IS NULL
        GROUP BY status
      `),
    ]);
    const r = aggregate.rows[0];
    const byStatus: Record<string, number> = {
      new: 0,
      invest: 0,
      progress: 0,
      needs: 0,
      cantrepro: 0,
      fixed: 0,
    };
    for (const row of byStatusRows.rows) {
      byStatus[row.status] = Number(row.count);
    }
    return {
      openCount: Number(r.open_count),
      filedToday: Number(r.filed_today),
      filedThisWeek: Number(r.filed_week),
      criticalCount: Number(r.critical_count),
      dupesCaught: Number(r.dupes_caught),
      fixedCount: Number(r.fixed_count),
      byStatus,
    };
  });
}
