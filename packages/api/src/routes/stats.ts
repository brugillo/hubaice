import type { FastifyInstance } from "fastify";
import { sql, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes, interactionEvents } from "../db/schema.js";

export async function statsRoutes(app: FastifyInstance) {
  app.get("/api/stats", async (_request, reply) => {
    const [runtimeStats] = await db
      .select({
        totalRuntimes: sql<number>`count(*)::int`,
        activeRuntimes: sql<number>`count(*) filter (where ${runtimes.isActive} = true)::int`,
        totalEvals: sql<number>`coalesce(sum(${runtimes.evalCount}), 0)::int`,
        avgTeamScore: sql<number>`round(avg(${runtimes.teamScore})::numeric, 1)`,
        avgAgentScore: sql<number>`round(avg(${runtimes.agentScore})::numeric, 1)`,
        avgUserScore: sql<number>`round(avg(${runtimes.userScore})::numeric, 1)`,
      })
      .from(runtimes);

    const [eventStats] = await db
      .select({
        totalEvents: sql<number>`count(*)::int`,
        eventsToday: sql<number>`count(*) filter (where ${interactionEvents.createdAt} >= current_date)::int`,
      })
      .from(interactionEvents);

    const platformCounts = await db
      .select({
        platform: runtimes.platform,
        count: sql<number>`count(*)::int`,
      })
      .from(runtimes)
      .where(eq(runtimes.isActive, true))
      .groupBy(runtimes.platform)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return reply.send({
      runtimes: {
        total: runtimeStats.totalRuntimes,
        active: runtimeStats.activeRuntimes,
      },
      scores: {
        avgTeam: Number(runtimeStats.avgTeamScore) || 0,
        avgAgent: Number(runtimeStats.avgAgentScore) || 0,
        avgUser: Number(runtimeStats.avgUserScore) || 0,
      },
      events: {
        total: eventStats.totalEvents,
        today: eventStats.eventsToday,
        totalEvals: runtimeStats.totalEvals,
      },
      platforms: platformCounts,
    });
  });
}
