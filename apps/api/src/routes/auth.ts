import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool";
import { verifyPassword } from "../services/auth";
import {
  clearSessionCookie,
  loadSessionUser,
  setSessionCookie,
} from "../services/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional().default(false),
});

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  password_hash: string;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }

    const { rows } = await pool.query<UserRow>(
      `SELECT id, email, name, role, password_hash
       FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [parsed.data.email],
    );

    // Constant-ish timing whether user exists or not (don't leak which case it is)
    const stored = rows[0]?.password_hash ?? "x:x";
    const valid = await verifyPassword(parsed.data.password, stored);

    if (rows.length === 0 || !valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const u = rows[0];
    setSessionCookie(reply, u.id, parsed.data.remember);
    return {
      user: { id: u.id, email: u.email, name: u.name, role: u.role },
    };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = await loadSessionUser(req);
    if (!user) return reply.code(401).send({ error: "Not authenticated" });
    return { user };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });
}
