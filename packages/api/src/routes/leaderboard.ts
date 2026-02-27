import type { FastifyInstance } from "fastify";
import { desc, eq, sql, and, gte } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes } from "../db/schema.js";

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get("/api/leaderboard", async (request, reply) => {
    const query = request.query as {
      sort?: string;
      platform?: string;
      model?: string;
      limit?: string;
      offset?: string;
    };

    const sortField = query.sort ?? "team";
    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = Number(query.offset) || 0;

    const sortColumn =
      sortField === "agent"
        ? runtimes.agentScore
        : sortField === "user"
          ? runtimes.userScore
          : runtimes.teamScore;

    const conditions = [eq(runtimes.isActive, true), gte(runtimes.evalCount, 10)];
    if (query.platform) conditions.push(eq(runtimes.platform, query.platform));
    if (query.model) conditions.push(eq(runtimes.model, query.model));

    const entries = await db
      .select({
        id: runtimes.id,
        platform: runtimes.platform,
        model: runtimes.model,
        thinking: runtimes.thinking,
        displayName: runtimes.displayName,
        ownerAlias: runtimes.ownerAlias,
        agentScore: runtimes.agentScore,
        userScore: runtimes.userScore,
        teamScore: runtimes.teamScore,
        evalCount: runtimes.evalCount,
        maturityTier: runtimes.maturityTier,
      })
      .from(runtimes)
      .where(and(...conditions))
      .orderBy(desc(sortColumn))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(runtimes)
      .where(and(...conditions));

    return reply.send({
      entries: entries.map((e, i) => ({
        rank: offset + i + 1,
        ...e,
        agentScore: Number(e.agentScore),
        userScore: Number(e.userScore),
        teamScore: Number(e.teamScore),
      })),
      total: count,
      limit,
      offset,
    });
  });
}
