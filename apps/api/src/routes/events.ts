import type { FastifyInstance } from "fastify";
import { onBugEvent } from "../services/events";

export async function registerEventRoutes(app: FastifyInstance) {
  // Server-Sent Events stream of workspace-wide bug changes. Long-lived;
  // the response is hijacked from Fastify's normal lifecycle so we can keep
  // writing event frames until the client disconnects.
  app.get("/api/events", async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();
    reply.hijack();

    const send = (event: string, payload: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send("hello", { ok: true, ts: Date.now() });

    const off = onBugEvent((e) => {
      send(e.type, e.bug);
    });

    // Keep proxies and idle-timeout firewalls from killing the connection.
    const ping = setInterval(() => {
      reply.raw.write(`: keepalive\n\n`);
    }, 25_000);

    const cleanup = () => {
      clearInterval(ping);
      off();
      reply.raw.end();
    };
    req.raw.on("close", cleanup);
    req.raw.on("error", cleanup);
  });
}
