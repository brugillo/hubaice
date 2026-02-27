import { describe, it, expect } from "vitest";
import {
  accValue,
  streakDelta,
  computeGlobalScore,
  computeMaturityTier,
  confidenceInterval,
  calculateBaseDelta,
  processEvent,
  applyDailyCap,
  buildFullState,
} from "../scoring-engine.js";
import { computeTeamScore, determineQuadrant } from "../team-score.js";
import type { Runtime } from "../../db/schema.js";
import type { Domain, EventInput } from "../../types.js";

// ── Helper: create a default runtime ────────────────────────────────

function makeRuntime(overrides: Partial<Runtime> = {}): Runtime {
  return {
    id: "test-uuid",
    apiKeyHash: "hash",
    platform: "test",
    model: "test-model",
    thinking: "high",
    displayName: "Test Runtime",
    ownerAlias: "tester",
    registeredAt: new Date(),
    isActive: true,
    agentScore: "50.0",
    userScore: "50.0",
    teamScore: "50.0",
    evalCount: 0,
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
    warmupEvals: 0,
    lastEventAt: null,
    eventsToday: 0,
    eventsTodayDate: null,
    anomalyFlags: 0,
    quarantine: false,
    dailyCapsJson: {},
    dailyCapsDate: null,
    ...overrides,
  } as unknown as Runtime;
}

