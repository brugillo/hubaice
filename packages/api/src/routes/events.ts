import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes, interactionEvents } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { eventRateLimit } from "../middleware/rate-limit.js";
import { processEvent, buildFullState } from "../services/scoring-engine.js";
import { DOMAINS, SIDES, EVENT_TYPES, SEVERITIES } from "../types.js";

const eventSchema = z.object({
  side: z.enum(SIDES),
  eventType: z.enum(EVENT_TYPES),
  domain: z.enum(DOMAINS),
  severity: z.enum(SEVERITIES).optional(),
  patternCode: z.string().max(50).optional(),
  quadrant: z.string().max(20).optional(),
  trigger: z.string().max(20).optional(),
  sessionId: z.string().max(100).optional(),
  clusterRef: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
  skillVersion: z.string().max(20).optional(),
  bonusAmount: z.number().min(1).max(10).optional(),
});

export async function eventsRoutes(app: FastifyInstance) {
  app.post(
    "/api/events",
    { preHandler: [authMiddleware, eventRateLimit] },
    async (request, reply) => {
      const parsed = eventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(422).send({
          accepted: false,
          rejection: "VALIDATION_ERROR",
          detail: parsed.error.flatten(),
        });
      }

      const event = parsed.data;
      const runtime = request.runtime!;

      // Validate: errors require severity
      if (event.eventType === "error" && !event.severity) {
        return reply.code(422).send({
          accepted: false,
          rejection: "MISSING_SEVERITY",
          detail: "Error events require a severity field",
        });
      }

      // Check reincidence: same patternCode + same sessionId in this session
      let isReincidence = false;
      if (event.patternCode && event.sessionId) {
        const [existing] = await db
          .select({ id: interactionEvents.id })
          .from(interactionEvents)
          .where(
            and(
              eq(interactionEvents.runtimeId, runtime.id),
              eq(interactionEvents.sessionId, event.sessionId),
              eq(interactionEvents.patternCode, event.patternCode),
            ),
          )
          .limit(1);
        isReincidence = !!existing;
      }

      // Process scoring
      const { scoring, updates } = processEvent({
        runtime,
        event,
        isReincidence,
      });

      // Persist event
      const [inserted] = await db
        .insert(interactionEvents)
        .values({
          runtimeId: runtime.id,
          side: event.side,
          eventType: event.eventType,
          domain: event.domain,
          severity: event.severity ?? null,
          patternCode: event.patternCode ?? null,
          quadrant: event.quadrant ?? null,
          triggerType: event.trigger ?? null,
          clusterRef: event.clusterRef ?? null,
          sessionId: event.sessionId ?? null,
          clientTs: new Date(event.timestamp),
          delta: scoring.delta.toFixed(1),
          domainScoreAfter: scoring.domainScoreAfter.toFixed(1),
          globalScoreAfter: scoring.globalScoreAfter.toFixed(1),
          streakAfter: scoring.streakAfter,
          wasReincidence: scoring.wasReincidence,
          wasCluster: scoring.wasCluster,
          capApplied: scoring.capApplied,
          skillVersion: event.skillVersion ?? null,
        })
        .returning({ id: interactionEvents.id });

      // Update runtime state
      await db
        .update(runtimes)
        .set(updates)
        .where(eq(runtimes.id, runtime.id));

      // Re-read updated runtime for full state
      const [updatedRuntime] = await db
        .select()
        .from(runtimes)
        .where(eq(runtimes.id, runtime.id))
        .limit(1);

      const state = buildFullState(updatedRuntime);

      return reply.code(200).send({
        eventId: inserted.id,
        accepted: true,
        scoring: {
          delta: scoring.delta,
          domainScoreAfter: scoring.domainScoreAfter,
          globalScoreAfter: scoring.globalScoreAfter,
          streakAfter: scoring.streakAfter,
          evalCount: scoring.evalCount,
          wasReincidence: scoring.wasReincidence,
          wasCluster: scoring.wasCluster,
          capApplied: scoring.capApplied,
        },
        state,
      });
    },
  );
}
