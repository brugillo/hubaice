import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";

// ── Hoisted mocks ─────────────────────────────────────────────────────

const { mockInsert, mockSelectResult, mockUpdate, mockDb } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockSelectResult = vi.fn(() => []);
  const mockUpdate = vi.fn();

  function createChain(): Record<string, unknown> {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            try {
              const result = mockSelectResult();
              if (result && typeof result === "object" && "then" in result) {
                return (result as Promise<unknown>).then(resolve, reject);
              }
              return resolve(result);
            } catch (e) {
              return reject(e);
            }
          };
        }
        return (): Record<string, unknown> => new Proxy({}, handler);
      },
    };
    return new Proxy({}, handler) as Record<string, unknown>;
  }

  const mockDb = {
    insert: () => ({
      values: () => ({
        returning: mockInsert,
      }),
    }),
    select: () => createChain(),
    update: () => ({
      set: () => ({
        where: mockUpdate,
      }),
    }),
  };

  return { mockInsert, mockSelectResult, mockUpdate, mockDb };
});

vi.mock("../../db/index.js", () => ({
  db: mockDb,
}));

const { mockAuthMiddleware } = vi.hoisted(() => {
  const mockAuthMiddleware = vi.fn();
  return { mockAuthMiddleware };
});

vi.mock("../../middleware/auth.js", async () => {
  const { createHash } = await import("node:crypto");
  return {
    hashApiKey: (key: string) => createHash("sha256").update(key).digest("hex"),
    generateApiKey: () => {
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const b64 = Buffer.from(bytes).toString("base64url");
      return `aice_live_${b64}`;
    },
    authMiddleware: mockAuthMiddleware,
  };
});

vi.mock("../../middleware/rate-limit.js", () => ({
  eventRateLimit: vi.fn(async () => {}),
}));

const { mockEmailSend } = vi.hoisted(() => {
  const mockEmailSend = vi.fn(async () => true);
  return { mockEmailSend };
});

vi.mock("../../services/email.js", () => ({
  getEmailService: () => ({
    send: mockEmailSend,
  }),
}));

// ── Imports ──────────────────────────────────────────────────────────

import { registerIntentRoutes } from "../register-intent.js";
import { verifyRoutes } from "../verify.js";
import { confirmRoutes } from "../confirm.js";
import { runtimeRoutes } from "../runtime.js";
import { importRoutes } from "../import.js";

// ── Test helpers ──────────────────────────────────────────────────────

const MOCK_RUNTIME = {
  id: "test-runtime-id",
  apiKeyHash: "testhash",
  platform: "test-platform",
  model: "test-model",
  thinking: "high",
  displayName: "Test",
  ownerAlias: "tester",
  agentScore: "50.0",
  userScore: "50.0",
  teamScore: "50.0",
  evalCount: 10,
  maturityTier: "GREEN",
  techScore: "50.0",
  opsScore: "50.0",
  judgmentScore: "50.0",
  commsScore: "50.0",
  orchScore: "50.0",
  userTechScore: "50.0",
  userOpsScore: "50.0",
  userJudgmentScore: "50.0",
  userCommsScore: "50.0",
  userOrchScore: "50.0",
  techStreak: 0,
  opsStreak: 0,
  judgmentStreak: 0,
  commsStreak: 0,
  orchStreak: 0,
  warmupActive: true,
  warmupEvals: 10,
  isActive: true,
  registeredAt: new Date(),
  lastEventAt: null,
  eventsToday: 0,
  eventsTodayDate: null,
  anomalyFlags: 0,
  quarantine: false,
  dailyCapsJson: {},
  dailyCapsDate: null,
  email: null,
  emailVerified: false,
  emailVerificationToken: null,
  emailTokenExpires: null,
  status: "active",
  intentId: null,
  userId: null,
};

const MOCK_INTENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const MOCK_INTENT = {
  id: MOCK_INTENT_ID,
  platform: "openclaw",
  model: "anthropic/claude-opus-4-6",
  thinking: "high",
  displayName: "ComPi",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
  claimed: false,
  claimedAt: null,
  ip: "127.0.0.1",
};

