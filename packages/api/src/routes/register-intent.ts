import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { registrationIntents } from "../db/schema.js";

const INTENT_TTL_MINUTES = 15;
const MAX_INTENTS_PER_IP_PER_HOUR = 10;

const intentSchema = z.object({
  platform: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  thinking: z.string().min(1).max(20),
  displayName: z.string().max(200).optional(),
});

export async function registerIntentRoutes(app: FastifyInstance) {
  app.post("/api/register-intent", async (request, reply) => {
    const parsed = intentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Validation error",
        details: parsed.error.flatten(),
      });
    }

    const clientIp = request.ip;

    // Rate limit: 10 intents per IP per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(registrationIntents)
      .where(
        sql`${registrationIntents.ip} = ${clientIp} AND ${registrationIntents.createdAt} > ${oneHourAgo}`
      );

    if ((countResult?.count ?? 0) >= MAX_INTENTS_PER_IP_PER_HOUR) {
      return reply.code(429).send({
        error: "Too many registration intents. Try again later.",
        retryAfter: 3600,
      });
    }

    const { platform, model, thinking, displayName } = parsed.data;
    const expiresAt = new Date(Date.now() + INTENT_TTL_MINUTES * 60 * 1000);

    const [intent] = await db
      .insert(registrationIntents)
      .values({
        platform,
        model,
        thinking,
        displayName: displayName ?? null,
        expiresAt,
        ip: clientIp,
      })
      .returning({ id: registrationIntents.id });

    const baseUrl = process.env.HUB_BASE_URL || "https://hubaice.com";
    const verifyUrl = `${baseUrl}/verify/${intent.id}`;

    return reply.code(201).send({
      intentId: intent.id,
      verifyUrl,
      expiresAt: expiresAt.toISOString(),
    });
  });
}
