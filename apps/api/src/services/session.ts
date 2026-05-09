import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "../db/pool";

const COOKIE_NAME = "hopper_session";
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

declare module "fastify" {
  interface FastifyRequest {
    user?: SessionUser;
  }
}

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required");
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function makeToken(userId: number): string {
  const v = String(userId);
  return `${v}.${sign(v)}`;
}

function readToken(token: string | undefined): number | null {
  if (!token) return null;
  const [v, sig] = token.split(".");
  if (!v || !sig) return null;
  const expected = sign(v);
  if (expected.length !== sig.length) return null;
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(sig, "hex");
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;
  const id = Number(v);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function setSessionCookie(reply: FastifyReply, userId: number, remember: boolean) {
  reply.setCookie(COOKIE_NAME, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE_SECONDS } : {}),
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

async function loadUser(userId: number): Promise<SessionUser | null> {
  const { rows } = await pool.query<SessionUser>(
    `SELECT id, email, name, role FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const userId = readToken(req.cookies?.[COOKIE_NAME]);
  if (!userId) return reply.code(401).send({ error: "Not authenticated" });
  const user = await loadUser(userId);
  if (!user) {
    clearSessionCookie(reply);
    return reply.code(401).send({ error: "Not authenticated" });
  }
  req.user = user;
}

export async function loadSessionUser(req: FastifyRequest): Promise<SessionUser | null> {
  const userId = readToken(req.cookies?.[COOKIE_NAME]);
  if (!userId) return null;
  return loadUser(userId);
}