let app: FastifyInstance;

async function buildApp() {
  const fastify = Fastify();
  await fastify.register(registerIntentRoutes);
  await fastify.register(verifyRoutes);
  await fastify.register(confirmRoutes);
  await fastify.register(runtimeRoutes);
  await fastify.register(importRoutes);
  await fastify.ready();
  return fastify;
}

beforeEach(async () => {
  mockInsert.mockReset();
  mockSelectResult.mockReset().mockReturnValue([]);
  mockUpdate.mockReset();
  mockAuthMiddleware.mockReset();
  mockEmailSend.mockReset().mockResolvedValue(true);

  mockAuthMiddleware.mockImplementation(async (request: Record<string, unknown>) => {
    const authHeader = (request.headers as Record<string, string>)?.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw { statusCode: 401 };
    }
    request.runtime = { ...MOCK_RUNTIME };
  });

  app = await buildApp();
});

afterEach(async () => {
  await app.close();
});

// ══════════════════════════════════════════════════════════════════════
// S1-F3: POST /api/register-intent
// ══════════════════════════════════════════════════════════════════════

describe("POST /api/register-intent", () => {
  it("creates an intent with valid data", async () => {
    // First select for rate limit check
    mockSelectResult.mockReturnValueOnce([{ count: 0 }]);
    // Insert returns new intent
    mockInsert.mockResolvedValueOnce([{ id: "new-intent-id" }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/register-intent",
      payload: {
        platform: "openclaw",
        model: "anthropic/claude-opus-4-6",
        thinking: "high",
        displayName: "ComPi",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.intentId).toBe("new-intent-id");
    expect(body.verifyUrl).toContain("/verify/new-intent-id");
    expect(body.expiresAt).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/register-intent",
      payload: { platform: "test" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("enforces rate limit (10/IP/hour)", async () => {
    mockSelectResult.mockReturnValueOnce([{ count: 10 }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/register-intent",
      payload: {
        platform: "openclaw",
        model: "test",
        thinking: "high",
      },
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.retryAfter).toBe(3600);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1-F3: GET /api/verify/:intentId
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/verify/:intentId", () => {
  it("returns intent data for valid intent", async () => {
    mockSelectResult.mockReturnValueOnce([MOCK_INTENT]);

    const res = await app.inject({
      method: "GET",
      url: "/api/verify/test-intent-id",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.platform).toBe("openclaw");
    expect(body.model).toBe("anthropic/claude-opus-4-6");
    expect(body.thinking).toBe("high");
    expect(body.displayName).toBe("ComPi");
  });

  it("returns 404 for nonexistent intent", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/verify/nonexistent-id",
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 410 for claimed intent", async () => {
    mockSelectResult.mockReturnValueOnce([{ ...MOCK_INTENT, claimed: true }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/verify/test-intent-id",
    });

    expect(res.statusCode).toBe(410);
  });

  it("returns 410 for expired intent", async () => {
    mockSelectResult.mockReturnValueOnce([{
      ...MOCK_INTENT,
      expiresAt: new Date(Date.now() - 1000), // expired
    }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/verify/test-intent-id",
    });

    expect(res.statusCode).toBe(410);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1-F3: POST /api/verify
// ══════════════════════════════════════════════════════════════════════

describe("POST /api/verify", () => {
  it("creates pending runtime and sends email", async () => {
    // 1st select: find intent
    mockSelectResult.mockReturnValueOnce([MOCK_INTENT]);
    // 2nd select: email rate limit check
    mockSelectResult.mockReturnValueOnce([{ count: 0 }]);
    // update: mark intent as claimed
    mockUpdate.mockResolvedValueOnce(undefined);
    // 3rd select: find existing user
    mockSelectResult.mockReturnValueOnce([]);
    // insert: create user
    mockInsert.mockResolvedValueOnce([{ id: "new-user-id", email: "test@example.com" }]);
    // insert: create runtime
    mockInsert.mockResolvedValueOnce([{ id: "new-runtime-id" }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/verify",
      payload: {
        intentId: MOCK_INTENT_ID,
        email: "test@example.com",
        displayName: "My Runtime",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe("Verification email sent");
    expect(body.runtimeId).toBe("new-runtime-id");
    expect(mockEmailSend).toHaveBeenCalledOnce();
  });

  it("rejects invalid email", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/verify",
      payload: {
        intentId: MOCK_INTENT_ID,
        email: "not-an-email",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("enforces 3 registrations per email per day", async () => {
    mockSelectResult.mockReturnValueOnce([MOCK_INTENT]); // find intent
    mockSelectResult.mockReturnValueOnce([{ count: 3 }]); // email rate limit

    const res = await app.inject({
      method: "POST",
      url: "/api/verify",
      payload: {
        intentId: MOCK_INTENT_ID,
        email: "test@example.com",
      },
    });

    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.retryAfter).toBe(86400);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1-F3: GET /api/confirm
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/confirm", () => {
  it("activates runtime and redirects", async () => {
    mockSelectResult.mockReturnValueOnce([{
      ...MOCK_RUNTIME,
      emailVerified: false,
      emailVerificationToken: "test-token",
      emailTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "pending_email",
    }]);
    mockUpdate.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: "GET",
      url: "/api/confirm?token=test-token",
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("/confirmed?apiKey=");
    expect(res.headers.location).toContain("&runtimeId=test-runtime-id");
  });

  it("returns 400 for missing token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/confirm",
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for invalid token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/confirm?token=invalid-token",
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 410 for already verified runtime", async () => {
    mockSelectResult.mockReturnValueOnce([{
      ...MOCK_RUNTIME,
      emailVerified: true,
      emailVerificationToken: "test-token",
    }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/confirm?token=test-token",
    });

    expect(res.statusCode).toBe(410);
  });

  it("returns 410 for expired token", async () => {
    mockSelectResult.mockReturnValueOnce([{
      ...MOCK_RUNTIME,
      emailVerified: false,
      emailVerificationToken: "test-token",
      emailTokenExpires: new Date(Date.now() - 1000), // expired
    }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/confirm?token=test-token",
    });

    expect(res.statusCode).toBe(410);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1-F4: GET /api/runtime/:id/public
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/runtime/:id/public", () => {
  it("returns full public runtime data", async () => {
    // 1st select: find runtime
    mockSelectResult.mockReturnValueOnce([MOCK_RUNTIME]);
    // 2nd select: domain evaluation counts
    mockSelectResult.mockReturnValueOnce([
      { domain: "TECH", count: 20 },
      { domain: "OPS", count: 15 },
    ]);
    // 3rd select: daily snapshots
    mockSelectResult.mockReturnValueOnce([]);
    // 4th select: anti-patterns
    mockSelectResult.mockReturnValueOnce([
      { code: "AP001", severity: "medio", occurrences: 3 },
    ]);
    // 5th select: pro-patterns
    mockSelectResult.mockReturnValueOnce([
      { code: "PP001", occurrences: 5 },
    ]);
    // 6th select: last event
    mockSelectResult.mockReturnValueOnce([{ createdAt: new Date() }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/runtime/test-runtime-id/public",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.runtimeId).toBe("test-runtime-id");
    expect(body.globalScore).toBe(50);
    expect(body.domains).toBeDefined();
    expect(body.domains.TECH).toBeDefined();
    expect(body.domains.TECH.score).toBe(50);
    expect(body.domains.TECH.evaluations).toBe(20);
    expect(body.maturity).toBeDefined();
    expect(body.maturity.tier).toBe("GREEN");
    expect(body.maturity.tierLabel).toBe("Seedling");
    expect(body.history30d).toBeDefined();
    expect(body.antiPatterns).toHaveLength(1);
    expect(body.proPatterns).toHaveLength(1);
    expect(body.lastActivity).toBeDefined();

    // Check cache headers
    expect(res.headers["cache-control"]).toContain("max-age=60");
  });

  it("returns 404 for nonexistent runtime", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/runtime/nonexistent/public",
    });

    expect(res.statusCode).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1-F5: POST /api/import/state
// ══════════════════════════════════════════════════════════════════════

describe("POST /api/import/state", () => {
  it("imports runtime state", async () => {
    mockUpdate.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: "POST",
      url: "/api/import/state",
      headers: { authorization: "Bearer test_key" },
      payload: {
        platform: "openclaw",
        model: "anthropic/claude-opus-4-6",
        thinking: "high",
        displayName: "ComPi",
        domains: {
          TECH: { score: 65, streak: 3, evaluations: 50 },
          OPS: { score: 55, streak: 1, evaluations: 30 },
          JUDGMENT: { score: 70, streak: 5 },
          COMMS: { score: 45 },
          ORCH: { score: 60 },
        },
        globalScore: 59,
        maturity: {
          totalEvaluations: 200,
          tier: "YELLOW",
          tierLabel: "Growing",
          tierEmoji: "\ud83c\udf3f",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe("State imported successfully");
    expect(body.runtimeId).toBe("test-runtime-id");
    expect(body.globalScore).toBe(59);
    expect(body.evalCount).toBe(200);
  });

  it("requires authentication", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/import/state",
      payload: {
        platform: "test",
        model: "test",
        thinking: "high",
        domains: {},
        globalScore: 50,
        maturity: { totalEvaluations: 0, tier: "GREEN" },
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1-F5: POST /api/import/event
// ══════════════════════════════════════════════════════════════════════

describe("POST /api/import/event", () => {
  it("imports an evaluation event", async () => {
    // Idempotency check: not found
    mockSelectResult.mockReturnValueOnce([]);
    // Insert
    mockInsert.mockResolvedValueOnce([{ id: "imported-event-id" }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/import/event",
      headers: { authorization: "Bearer test_key" },
      payload: {
        type: "evaluation",
        side: "agent",
        result: "error",
        domain: "TECH",
        severity: "medio",
        delta: -3,
        scoreBefore: 50,
        scoreAfter: 47,
        timestamp: "2026-02-20T10:00:00Z",
        externalId: "ext-123",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.eventId).toBe("imported-event-id");
  });

  it("returns 409 for duplicate externalId", async () => {
    mockSelectResult.mockReturnValueOnce([{ id: "existing-event-id" }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/import/event",
      headers: { authorization: "Bearer test_key" },
      payload: {
        type: "evaluation",
        result: "error",
        delta: -3,
        timestamp: "2026-02-20T10:00:00Z",
        externalId: "ext-123",
      },
    });

    expect(res.statusCode).toBe(409);
  });
});

// ══════════════════════════════════════════════════════════════════════
// S1-F5: POST /api/import/interaction
// ══════════════════════════════════════════════════════════════════════

describe("POST /api/import/interaction", () => {
  it("imports an interaction", async () => {
    // Idempotency check: not found
    mockSelectResult.mockReturnValueOnce([]);
    // Insert
    mockInsert.mockResolvedValueOnce([{ id: "imported-interaction-id" }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/import/interaction",
      headers: { authorization: "Bearer test_key" },
      payload: {
        externalId: "int-123",
        date: "2026-02-20",
        task: "Implement feature X",
        userScore: 85,
        agentScore: 70,
        quadrant: "GOOD",
        timestamp: "2026-02-20T12:00:00Z",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.eventId).toBe("imported-interaction-id");
  });

  it("returns 409 for duplicate interaction", async () => {
    mockSelectResult.mockReturnValueOnce([{ id: "existing-id" }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/import/interaction",
      headers: { authorization: "Bearer test_key" },
      payload: {
        externalId: "int-123",
        date: "2026-02-20",
        timestamp: "2026-02-20T12:00:00Z",
      },
    });

    expect(res.statusCode).toBe(409);
  });
});
