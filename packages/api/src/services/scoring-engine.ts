import type { Runtime } from "../db/schema.js";
import {
  ACC_TABLE,
  SEVERITY_DELTAS,
  DAILY_CAPS,
  WARMUP_THRESHOLD,
  DOMAINS,
  DOMAIN_WEIGHTS,
  MAX_BONUS_PER_DAY,
  MIN_STREAK_FOR_EXCEPTIONAL,
  MATURITY_TIERS,
  type Domain,
  type Side,
  type EventInput,
  type ScoringResult,
  type DailyCaps,
  type FullState,
  type DomainState,
} from "../types.js";
import { computeTeamScore } from "./team-score.js";

// ── Domain field accessors ──────────────────────────────────────────

const AGENT_SCORE_FIELDS: Record<Domain, keyof Runtime> = {
  TECH: "techScore",
  OPS: "opsScore",
  JUDGMENT: "judgmentScore",
  COMMS: "commsScore",
  ORCH: "orchScore",
};

const USER_SCORE_FIELDS: Record<Domain, keyof Runtime> = {
  TECH: "userTechScore",
  OPS: "userOpsScore",
  JUDGMENT: "userJudgmentScore",
  COMMS: "userCommsScore",
  ORCH: "userOrchScore",
};

const STREAK_FIELDS: Record<Domain, keyof Runtime> = {
  TECH: "techStreak",
  OPS: "opsStreak",
  JUDGMENT: "judgmentStreak",
  COMMS: "commsStreak",
  ORCH: "orchStreak",
};

function getScoreFields(side: Side): Record<Domain, keyof Runtime> {
  return side === "agent" ? AGENT_SCORE_FIELDS : USER_SCORE_FIELDS;
}

// ── ACC table helpers ───────────────────────────────────────────────

export function accValue(streak: number): number {
  return ACC_TABLE[Math.min(Math.max(streak, 0), 10)] ?? 0;
}

export function streakDelta(currentStreak: number): number {
  return accValue(currentStreak) - accValue(currentStreak - 1);
}

// ── Global score calculation ────────────────────────────────────────

export function computeGlobalScore(domainScores: Record<Domain, number>): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const d of DOMAINS) {
    weightedSum += domainScores[d] * DOMAIN_WEIGHTS[d];
    totalWeight += DOMAIN_WEIGHTS[d];
  }
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

// ── Maturity ────────────────────────────────────────────────────────

export function computeMaturityTier(evalCount: number): string {
  for (const [tier, range] of Object.entries(MATURITY_TIERS)) {
    if (evalCount >= range.min && evalCount <= range.max) return tier;
  }
  return "GREEN";
}

export function confidenceInterval(evalCount: number): number {
  if (evalCount <= 0) return 25;
  return Math.round((25 / Math.sqrt(evalCount)) * 10) / 10;
}

// ── Daily caps ──────────────────────────────────────────────────────

function getDailyCaps(runtime: Runtime, domain: Domain): { positive: number; negative: number } {
  const caps = (runtime.dailyCapsJson ?? {}) as DailyCaps;
  return caps[domain] ?? { positive: 0, negative: 0 };
}

function getCapsLimits(warmupActive: boolean) {
  return warmupActive ? DAILY_CAPS.warmup : DAILY_CAPS.normal;
}

export function applyDailyCap(
  delta: number,
  runtime: Runtime,
  domain: Domain,
): { cappedDelta: number; capApplied: boolean } {
  const used = getDailyCaps(runtime, domain);
  const limits = getCapsLimits(runtime.warmupActive ?? true);

  if (delta > 0) {
    const remaining = limits.positive - used.positive;
    if (remaining <= 0) return { cappedDelta: 0, capApplied: true };
    if (delta > remaining) return { cappedDelta: remaining, capApplied: true };
  } else if (delta < 0) {
    const remaining = limits.negative - used.negative; // remaining is negative
    if (remaining >= 0) return { cappedDelta: 0, capApplied: true };
    if (delta < remaining) return { cappedDelta: remaining, capApplied: true };
  }

  return { cappedDelta: delta, capApplied: false };
}

// ── Reincidence check ───────────────────────────────────────────────

export interface ReincidenceChecker {
  isReincidence(runtimeId: string, sessionId: string, patternCode: string): Promise<boolean>;
}

// ── Core scoring ────────────────────────────────────────────────────

export interface ScoringContext {
  runtime: Runtime;
  event: EventInput;
  isReincidence: boolean;
}

export function calculateBaseDelta(event: EventInput): number {
  switch (event.eventType) {
    case "error":
      return SEVERITY_DELTAS[event.severity ?? "medio"] ?? -3;
    case "correct":
      return 0; // benefit from streak only
    case "pro_pattern":
      return 3;
    case "bonus":
      return event.bonusAmount ?? 3;
    case "exceptional":
      return event.bonusAmount ?? 5;
    default:
      return 0;
  }
}

