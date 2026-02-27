export const DOMAINS = ["TECH", "OPS", "JUDGMENT", "COMMS", "ORCH"] as const;
export type Domain = (typeof DOMAINS)[number];

export const SIDES = ["agent", "user"] as const;
export type Side = (typeof SIDES)[number];

export const EVENT_TYPES = [
  "error",
  "correct",
  "pro_pattern",
  "bonus",
  "exceptional",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const SEVERITIES = ["leve", "medio", "grave", "critico"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_DELTAS: Record<string, number> = {
  leve: -1,
  medio: -3,
  grave: -5,
  critico: -10,
};

// ACC table: streak → cumulative reward
export const ACC_TABLE: Record<number, number> = {
  0: 0, 1: 0, 2: 0, 3: 0, 4: 1, 5: 2, 6: 4, 7: 6, 8: 8, 9: 10, 10: 12,
};

export const DOMAIN_WEIGHTS: Record<Domain, number> = {
  TECH: 1,
  OPS: 1,
  JUDGMENT: 1,
  COMMS: 1,
  ORCH: 1,
};

export const MATURITY_TIERS = {
  GREEN: { min: 0, max: 100 },
  YELLOW: { min: 101, max: 500 },
  ORANGE: { min: 501, max: 2000 },
  BLUE: { min: 2001, max: Infinity },
} as const;

export const WARMUP_THRESHOLD = 40;

export const DAILY_CAPS = {
  warmup: { negative: -30, positive: 15 },
  normal: { negative: -20, positive: 10 },
} as const;

export const MAX_BONUS_PER_DAY = 3;
export const MIN_STREAK_FOR_EXCEPTIONAL = 3;

export interface EventInput {
  side: Side;
  eventType: EventType;
  domain: Domain;
  severity?: Severity;
  patternCode?: string;
  quadrant?: string;
  trigger?: string;
  sessionId?: string;
  clusterRef?: string;
  timestamp: string;
  skillVersion?: string;
  bonusAmount?: number;
}

export interface ScoringResult {
  delta: number;
  domainScoreAfter: number;
  globalScoreAfter: number;
  streakAfter: number;
  evalCount: number;
  wasReincidence: boolean;
  wasCluster: boolean;
  capApplied: boolean;
}

export interface DomainState {
  score: number;
  streak: number;
}

export interface SideState {
  global: number;
  domains: Record<Domain, DomainState>;
}

export interface FullState {
  agent: SideState;
  user: SideState;
  team: number;
  maturity: {
    tier: string;
    evalCount: number;
    confidenceInterval: number;
  };
  warmup: {
    active: boolean;
    remaining: number;
  };
}

export interface DailyCaps {
  [domain: string]: { positive: number; negative: number };
}
