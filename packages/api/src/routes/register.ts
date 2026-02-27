import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/index.js";
import { runtimes } from "../db/schema.js";
import { generateApiKey, hashApiKey } from "../middleware/auth.js";

const registerSchema = z.object({
  platform: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  thinking: z.string().min(1).max(20),
  displayName: z.string().max(200).optional(),
  ownerAlias: z.string().max(100).optional(),
});

export async function registerRoutes(app: FastifyInstance) {
  app.post("/api/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Validation error",
        details: parsed.error.flatten(),
      });
    }

    const { platform, model, thinking, displayName, ownerAlias } = parsed.data;
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    try {
      const [runtime] = await db
        .insert(runtimes)
        .values({
          apiKeyHash,
          platform,
          model,
          thinking,
          displayName: displayName ?? null,
          ownerAlias: ownerAlias ?? null,
        })
        .returning({ id: runtimes.id });

      const runtimeLabel = `${platform}/${model.split("/").pop()}/${thinking}`;

      return reply.code(201).send({
        runtimeId: runtime.id,
        apiKey,
        runtime: runtimeLabel,
        message: "Guarda tu API key. No se puede recuperar.",
      });
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === "23505") {
        return reply.code(409).send({
          error: "Runtime already registered with this platform/model/thinking/alias combination",
        });
      }
      throw err;
    }
  });
}
