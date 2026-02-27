import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes, interactionEvents } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { buildFullState } from "../services/scoring-engine.js";

export async function runtimeRoutes(app: FastifyInstance) {
  // Public: basic runtime info
  app.get("/api/runtime/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [runtime] = await db
      .select()
      .from(runtimes)
      .where(eq(runtimes.id, id))
      .limit(1);

    if (!runtime) {
      return reply.code(404).send({ error: "Runtime not found" });
    }

    return reply.send({
      id: runtime.id,
      platform: runtime.platform,
      model: runtime.model,
      thinking: runtime.thinking,
      displayName: runtime.displayName,
      ownerAlias: runtime.ownerAlias,
      agentScore: Number(runtime.agentScore),
      userScore: Number(runtime.userScore),
      teamScore: Number(runtime.teamScore),
      evalCount: runtime.evalCount,
      maturityTier: runtime.maturityTier,
      registeredAt: runtime.registeredAt,
    });
  });

  // Authenticated: full state (for sync)
  app.get(
    "/api/runtime/:id/state",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const runtime = request.runtime!;

      if (runtime.id !== id) {
        return reply.code(403).send({ error: "API key does not match this runtime" });
      }

      const [lastEvent] = await db
        .select({ id: interactionEvents.id, createdAt: interactionEvents.createdAt })
        .from(interactionEvents)
        .where(eq(interactionEvents.runtimeId, id))
        .orderBy(desc(interactionEvents.createdAt))
        .limit(1);

      const state = buildFullState(runtime);

      return reply.send({
        state,
        lastEventId: lastEvent?.id ?? null,
        lastEventAt: lastEvent?.createdAt ?? null,
      });
    },
  );
}
