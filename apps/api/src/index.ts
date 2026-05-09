import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { pool } from "./db/pool";
import { migrate } from "./db/migrate";
import { seedIfEmpty, ensureDemoUserPassword } from "./db/seed";
import { registerBugRoutes } from "./routes/bugs";
import { registerAiRoutes } from "./routes/ai";
import { registerStatsRoutes } from "./routes/stats";
import { registerAuthRoutes } from "./routes/auth";
import { registerUserRoutes } from "./routes/users";
import { registerAttachmentRoutes } from "./routes/attachments";
import { registerCommentRoutes } from "./routes/comments";
import { registerEventRoutes } from "./routes/events";
import { requireAuth } from "./services/session";
import { MAX_FILE_BYTES } from "./services/attachments";
import { ensureModelsPulled } from "./services/ollama";
import { backfillEmbeddings } from "./services/embeddings";

const PORT = Number(process.env.PORT ?? 3000);
const SLACK_CHANNEL = process.env.SLACK_CHANNEL_NAME ?? "#bugs-triage";

async function start() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required");
  }

  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: MAX_FILE_BYTES, files: 5 },
  });

  await migrate(pool);
  await ensureDemoUserPassword(pool);
  await seedIfEmpty(pool, SLACK_CHANNEL);

  app.get("/api/health", async () => ({ ok: true }));

  const PUBLIC_PATHS = new Set([
    "/api/health",
    "/api/auth/login",
    "/api/auth/me",
    "/api/auth/logout",
  ]);
  app.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (PUBLIC_PATHS.has(path)) return;
    await requireAuth(req, reply);
  });

  await registerBugRoutes(app);
  await registerAiRoutes(app);
  await registerStatsRoutes(app);
  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerAttachmentRoutes(app);
  await registerCommentRoutes(app);
  await registerEventRoutes(app);

  await app.listen({ port: PORT, host: "0.0.0.0" });

  // Pull Ollama models in the background, then backfill embeddings for any
  // bugs that don't have one yet (e.g. seeded data on first boot).
  // Endpoints that need the LLM will fail until pulls complete.
  (async () => {
    try {
      await ensureModelsPulled();
      await backfillEmbeddings(pool);
    } catch (err) {
      app.log.error({ err }, "Ollama setup failed");
    }
  })();
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
