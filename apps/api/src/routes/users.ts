import type { FastifyInstance } from "fastify";
import { pool } from "../db/pool";

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
}

export async function registerUserRoutes(app: FastifyInstance) {
  // Reporters with at least one filed bug, ordered by most recent activity.
  app.get("/api/users", async () => {
    const { rows } = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.name, u.role
       FROM users u
       JOIN bugs b ON b.reporter_id = u.id
       GROUP BY u.id
       ORDER BY MAX(b.created_at) DESC`,
    );
    return rows;
  });
}
