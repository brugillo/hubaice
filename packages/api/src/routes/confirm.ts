import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes } from "../db/schema.js";
import { generateApiKey, hashApiKey } from "../middleware/auth.js";

export async function confirmRoutes(app: FastifyInstance) {
  // GET /api/confirm?token=<tok>
  // Activates runtime, redirects to /confirmed with API key
  app.get("/api/confirm", async (request, reply) => {
    const { token } = request.query as { token?: string };

    if (!token) {
      return reply.code(400).send({ error: "Missing token parameter" });
    }

    // Find runtime by verification token
    const [runtime] = await db
      .select()
      .from(runtimes)
      .where(eq(runtimes.emailVerificationToken, token))
      .limit(1);

    if (!runtime) {
      return reply.code(404).send({ error: "Invalid or expired verification token" });
    }

    // Check if already verified
    if (runtime.emailVerified) {
      return reply.code(410).send({ error: "Email already verified" });
    }

    // Check token expiration
    if (runtime.emailTokenExpires && new Date() > runtime.emailTokenExpires) {
      return reply.code(410).send({ error: "Verification token expired" });
    }

    // Generate a fresh API key for the confirmed runtime
    const newApiKey = generateApiKey();
    const newApiKeyHash = hashApiKey(newApiKey);

    // Activate runtime
    await db
      .update(runtimes)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailTokenExpires: null,
        status: "active",
        isActive: true,
        apiKeyHash: newApiKeyHash,
      })
      .where(eq(runtimes.id, runtime.id));

    // Redirect to confirmed page with API key (shown once)
    const baseUrl = process.env.HUB_BASE_URL || "https://hubaice.com";
    const redirectUrl = `${baseUrl}/confirmed?apiKey=${encodeURIComponent(newApiKey)}&runtimeId=${runtime.id}`;

    return reply.redirect(redirectUrl);
  });
}