function makeEvent(overrides: Partial<EventInput> = {}): EventInput {
  return {
    side: "agent",
    eventType: "error",
    domain: "TECH",
    severity: "medio",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// ACC TABLE
// ══════════════════════════════════════════════════════════════════════

describe("ACC Table", () => {
  it("returns correct cumulative values", () => {
    expect(accValue(0)).toBe(0);
    expect(accValue(3)).toBe(0);
    expect(accValue(4)).toBe(1);
    expect(accValue(5)).toBe(2);
    expect(accValue(6)).toBe(4);
    expect(accValue(7)).toBe(6);
    expect(accValue(8)).toBe(8);
    expect(accValue(9)).toBe(10);
    expect(accValue(10)).toBe(12);
  });

  it("caps at 10", () => {
    expect(accValue(11)).toBe(12);
    expect(accValue(100)).toBe(12);
  });

  it("clamps negatives to 0", () => {
    expect(accValue(-1)).toBe(0);
  });

  it("computes streak deltas correctly", () => {
    // No reward until streak 4
    expect(streakDelta(1)).toBe(0);
    expect(streakDelta(2)).toBe(0);
    expect(streakDelta(3)).toBe(0);
    // First reward at streak 4
    expect(streakDelta(4)).toBe(1); // ACC[4] - ACC[3] = 1 - 0
    expect(streakDelta(5)).toBe(1); // ACC[5] - ACC[4] = 2 - 1
    expect(streakDelta(6)).toBe(2); // ACC[6] - ACC[5] = 4 - 2
    expect(streakDelta(7)).toBe(2); // ACC[7] - ACC[6] = 6 - 4
    expect(streakDelta(8)).toBe(2); // ACC[8] - ACC[7] = 8 - 6
    expect(streakDelta(9)).toBe(2); // ACC[9] - ACC[8] = 10 - 8
    expect(streakDelta(10)).toBe(2); // ACC[10] - ACC[9] = 12 - 10
  });
});

// ══════════════════════════════════════════════════════════════════════
// GLOBAL SCORE
// ══════════════════════════════════════════════════════════════════════

describe("computeGlobalScore", () => {
  it("averages all domains equally by default", () => {
    const scores: Record<Domain, number> = {
      TECH: 50, OPS: 50, JUDGMENT: 50, COMMS: 50, ORCH: 50,
    };
    expect(computeGlobalScore(scores)).toBe(50);
  });

  it("computes weighted average", () => {
    const scores: Record<Domain, number> = {
      TECH: 80, OPS: 60, JUDGMENT: 40, COMMS: 20, ORCH: 100,
    };
    // (80+60+40+20+100) / 5 = 60
    expect(computeGlobalScore(scores)).toBe(60);
  });
});

// ══════════════════════════════════════════════════════════════════════
// MATURITY
// ══════════════════════════════════════════════════════════════════════

describe("Maturity", () => {
  it("computes tiers correctly", () => {
    expect(computeMaturityTier(0)).toBe("GREEN");
    expect(computeMaturityTier(50)).toBe("GREEN");
    expect(computeMaturityTier(100)).toBe("GREEN");
    expect(computeMaturityTier(101)).toBe("YELLOW");
    expect(computeMaturityTier(500)).toBe("YELLOW");
    expect(computeMaturityTier(501)).toBe("ORANGE");
    expect(computeMaturityTier(2000)).toBe("ORANGE");
    expect(computeMaturityTier(2001)).toBe("BLUE");
    expect(computeMaturityTier(10000)).toBe("BLUE");
  });

  it("computes confidence interval: CI = 25/sqrt(evals)", () => {
    expect(confidenceInterval(0)).toBe(25);
    expect(confidenceInterval(1)).toBe(25);
    expect(confidenceInterval(25)).toBe(5);
    expect(confidenceInterval(100)).toBe(2.5);
    expect(confidenceInterval(625)).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// BASE DELTA CALCULATION
// ══════════════════════════════════════════════════════════════════════

describe("calculateBaseDelta", () => {
  it("error severities: leve=-1, medio=-3, grave=-5, critico=-10", () => {
    expect(calculateBaseDelta(makeEvent({ severity: "leve" }))).toBe(-1);
    expect(calculateBaseDelta(makeEvent({ severity: "medio" }))).toBe(-3);
    expect(calculateBaseDelta(makeEvent({ severity: "grave" }))).toBe(-5);
    expect(calculateBaseDelta(makeEvent({ severity: "critico" }))).toBe(-10);
  });

  it("correct = 0 (benefit via streak)", () => {
    expect(calculateBaseDelta(makeEvent({ eventType: "correct" }))).toBe(0);
  });

  it("pro_pattern = +3 fixed", () => {
    expect(calculateBaseDelta(makeEvent({ eventType: "pro_pattern" }))).toBe(3);
  });

  it("bonus uses bonusAmount", () => {
    expect(calculateBaseDelta(makeEvent({ eventType: "bonus", bonusAmount: 2 }))).toBe(2);
  });

  it("exceptional uses bonusAmount", () => {
    expect(calculateBaseDelta(makeEvent({ eventType: "exceptional", bonusAmount: 7 }))).toBe(7);
  });
});

// ══════════════════════════════════════════════════════════════════════
// PROCESS EVENT — Core scoring pipeline
// ══════════════════════════════════════════════════════════════════════

describe("processEvent", () => {
  it("processes a basic error event", () => {
    const runtime = makeRuntime();
    const event = makeEvent({ severity: "medio", domain: "TECH" });

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    expect(scoring.delta).toBe(-3);
    expect(scoring.domainScoreAfter).toBe(47);
    expect(scoring.streakAfter).toBe(0); // error resets streak
    expect(scoring.wasReincidence).toBe(false);
    expect(scoring.wasCluster).toBe(false);
    expect(scoring.evalCount).toBe(1);
  });

  it("processes a correct event — no delta, streak +1", () => {
    const runtime = makeRuntime();
    const event = makeEvent({ eventType: "correct", domain: "TECH" });

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    expect(scoring.delta).toBe(0); // correct at streak 1 → ACC delta 0
    expect(scoring.domainScoreAfter).toBe(50);
    expect(scoring.streakAfter).toBe(1);
  });

  it("pro_pattern gives +3 and increments streak", () => {
    const runtime = makeRuntime();
    const event = makeEvent({ eventType: "pro_pattern", domain: "JUDGMENT" });

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    expect(scoring.delta).toBe(3); // base +3, no streak bonus at streak 1
    expect(scoring.domainScoreAfter).toBe(53);
    expect(scoring.streakAfter).toBe(1);
  });

  it("streak builds ACC reward after 4 consecutive", () => {
    const runtime = makeRuntime({ techStreak: 3 });
    const event = makeEvent({ eventType: "correct", domain: "TECH" });

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    // streak goes 3→4, ACC delta = ACC[4]-ACC[3] = 1-0 = 1
    expect(scoring.streakAfter).toBe(4);
    expect(scoring.delta).toBe(1); // 0 (correct base) + 1 (ACC)
    expect(scoring.domainScoreAfter).toBe(51);
  });

  it("error resets streak to 0", () => {
    const runtime = makeRuntime({ techStreak: 7 });
    const event = makeEvent({ severity: "leve", domain: "TECH" });

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    expect(scoring.streakAfter).toBe(0);
    expect(scoring.delta).toBe(-1);
  });

  it("reincidence overrides to -10", () => {
    const runtime = makeRuntime();
    const event = makeEvent({
      severity: "leve",
      patternCode: "HALLUCINATION",
      sessionId: "s1",
    });

    const { scoring } = processEvent({ runtime, event, isReincidence: true });

    expect(scoring.delta).toBe(-10);
    expect(scoring.wasReincidence).toBe(true);
    expect(scoring.domainScoreAfter).toBe(40);
  });

  it("cluster ref reduces delta by 50%", () => {
    const runtime = makeRuntime();
    const event = makeEvent({
      severity: "grave",
      domain: "OPS",
      clusterRef: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    // base = -5, cluster = -5 * 0.5 = -2.5
    expect(scoring.delta).toBe(-2.5);
    expect(scoring.wasCluster).toBe(true);
    expect(scoring.domainScoreAfter).toBe(47.5);
  });

  it("updates user-side scores when side=user", () => {
    const runtime = makeRuntime();
    const event = makeEvent({
      side: "user",
      eventType: "error",
      severity: "medio",
      domain: "COMMS",
    });

    const { scoring, updates } = processEvent({ runtime, event, isReincidence: false });

    expect(scoring.delta).toBe(-3);
    expect(scoring.domainScoreAfter).toBe(47);
    // User score should be updated
    expect(updates.userCommsScore).toBe("47.0");
    expect(updates.userScore).toBeDefined();
  });

  it("clamps domain score to -100/+100", () => {
    const runtime = makeRuntime({ techScore: "-98.0" as unknown as string });
    const event = makeEvent({ severity: "grave", domain: "TECH" });

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    expect(scoring.domainScoreAfter).toBe(-100); // -98 + (-5) = -103 → clamped to -100
  });

  it("increments eval count", () => {
    const runtime = makeRuntime({ evalCount: 10 });
    const event = makeEvent();

    const { scoring } = processEvent({ runtime, event, isReincidence: false });

    expect(scoring.evalCount).toBe(11);
  });

  it("warmup deactivates at 40 evals", () => {
    const runtime = makeRuntime({ evalCount: 39, warmupActive: true });
    const event = makeEvent();

    const { updates } = processEvent({ runtime, event, isReincidence: false });

    expect(updates.warmupActive).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// DAILY CAPS
// ══════════════════════════════════════════════════════════════════════

describe("applyDailyCap", () => {
  it("caps positive delta in warmup at +15 per domain", () => {
    const runtime = makeRuntime({
      warmupActive: true,
      dailyCapsJson: { TECH: { positive: 14, negative: 0 } },
      dailyCapsDate: new Date().toISOString().slice(0, 10),
    });

    const { cappedDelta, capApplied } = applyDailyCap(5, runtime, "TECH");
    expect(cappedDelta).toBe(1); // only 1 remaining
    expect(capApplied).toBe(true);
  });

  it("caps negative delta in normal mode at -20 per domain", () => {
    const runtime = makeRuntime({
      warmupActive: false,
      dailyCapsJson: { OPS: { positive: 0, negative: -18 } },
      dailyCapsDate: new Date().toISOString().slice(0, 10),
    });

    const { cappedDelta, capApplied } = applyDailyCap(-5, runtime, "OPS");
    expect(cappedDelta).toBe(-2); // -20 - (-18) = -2 remaining
    expect(capApplied).toBe(true);
  });

  it("no cap when within limits", () => {
    const runtime = makeRuntime({ warmupActive: true });

    const { cappedDelta, capApplied } = applyDailyCap(3, runtime, "TECH");
    expect(cappedDelta).toBe(3);
    expect(capApplied).toBe(false);
  });

  it("returns 0 delta when cap fully exhausted", () => {
    const runtime = makeRuntime({
      warmupActive: false,
      dailyCapsJson: { TECH: { positive: 10, negative: 0 } },
      dailyCapsDate: new Date().toISOString().slice(0, 10),
    });

    const { cappedDelta, capApplied } = applyDailyCap(3, runtime, "TECH");
    expect(cappedDelta).toBe(0);
    expect(capApplied).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// TEAM SCORE
// ══════════════════════════════════════════════════════════════════════

describe("Team Score", () => {
  it("GOOD quadrant: 50/50 split", () => {
    expect(determineQuadrant(60, 70)).toBe("GOOD");
    expect(computeTeamScore(60, 70)).toBe(65);
  });

  it("COMPENSATED: agent carries (100/0)", () => {
    expect(determineQuadrant(70, 30)).toBe("COMPENSATED");
    expect(computeTeamScore(70, 30)).toBe(70); // 70*1 + 30*0
  });

  it("PROBLEM: user carries (0/100)", () => {
    expect(determineQuadrant(30, 70)).toBe("PROBLEM");
    expect(computeTeamScore(30, 70)).toBe(70); // 30*0 + 70*1
  });

  it("BREAKDOWN: 50/50 split", () => {
    expect(determineQuadrant(30, 30)).toBe("BREAKDOWN");
    expect(computeTeamScore(30, 30)).toBe(30);
  });

  it("boundary: both at 50 = GOOD", () => {
    expect(determineQuadrant(50, 50)).toBe("GOOD");
    expect(computeTeamScore(50, 50)).toBe(50);
  });
});

// ══════════════════════════════════════════════════════════════════════
// BUILD FULL STATE
// ══════════════════════════════════════════════════════════════════════

describe("buildFullState", () => {
  it("constructs complete state from runtime", () => {
    const runtime = makeRuntime({
      agentScore: "65.0",
      userScore: "45.0",
      teamScore: "55.0",
      techScore: "70.0",
      opsScore: "60.0",
      judgmentScore: "50.0",
      commsScore: "80.0",
      orchScore: "65.0",
      evalCount: 50,
      maturityTier: "GREEN",
      warmupActive: false,
      techStreak: 3,
    });

    const state = buildFullState(runtime);

    expect(state.agent.global).toBe(65);
    expect(state.agent.domains.TECH.score).toBe(70);
    expect(state.agent.domains.TECH.streak).toBe(3);
    expect(state.user.global).toBe(45);
    expect(state.team).toBe(55);
    expect(state.maturity.tier).toBe("GREEN");
    expect(state.maturity.evalCount).toBe(50);
    expect(state.warmup.active).toBe(false);
    expect(state.warmup.remaining).toBe(0);
  });

  it("computes warmup remaining correctly", () => {
    const runtime = makeRuntime({ evalCount: 15, warmupActive: true });
    const state = buildFullState(runtime);

    expect(state.warmup.active).toBe(true);
    expect(state.warmup.remaining).toBe(25); // 40 - 15
  });
});

// ══════════════════════════════════════════════════════════════════════
// INTEGRATION: Multi-event sequence
// ══════════════════════════════════════════════════════════════════════

describe("Multi-event scoring sequence", () => {
  it("simulates 5 corrects building a streak, then error resets", () => {
    let runtime = makeRuntime();

    // 5 correct events in TECH
    for (let i = 0; i < 5; i++) {
      const event = makeEvent({ eventType: "correct", domain: "TECH" });
      const { scoring, updates } = processEvent({
        runtime,
        event,
        isReincidence: false,
      });

      // Merge updates into runtime for next iteration
      runtime = { ...runtime, ...updates } as unknown as Runtime;

      if (i < 3) {
        // Streaks 1-3: no ACC reward
        expect(scoring.streakAfter).toBe(i + 1);
        expect(scoring.delta).toBe(0);
      } else if (i === 3) {
        // Streak 4: first reward (+1)
        expect(scoring.streakAfter).toBe(4);
        expect(scoring.delta).toBe(1);
      } else {
        // Streak 5: +1 reward
        expect(scoring.streakAfter).toBe(5);
        expect(scoring.delta).toBe(1);
      }
    }

    // Error breaks the streak
    const errorEvent = makeEvent({ severity: "medio", domain: "TECH" });
    const { scoring: errorScoring } = processEvent({
      runtime,
      event: errorEvent,
      isReincidence: false,
    });

    expect(errorScoring.streakAfter).toBe(0);
    expect(errorScoring.delta).toBe(-3);
  });

  it("agent error + user error both lower team score", () => {
    let runtime = makeRuntime();

    // Agent error in TECH
    const agentError = makeEvent({
      side: "agent",
      severity: "grave",
      domain: "TECH",
    });
    const { updates: agentUpdates } = processEvent({
      runtime,
      event: agentError,
      isReincidence: false,
    });
    runtime = { ...runtime, ...agentUpdates } as unknown as Runtime;

    // User error in COMMS
    const userError = makeEvent({
      side: "user",
      eventType: "error",
      severity: "medio",
      domain: "COMMS",
    });
    const { updates: userUpdates } = processEvent({
      runtime,
      event: userError,
      isReincidence: false,
    });
    runtime = { ...runtime, ...userUpdates } as unknown as Runtime;

    // Both scores should have decreased
    expect(Number(runtime.agentScore)).toBeLessThan(50);
    expect(Number(runtime.userScore)).toBeLessThan(50);
    expect(Number(runtime.teamScore)).toBeLessThan(50);
  });
});
