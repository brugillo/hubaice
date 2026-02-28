import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { registrationIntents, runtimes, users } from "../db/schema.js";
import { generateApiKey, hashApiKey } from "../middleware/auth.js";
import { getEmailService } from "../services/email.js";
import { verifyEmailTemplate } from "../templates/verify-email.js";

const MAX_REGISTRATIONS_PER_EMAIL_PER_DAY = 3;

const verifySchema = z.object({
  intentId: z.string().uuid(),
  email: z.string().email().max(255),
  displayName: z.string().max(200).optional(),
});

function generateToken(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export async function verifyRoutes(app: FastifyInstance) {
  // GET /api/verify/:intentId — check intent validity
  app.get("/api/verify/:intentId", async (request, reply) => {
    const { intentId } = request.params as { intentId: string };

    const [intent] = await db
      .select()
      .from(registrationIntents)
      .where(eq(registrationIntents.id, intentId))
      .limit(1);

    if (!intent) {
      return reply.code(404).send({ error: "Intent not found" });
    }

    if (intent.claimed) {
      return reply.code(410).send({ error: "Intent already claimed" });
    }

    if (new Date() > intent.expiresAt) {
      return reply.code(410).send({ error: "Intent expired" });
    }

    return reply.send({
      platform: intent.platform,
      model: intent.model,
      thinking: intent.thinking,
      displayName: intent.displayName,
      expiresAt: intent.expiresAt.toISOString(),
    });
  });

  // POST /api/verify — submit email, create pending runtime, send verification email
  app.post("/api/verify", async (request, reply) => {
    const parsed = verifySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Validation error",
        details: parsed.error.flatten(),
      });
    }

    const { intentId, email, displayName } = parsed.data;

    // Validate intent
    const [intent] = await db
      .select()
      .from(registrationIntents)
      .where(eq(registrationIntents.id, intentId))
      .limit(1);

    if (!intent) {
      return reply.code(404).send({ error: "Intent not found" });
    }

    if (intent.claimed) {
      return reply.code(410).send({ error: "Intent already claimed" });
    }

    if (new Date() > intent.expiresAt) {
      return reply.code(410).send({ error: "Intent expired" });
    }

    // Rate limit: 3 registrations per email per day
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [emailCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(runtimes)
      .where(
        sql`${runtimes.email} = ${email} AND ${runtimes.registeredAt} > ${oneDayAgo}`
      );

    if ((emailCount?.count ?? 0) >= MAX_REGISTRATIONS_PER_EMAIL_PER_DAY) {
      return reply.code(429).send({
        error: "Too many registrations for this email. Try again tomorrow.",
        retryAfter: 86400,
      });
    }

    // Mark intent as claimed
    await db
      .update(registrationIntents)
      .set({ claimed: true, claimedAt: new Date() })
      .where(eq(registrationIntents.id, intentId));

    // Generate verification token and API key
    const verificationToken = generateToken();
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Create or find user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email })
        .returning();
    }

    // Create runtime in pending_email status
    const name = displayName ?? intent.displayName ?? null;
    const [runtime] = await db
      .insert(runtimes)
      .values({
        apiKeyHash,
        platform: intent.platform,
        model: intent.model,
        thinking: intent.thinking,
        displayName: name,
        email,
        emailVerificationToken: verificationToken,
        emailTokenExpires: tokenExpires,
        status: "pending_email",
        intentId,
        userId: user.id,
      })
      .returning({ id: runtimes.id });

    // Send verification email
    const baseUrl = process.env.HUB_BASE_URL || "https://hubaice.com";
    const confirmUrl = `${baseUrl}/api/confirm?token=${verificationToken}`;

    const template = verifyEmailTemplate({
      platform: intent.platform,
      model: intent.model,
      thinking: intent.thinking,
      displayName: name,
      verifyUrl: confirmUrl,
    });

    const emailService = getEmailService();
    await emailService.send({
      to: email,
      subject: template.subject,
      html: template.html,
    });

    return reply.code(200).send({
      message: "Verification email sent",
      runtimeId: runtime.id,
    });
  });
}
