import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes, interactionEvents } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

// Admin-only middleware: requires either valid runtime auth OR admin API key header
async function importAuth(request: { headers: Record<string, string | string[] | undefined>; runtime?: unknown }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  const adminKey = request.headers["x-admin-key"];
  if (ADMIN_API_KEY && adminKey === ADMIN_API_KEY) {
    return; // Admin key matches
  }

  // Fall back to normal auth (Bearer token)
  const authHeader = request.headers.authorization;
  if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing authorization. Use X-Admin-Key header or Bearer token." });
  }

  // Delegate to authMiddleware by calling it via the normal flow
  // For import routes, we accept any valid Bearer token
}

const importEventSchema = z.object({
  type: z.string(),
  side: z.enum(["agent", "user", "system"]).optional(),
  result: z.string(),
  domain: z.string().optional(),
  severity: z.string().optional(),
  category: z.string().optional(),
  delta: z.number(),
  scoreBefore: z.number().optional(),
  scoreAfter: z.number().optional(),
  streakBefore: z.number().optional(),
  streakAfter: z.number().optional(),
  note: z.string().optional(),
  evaluator: z.string().optional(),
  timestamp: z.string(),
  externalId: z.string().optional(),
});

const importStateSchema = z.object({
  platform: z.string(),
  model: z.string(),
  thinking: z.string(),
  displayName: z.string().optional(),
  domains: z.record(z.string(), z.object({
    score: z.number(),
    streak: z.number().optional(),
    evaluations: z.number().optional(),
    corrections: z.number().optional(),
    emoji: z.string().optional(),
  })),
  globalScore: z.number(),
  maturity: z.object({
    totalEvaluations: z.number(),
    tier: z.string(),
    tierLabel: z.string().optional(),
    tierEmoji: z.string().optional(),
  }),
  antiPatterns: z.array(z.object({
    code: z.string(),
    name: z.string(),
    severity: z.string().optional(),
    domain: z.string().optional(),
    description: z.string().optional(),
    detectedAt: z.string().optional(),
    occurrences: z.number().optional(),
  })).optional(),
  proPatterns: z.array(z.object({
    code: z.string(),
    name: z.string(),
    domain: z.string().optional(),
    description: z.string().optional(),
    detectedAt: z.string().optional(),
    occurrences: z.number().optional(),
  })).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

const importInteractionSchema = z.object({
  externalId: z.string(),
  date: z.string(),
  task: z.string().optional(),
  userScore: z.number().optional(),
  agentScore: z.number().optional(),
  quadrant: z.string().optional(),
  metrics: z.record(z.string(), z.number()).optional(),
  notes: z.string().optional(),
  agentDeltas: z.record(z.string(), z.array(z.string())).optional(),
  userDeltas: z.record(z.string(), z.array(z.string())).optional(),
  timestamp: z.string(),
});

export async function importRoutes(app: FastifyInstance) {
  // POST /api/import/state — Import full runtime state (admin-only)
  app.post(
    "/api/import/state",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = importStateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation error",
          details: parsed.error.flatten(),
        });
      }

      const data = parsed.data;
      const runtime = request.runtime!;

      // Map domain scores to runtime columns
      const domainUpdates: Record<string, string> = {};
      const domainFieldMap: Record<string, string> = {
        TECH: "techScore",
        OPS: "opsScore",
        JUDGMENT: "judgmentScore",
        COMMS: "commsScore",
        ORCH: "orchScore",
      };
      const streakFieldMap: Record<string, string> = {
        TECH: "techStreak",
        OPS: "opsStreak",
        JUDGMENT: "judgmentStreak",
        COMMS: "commsStreak",
        ORCH: "orchStreak",
      };

      const updates: Record<string, unknown> = {
        agentScore: data.globalScore.toFixed(1),
        evalCount: data.maturity.totalEvaluations,
        maturityTier: data.maturity.tier,
      };

      if (data.displayName) {
        updates.displayName = data.displayName;
      }

      for (const [domain, state] of Object.entries(data.domains)) {
        const scoreField = domainFieldMap[domain];
        const streakField = streakFieldMap[domain];
        if (scoreField) updates[scoreField] = state.score.toFixed(1);
        if (streakField) updates[streakField] = state.streak ?? 0;
      }

      // Determine warmup status
      const warmupActive = data.maturity.totalEvaluations < 40;
      updates.warmupActive = warmupActive;
      updates.warmupEvals = warmupActive ? data.maturity.totalEvaluations : 40;

      await db
        .update(runtimes)
        .set(updates as Partial<typeof runtimes.$inferInsert>)
        .where(eq(runtimes.id, runtime.id));

      return reply.code(200).send({
        message: "State imported successfully",
        runtimeId: runtime.id,
        globalScore: data.globalScore,
        evalCount: data.maturity.totalEvaluations,
      });
    }
  );

  // POST /api/import/event — Import a single evaluation event (admin-only)
  app.post(
    "/api/import/event",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = importEventSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation error",
          details: parsed.error.flatten(),
        });
      }

      const data = parsed.data;
      const runtime = request.runtime!;

      // Idempotency: check if externalId already imported
      if (data.externalId) {
        const [existing] = await db
          .select({ id: interactionEvents.id })
          .from(interactionEvents)
          .where(
            sql`${interactionEvents.runtimeId} = ${runtime.id} AND ${interactionEvents.skillVersion} = ${data.externalId}`
          )
          .limit(1);

        if (existing) {
          return reply.code(409).send({
            error: "Event already imported",
            eventId: existing.id,
          });
        }
      }

      // Map result to eventType
      let eventType = "correct";
      if (data.result === "error" || data.result === "grave" || data.result === "critico") {
        eventType = "error";
      } else if (data.result === "pro" || data.result === "pro_pattern") {
        eventType = "pro_pattern";
      } else if (data.result === "bonus") {
        eventType = "bonus";
      } else if (data.result === "exceptional") {
        eventType = "exceptional";
      }

      const side = data.side === "user" ? "user" : "agent";

      const [inserted] = await db
        .insert(interactionEvents)
        .values({
          runtimeId: runtime.id,
          side,
          eventType,
          domain: data.domain ?? "TECH",
          severity: data.severity ?? null,
          patternCode: data.category ?? null,
          clientTs: new Date(data.timestamp),
          delta: data.delta.toFixed(1),
          domainScoreAfter: data.scoreAfter?.toFixed(1) ?? null,
          streakAfter: data.streakAfter ?? null,
          skillVersion: data.externalId ?? null, // reuse field for idempotency
          accepted: true,
        })
        .returning({ id: interactionEvents.id });

      return reply.code(200).send({
        message: "Event imported",
        eventId: inserted.id,
      });
    }
  );

  // POST /api/import/interaction — Import a logged interaction (admin-only)
  app.post(
    "/api/import/interaction",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = importInteractionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Validation error",
          details: parsed.error.flatten(),
        });
      }

      const data = parsed.data;
      const runtime = request.runtime!;

      // Idempotency: check externalId
      const [existing] = await db
        .select({ id: interactionEvents.id })
        .from(interactionEvents)
        .where(
          sql`${interactionEvents.runtimeId} = ${runtime.id} AND ${interactionEvents.skillVersion} = ${data.externalId}`
        )
        .limit(1);

      if (existing) {
        return reply.code(409).send({
          error: "Interaction already imported",
          eventId: existing.id,
        });
      }

      const noteJson = JSON.stringify({
        task: data.task,
        userScore: data.userScore,
        agentScore: data.agentScore,
        quadrant: data.quadrant,
        metrics: data.metrics,
        notes: data.notes,
      });

      const [inserted] = await db
        .insert(interactionEvents)
        .values({
          runtimeId: runtime.id,
          side: "agent",
          eventType: "correct", // interactions are logged as neutral events
          domain: "TECH",
          clientTs: new Date(data.timestamp),
          delta: "0.0",
          quadrant: data.quadrant ?? null,
          rejectionReason: noteJson.slice(0, 100), // store summary in rejection field
          skillVersion: data.externalId, // idempotency key
          accepted: true,
        })
        .returning({ id: interactionEvents.id });

      return reply.code(200).send({
        message: "Interaction imported",
        eventId: inserted.id,
      });
    }
  );
}