export function processEvent(ctx: ScoringContext): {
  scoring: ScoringResult;
  updates: Partial<Runtime>;
} {
  const { runtime, event, isReincidence } = ctx;
  const side = event.side;
  const domain = event.domain;
  const scoreFields = getScoreFields(side);
  const streakField = STREAK_FIELDS[domain];

  // Current values
  const currentDomainScore = Number(runtime[scoreFields[domain]] ?? 50);
  let currentStreak = Number(runtime[streakField] ?? 0);
  const evalCount = (runtime.evalCount ?? 0) + 1;

  // Step 3: Base delta
  let delta = calculateBaseDelta(event);

  // Step 4: Reincidence override
  let wasReincidence = false;
  if (isReincidence && event.patternCode && event.sessionId) {
    delta = -10;
    wasReincidence = true;
  }

  // Step 5: Cluster — derived events get 50% delta
  let wasCluster = false;
  if (event.clusterRef) {
    delta = Math.round(delta * 0.5 * 10) / 10;
    wasCluster = true;
  }

  // Step 6: Update streak
  if (event.eventType === "correct" || event.eventType === "pro_pattern") {
    currentStreak += 1;
  } else if (event.eventType === "error") {
    currentStreak = 0;
  }

  // Step 7: Streak reward (ACC table)
  let totalDelta = delta;
  if (event.eventType === "correct" || event.eventType === "pro_pattern") {
    totalDelta += streakDelta(currentStreak);
  }

  // Step 8: Daily caps
  const { cappedDelta, capApplied } = applyDailyCap(totalDelta, runtime, domain);
  totalDelta = cappedDelta;

  // Step 9: Apply delta to domain score — clamp to [-100, 100]
  const newDomainScore = Math.round(
    Math.max(-100, Math.min(100, currentDomainScore + totalDelta)) * 10
  ) / 10;

  // Step 10: Recalculate global score
  const allDomainScores = {} as Record<Domain, number>;
  for (const d of DOMAINS) {
    allDomainScores[d] =
      d === domain ? newDomainScore : Number(runtime[scoreFields[d]] ?? 50);
  }
  const newGlobalScore = computeGlobalScore(allDomainScores);

  // Step 11: Team score
  const agentDomains = {} as Record<Domain, number>;
  const userDomains = {} as Record<Domain, number>;
  for (const d of DOMAINS) {
    agentDomains[d] =
      side === "agent" && d === domain
        ? newDomainScore
        : Number(runtime[AGENT_SCORE_FIELDS[d]] ?? 50);
    userDomains[d] =
      side === "user" && d === domain
        ? newDomainScore
        : Number(runtime[USER_SCORE_FIELDS[d]] ?? 50);
  }
  const agentGlobal = computeGlobalScore(agentDomains);
  const userGlobal = computeGlobalScore(userDomains);
  const newTeamScore = computeTeamScore(agentGlobal, userGlobal);

  // Step 12: Maturity
  const warmupActive = evalCount < WARMUP_THRESHOLD;
  const newTier = computeMaturityTier(evalCount);

  // Update daily caps tracking
  const today = new Date().toISOString().slice(0, 10);
  let caps = (runtime.dailyCapsJson ?? {}) as DailyCaps;
  if (runtime.dailyCapsDate !== today) {
    caps = {};
  }
  if (!caps[domain]) caps[domain] = { positive: 0, negative: 0 };
  if (totalDelta > 0) caps[domain].positive += totalDelta;
  if (totalDelta < 0) caps[domain].negative += totalDelta;

  // Update events-today counter
  let eventsToday = runtime.eventsToday ?? 0;
  if (runtime.eventsTodayDate !== today) {
    eventsToday = 0;
  }
  eventsToday += 1;

  // Build updates
  const updates: Record<string, unknown> = {
    [scoreFields[domain]]: newDomainScore.toFixed(1),
    [streakField]: currentStreak,
    evalCount,
    warmupActive,
    warmupEvals: warmupActive ? (runtime.warmupEvals ?? 0) + 1 : runtime.warmupEvals,
    maturityTier: newTier,
    lastEventAt: new Date(),
    eventsToday,
    eventsTodayDate: today,
    dailyCapsJson: caps,
    dailyCapsDate: today,
  };

  // Update global scores for the affected side
  if (side === "agent") {
    updates.agentScore = agentGlobal.toFixed(1);
  } else {
    updates.userScore = userGlobal.toFixed(1);
  }
  updates.teamScore = newTeamScore.toFixed(1);

  return {
    scoring: {
      delta: totalDelta,
      domainScoreAfter: newDomainScore,
      globalScoreAfter: newGlobalScore,
      streakAfter: currentStreak,
      evalCount,
      wasReincidence,
      wasCluster,
      capApplied,
    },
    updates: updates as Partial<Runtime>,
  };
}

// ── Build full state response ───────────────────────────────────────

export function buildFullState(runtime: Runtime): FullState {
  const agentDomains: Record<string, DomainState> = {};
  const userDomains: Record<string, DomainState> = {};

  for (const d of DOMAINS) {
    agentDomains[d] = {
      score: Number(runtime[AGENT_SCORE_FIELDS[d]] ?? 50),
      streak: Number(runtime[STREAK_FIELDS[d]] ?? 0),
    };
    userDomains[d] = {
      score: Number(runtime[USER_SCORE_FIELDS[d]] ?? 50),
      streak: 0,
    };
  }

  const agentGlobal = Number(runtime.agentScore ?? 50);
  const userGlobal = Number(runtime.userScore ?? 50);
  const evalCount = runtime.evalCount ?? 0;

  return {
    agent: {
      global: agentGlobal,
      domains: agentDomains as Record<Domain, DomainState>,
    },
    user: {
      global: userGlobal,
      domains: userDomains as Record<Domain, DomainState>,
    },
    team: Number(runtime.teamScore ?? 50),
    maturity: {
      tier: runtime.maturityTier ?? "GREEN",
      evalCount,
      confidenceInterval: confidenceInterval(evalCount),
    },
    warmup: {
      active: runtime.warmupActive ?? true,
      remaining: Math.max(0, WARMUP_THRESHOLD - evalCount),
    },
  };
}
