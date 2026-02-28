import type { FastifyInstance } from "fastify";
import { eq, desc, sql, and, gte } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes, interactionEvents, dailySnapshots } from "../db/schema.js";
import { authMiddleware } from "../middleware/auth.js";
import { buildFullState, computeMaturityTier } from "../services/scoring-engine.js";
import { DOMAINS } from "../types.js";

// Maturity tier labels and emojis
const MATURITY_META: Record<string, { label: string; emoji: string }> = {
  GREEN: { label: "Seedling", emoji: "\ud83e\udd52" },
  YELLOW: { label: "Growing", emoji: "\ud83c\udf3f" },
  ORANGE: { label: "Mature", emoji: "\ud83c\udf33" },
  BLUE: { label: "Veteran", emoji: "\ud83e\udd8c" },
};

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

  // Public: full public runtime data (S1-F4) — cacheable 60s
  app.get("/api/runtime/:id/public", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [runtime] = await db
      .select()
      .from(runtimes)
      .where(eq(runtimes.id, id))
      .limit(1);

    if (!runtime) {
      return reply.code(404).send({ error: "Runtime not found" });
    }

    // Domain scores
    const domains: Record<string, { score: number; evaluations: number; streak: number }> = {};
    const agentFields: Record<string, keyof typeof runtime> = {
      TECH: "techScore",
      OPS: "opsScore",
      JUDGMENT: "judgmentScore",
      COMMS: "commsScore",
      ORCH: "orchScore",
    };
    const streakFields: Record<string, keyof typeof runtime> = {
      TECH: "techStreak",
      OPS: "opsStreak",
      JUDGMENT: "judgmentStreak",
      COMMS: "commsStreak",
      ORCH: "orchStreak",
    };

    // Count evaluations per domain
    const domainCounts = await db
      .select({
        domain: interactionEvents.domain,
        count: sql<number>`count(*)::int`,
      })
      .from(interactionEvents)
      .where(eq(interactionEvents.runtimeId, id))
      .groupBy(interactionEvents.domain);

    const evalsByDomain: Record<string, number> = {};
    for (const row of domainCounts) {
      evalsByDomain[row.domain] = row.count;
    }

    for (const d of DOMAINS) {
      domains[d] = {
        score: Number(runtime[agentFields[d]] ?? 50),
        evaluations: evalsByDomain[d] ?? 0,
        streak: Number(runtime[streakFields[d]] ?? 0),
      };
    }

    // Maturity
    const evalCount = runtime.evalCount ?? 0;
    const tier = runtime.maturityTier ?? computeMaturityTier(evalCount);
    const meta = MATURITY_META[tier] ?? MATURITY_META.GREEN;

    // History 30d from daily snapshots
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const snapshots = await db
      .select()
      .from(dailySnapshots)
      .where(
        and(
          eq(dailySnapshots.runtimeId, id),
          gte(dailySnapshots.snapshotDate, thirtyDaysAgo.toISOString().slice(0, 10))
        )
      )
      .orderBy(dailySnapshots.snapshotDate);

    const history30d = snapshots.map((s) => {
      const scoresJson = (s.scoresJson ?? {}) as Record<string, number>;
      return {
        date: s.snapshotDate,
        globalScore: Number(s.agentScore ?? 50),
        domainScores: {
          TECH: scoresJson.techScore ?? 50,
          OPS: scoresJson.opsScore ?? 50,
          JUDGMENT: scoresJson.judgmentScore ?? 50,
          COMMS: scoresJson.commsScore ?? 50,
          ORCH: scoresJson.orchScore ?? 50,
        },
      };
    });

    // Anti-patterns and pro-patterns from recent events
    const antiPatterns = await db
      .select({
        code: interactionEvents.patternCode,
        severity: interactionEvents.severity,
        occurrences: sql<number>`count(*)::int`,
      })
      .from(interactionEvents)
      .where(
        and(
          eq(interactionEvents.runtimeId, id),
          eq(interactionEvents.eventType, "error"),
          sql`${interactionEvents.patternCode} is not null`
        )
      )
      .groupBy(interactionEvents.patternCode, interactionEvents.severity)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    const proPatterns = await db
      .select({
        code: interactionEvents.patternCode,
        occurrences: sql<number>`count(*)::int`,
      })
      .from(interactionEvents)
      .where(
        and(
          eq(interactionEvents.runtimeId, id),
          eq(interactionEvents.eventType, "pro_pattern"),
          sql`${interactionEvents.patternCode} is not null`
        )
      )
      .groupBy(interactionEvents.patternCode)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    // Last activity
    const [lastEvent] = await db
      .select({ createdAt: interactionEvents.createdAt })
      .from(interactionEvents)
      .where(eq(interactionEvents.runtimeId, id))
      .orderBy(desc(interactionEvents.createdAt))
      .limit(1);

    // Cache header
    reply.header("Cache-Control", "public, max-age=60, s-maxage=60");

    return reply.send({
      runtimeId: runtime.id,
      displayName: runtime.displayName,
      platform: runtime.platform,
      model: runtime.model,
      thinking: runtime.thinking,
      globalScore: Number(runtime.agentScore),
      domains,
      maturity: {
        tier,
        tierLabel: meta.label,
        tierEmoji: meta.emoji,
        totalEvaluations: evalCount,
      },
      history30d,
      antiPatterns: antiPatterns.map((p) => ({
        code: p.code,
        name: p.code,
        occurrences: p.occurrences,
        severity: p.severity ?? "medio",
      })),
      proPatterns: proPatterns.map((p) => ({
        code: p.code,
        name: p.code,
        occurrences: p.occurrences,
      })),
      lastActivity: lastEvent?.createdAt?.toISOString() ?? runtime.registeredAt?.toISOString() ?? null,
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
