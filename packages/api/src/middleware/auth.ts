import { createHash } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { runtimes } from "../db/schema.js";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = Buffer.from(bytes).toString("base64url");
  return `aice_live_${b64}`;
}

declare module "fastify" {
  interface FastifyRequest {
    runtime?: typeof runtimes.$inferSelect;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Missing or invalid Authorization header" });
  }

  const apiKey = authHeader.slice(7);
  const hash = hashApiKey(apiKey);

  const [runtime] = await db
    .select()
    .from(runtimes)
    .where(eq(runtimes.apiKeyHash, hash))
    .limit(1);

  if (!runtime) {
    return reply.code(401).send({ error: "Invalid API key" });
  }

  if (runtime.quarantine) {
    return reply.code(403).send({ error: "Runtime is quarantined" });
  }

  request.runtime = runtime;
}
