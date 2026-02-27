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

// ── Imports ──────────────────────────────────────────────────────────

import { registerRoutes } from "../register.js";
import { eventsRoutes } from "../events.js";
import { leaderboardRoutes } from "../leaderboard.js";
import { runtimeRoutes } from "../runtime.js";
import { statsRoutes } from "../stats.js";

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
};

let app: FastifyInstance;

async function buildApp() {
  const fastify = Fastify();
  await fastify.register(registerRoutes);
  await fastify.register(eventsRoutes);
  await fastify.register(leaderboardRoutes);
  await fastify.register(runtimeRoutes);
  await fastify.register(statsRoutes);

  fastify.get("/api/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  await fastify.ready();
  return fastify;
}

beforeEach(async () => {
  // Reset all mock functions to clear return value queues
  mockInsert.mockReset();
  mockSelectResult.mockReset().mockReturnValue([]); // default: return empty
  mockUpdate.mockReset();
  mockAuthMiddleware.mockReset();

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
// HEALTH CHECK
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
// POST /api/register
// ══════════════════════════════════════════════════════════════════════

describe("POST /api/register", () => {
  it("registers a runtime with valid data", async () => {
    mockInsert.mockResolvedValueOnce([{ id: "new-runtime-id" }]);

    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        platform: "claude-code",
        model: "anthropic/claude-opus-4-6",
        thinking: "high",
        displayName: "ComPi",
        ownerAlias: "brugillo",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.runtimeId).toBe("new-runtime-id");
    expect(body.apiKey).toMatch(/^aice_live_/);
    expect(body.runtime).toContain("claude-code");
    expect(body.message).toBeDefined();
  });

  it("rejects missing required fields", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: { platform: "test" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Validation error");
  });

  it("rejects empty platform", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        platform: "",
        model: "test",
        thinking: "high",
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("handles duplicate registration (409)", async () => {
    mockInsert.mockRejectedValueOnce({ code: "23505" });

    const res = await app.inject({
      method: "POST",
      url: "/api/register",
      payload: {
        platform: "test",
        model: "test",
        thinking: "high",
      },
    });

    expect(res.statusCode).toBe(409);
  });
});

// ══════════════════════════════════════════════════════════════════════
// POST /api/events
// ══════════════════════════════════════════════════════════════════════

describe("POST /api/events", () => {
  it("validates event schema — rejects invalid side", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { authorization: "Bearer test_key" },
      payload: { side: "invalid" },
    });

    expect(res.statusCode).toBe(422);
  });

  it("requires severity for error events", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { authorization: "Bearer test_key" },
      payload: {
        side: "agent",
        eventType: "error",
        domain: "TECH",
        timestamp: new Date().toISOString(),
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.rejection).toBe("MISSING_SEVERITY");
  });

  it("processes a valid error event", async () => {
    // No patternCode/sessionId → reincidence check is skipped
    // Only 1 select call: re-read runtime after update
    mockSelectResult.mockReturnValueOnce([{
      ...MOCK_RUNTIME,
      agentScore: "47.0",
      techScore: "47.0",
      teamScore: "48.5",
      evalCount: 11,
    }]);
    mockInsert.mockResolvedValueOnce([{ id: "event-id-1" }]);
    mockUpdate.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { authorization: "Bearer test_key" },
      payload: {
        side: "agent",
        eventType: "error",
        domain: "TECH",
        severity: "medio",
        timestamp: new Date().toISOString(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(true);
    expect(body.eventId).toBe("event-id-1");
    expect(body.scoring).toBeDefined();
    expect(body.scoring.delta).toBe(-3);
    expect(body.state).toBeDefined();
  });

  it("processes a correct event with no delta", async () => {
    // No patternCode/sessionId → reincidence check skipped
    mockSelectResult.mockReturnValueOnce([{
      ...MOCK_RUNTIME,
      techStreak: 1,
      evalCount: 11,
    }]);
    mockInsert.mockResolvedValueOnce([{ id: "event-id-2" }]);
    mockUpdate.mockResolvedValueOnce(undefined);

    const res = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { authorization: "Bearer test_key" },
      payload: {
        side: "agent",
        eventType: "correct",
        domain: "TECH",
        timestamp: new Date().toISOString(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accepted).toBe(true);
    expect(body.scoring.delta).toBe(0);
    expect(body.scoring.streakAfter).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// GET /api/leaderboard
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/leaderboard", () => {
  it("returns leaderboard entries", async () => {
    mockSelectResult
      .mockReturnValueOnce([ // entries
        {
          id: "r1",
          platform: "test",
          model: "model1",
          thinking: "high",
          displayName: "Test Bot",
          ownerAlias: "owner1",
          agentScore: "65.0",
          userScore: "55.0",
          teamScore: "60.0",
          evalCount: 100,
          maturityTier: "GREEN",
        },
      ])
      .mockReturnValueOnce([{ count: 1 }]); // count

    const res = await app.inject({
      method: "GET",
      url: "/api/leaderboard?sort=team&limit=10",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].rank).toBe(1);
    expect(body.entries[0].teamScore).toBe(60);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(10);
  });

  it("defaults to team sort and limit 50", async () => {
    mockSelectResult
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ count: 0 }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/leaderboard",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.entries).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(50);
  });

  it("caps limit at 100", async () => {
    mockSelectResult
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ count: 0 }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/leaderboard?limit=500",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.limit).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════════════════
// GET /api/runtime/:id
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/runtime/:id", () => {
  it("returns runtime info for valid id", async () => {
    mockSelectResult.mockReturnValueOnce([{
      id: "runtime-1",
      platform: "claude-code",
      model: "claude-opus",
      thinking: "high",
      displayName: "Test Bot",
      ownerAlias: "tester",
      agentScore: "60.0",
      userScore: "55.0",
      teamScore: "57.5",
      evalCount: 42,
      maturityTier: "GREEN",
      registeredAt: new Date().toISOString(),
    }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/runtime/runtime-1",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe("runtime-1");
    expect(body.platform).toBe("claude-code");
    expect(body.agentScore).toBe(60);
    expect(body.userScore).toBe(55);
    expect(body.teamScore).toBe(57.5);
  });

  it("returns 404 for non-existent runtime", async () => {
    // Default mockSelectResult returns [] (set in beforeEach)
    const res = await app.inject({
      method: "GET",
      url: "/api/runtime/nonexistent-id",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("Runtime not found");
  });
});

// ══════════════════════════════════════════════════════════════════════
// GET /api/runtime/:id/state
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/runtime/:id/state", () => {
  it("returns full state for authenticated runtime", async () => {
    mockSelectResult.mockReturnValueOnce([{
      id: "event-1",
      createdAt: new Date().toISOString(),
    }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/runtime/test-runtime-id/state",
      headers: { authorization: "Bearer test_key" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.state).toBeDefined();
    expect(body.state.agent).toBeDefined();
    expect(body.state.user).toBeDefined();
    expect(body.state.team).toBeDefined();
    expect(body.state.maturity).toBeDefined();
    expect(body.state.warmup).toBeDefined();
    expect(body.lastEventId).toBe("event-1");
  });

  it("rejects if runtime id does not match auth", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/runtime/different-id/state",
      headers: { authorization: "Bearer test_key" },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error).toContain("does not match");
  });
});

// ══════════════════════════════════════════════════════════════════════
// GET /api/stats
// ══════════════════════════════════════════════════════════════════════

describe("GET /api/stats", () => {
  it("returns global statistics", async () => {
    mockSelectResult
      .mockReturnValueOnce([{ // runtime stats (1st select)
        totalRuntimes: 10,
        activeRuntimes: 8,
        totalEvals: 500,
        avgTeamScore: 55.3,
        avgAgentScore: 52.1,
        avgUserScore: 48.7,
      }])
      .mockReturnValueOnce([{ // event stats (2nd select)
        totalEvents: 1200,
        eventsToday: 45,
      }])
      .mockReturnValueOnce([ // platform counts (3rd select)
        { platform: "claude-code", count: 5 },
        { platform: "openclaw", count: 3 },
      ]);

    const res = await app.inject({
      method: "GET",
      url: "/api/stats",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.runtimes.total).toBe(10);
    expect(body.runtimes.active).toBe(8);
    expect(body.scores.avgTeam).toBe(55.3);
    expect(body.events.total).toBe(1200);
    expect(body.events.today).toBe(45);
    expect(body.events.totalEvals).toBe(500);
    expect(body.platforms).toHaveLength(2);
  });
});
