import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerRoutes } from "./routes/register.js";
import { eventsRoutes } from "./routes/events.js";
import { leaderboardRoutes } from "./routes/leaderboard.js";
import { runtimeRoutes } from "./routes/runtime.js";
import { statsRoutes } from "./routes/stats.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

// Global rate limit for registration endpoint (5/IP/hour)
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (request) => request.ip,
});

// Register routes
await app.register(registerRoutes);
await app.register(eventsRoutes);
await app.register(leaderboardRoutes);
await app.register(runtimeRoutes);
await app.register(statsRoutes);

// Health check
app.get("/api/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

const port = Number(process.env.API_PORT) || 3001;
const host = process.env.HOST || "0.0.0.0";

try {
  await app.listen({ port, host });
  console.log(`Hub AICE API running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
