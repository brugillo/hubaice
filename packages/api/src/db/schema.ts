import {
  pgTable,
  uuid,
  varchar,
  decimal,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";

// ── Registration intents (temporary, for skill-driven registration) ──

export const registrationIntents = pgTable(
  "registration_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    platform: varchar("platform", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    thinking: varchar("thinking", { length: 20 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimed: boolean("claimed").default(false),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    ip: varchar("ip", { length: 45 }),
  },
  (t) => [
    index("idx_intents_expires").on(t.expiresAt),
  ]
);

// ── Users (for dashboard, future auth) ──

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).unique().notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    lastLogin: timestamp("last_login", { withTimezone: true }),
  }
);

// ── Runtimes ──

export const runtimes = pgTable(
  "runtimes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    apiKeyHash: varchar("api_key_hash", { length: 64 }).unique().notNull(),
    platform: varchar("platform", { length: 100 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    thinking: varchar("thinking", { length: 20 }).notNull(),
    displayName: varchar("display_name", { length: 200 }),
    ownerAlias: varchar("owner_alias", { length: 100 }),
    registeredAt: timestamp("registered_at", { withTimezone: true }).defaultNow(),
    isActive: boolean("is_active").default(true),

    // Scores (computed server-side, source of truth)
    agentScore: decimal("agent_score", { precision: 5, scale: 1 }).default("50.0"),
    userScore: decimal("user_score", { precision: 5, scale: 1 }).default("50.0"),
    teamScore: decimal("team_score", { precision: 5, scale: 1 }).default("50.0"),
    evalCount: integer("eval_count").default(0),
    maturityTier: varchar("maturity_tier", { length: 10 }).default("GREEN"),

    // Domain scores (agent)
    techScore: decimal("tech_score", { precision: 5, scale: 1 }).default("50.0"),
    opsScore: decimal("ops_score", { precision: 5, scale: 1 }).default("50.0"),
    judgmentScore: decimal("judgment_score", { precision: 5, scale: 1 }).default("50.0"),
    commsScore: decimal("comms_score", { precision: 5, scale: 1 }).default("50.0"),
    orchScore: decimal("orch_score", { precision: 5, scale: 1 }).default("50.0"),

    // Domain scores (user)
    userTechScore: decimal("user_tech_score", { precision: 5, scale: 1 }).default("50.0"),
    userOpsScore: decimal("user_ops_score", { precision: 5, scale: 1 }).default("50.0"),
    userJudgmentScore: decimal("user_judgment_score", { precision: 5, scale: 1 }).default("50.0"),
    userCommsScore: decimal("user_comms_score", { precision: 5, scale: 1 }).default("50.0"),
    userOrchScore: decimal("user_orch_score", { precision: 5, scale: 1 }).default("50.0"),

    // Streaks (server-side state)
    techStreak: integer("tech_streak").default(0),
    opsStreak: integer("ops_streak").default(0),
    judgmentStreak: integer("judgment_streak").default(0),
    commsStreak: integer("comms_streak").default(0),
    orchStreak: integer("orch_streak").default(0),

    // Warmup
    warmupActive: boolean("warmup_active").default(true),
    warmupEvals: integer("warmup_evals").default(0),

    // Anti-gaming
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    eventsToday: integer("events_today").default(0),
    eventsTodayDate: date("events_today_date"),
    anomalyFlags: integer("anomaly_flags").default(0),
    quarantine: boolean("quarantine").default(false),

    // Daily caps tracking
    dailyCapsJson: jsonb("daily_caps_json").default({}),
    dailyCapsDate: date("daily_caps_date"),

    // Registration flow (S1-F3)
    email: varchar("email", { length: 255 }),
    emailVerified: boolean("email_verified").default(false),
    emailVerificationToken: varchar("email_verification_token", { length: 128 }),
    emailTokenExpires: timestamp("email_token_expires", { withTimezone: true }),
    status: varchar("status", { length: 20 }).default("active"),
    intentId: uuid("intent_id").references(() => registrationIntents.id),
    userId: uuid("user_id").references(() => users.id),
  },
  (t) => [
    unique("uq_runtime_identity").on(t.platform, t.model, t.thinking, t.ownerAlias),
    index("idx_runtimes_email").on(t.email),
    index("idx_runtimes_status").on(t.status),
    index("idx_runtimes_user").on(t.userId),
  ]
);

// ── Interaction Events ──

export const interactionEvents = pgTable(
  "interaction_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runtimeId: uuid("runtime_id")
      .notNull()
      .references(() => runtimes.id),

    // Classification (from client)
    side: varchar("side", { length: 5 }).notNull(),
    eventType: varchar("event_type", { length: 30 }).notNull(),
    domain: varchar("domain", { length: 10 }).notNull(),
    severity: varchar("severity", { length: 10 }),
    patternCode: varchar("pattern_code", { length: 50 }),
    quadrant: varchar("quadrant", { length: 20 }),
    triggerType: varchar("trigger_type", { length: 20 }),
    clusterRef: uuid("cluster_ref"),
    sessionId: varchar("session_id", { length: 100 }),
    clientTs: timestamp("client_ts", { withTimezone: true }).notNull(),

    // Scoring (computed by hub)
    delta: decimal("delta", { precision: 4, scale: 1 }),
    domainScoreAfter: decimal("domain_score_after", { precision: 5, scale: 1 }),
    globalScoreAfter: decimal("global_score_after", { precision: 5, scale: 1 }),
    streakAfter: integer("streak_after"),
    wasReincidence: boolean("was_reincidence").default(false),
    wasCluster: boolean("was_cluster").default(false),
    capApplied: boolean("cap_applied").default(false),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    skillVersion: varchar("skill_version", { length: 20 }),
    accepted: boolean("accepted").default(true),
    rejectionReason: varchar("rejection_reason", { length: 100 }),
  },
  (t) => [
    index("idx_events_runtime").on(t.runtimeId, t.createdAt),
    index("idx_events_session").on(t.runtimeId, t.sessionId),
    index("idx_events_pattern").on(t.patternCode),
  ]
);

// ── Daily Snapshots ──

export const dailySnapshots = pgTable(
  "daily_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runtimeId: uuid("runtime_id")
      .notNull()
      .references(() => runtimes.id),
    snapshotDate: date("snapshot_date").notNull(),
    agentScore: decimal("agent_score", { precision: 5, scale: 1 }),
    userScore: decimal("user_score", { precision: 5, scale: 1 }),
    teamScore: decimal("team_score", { precision: 5, scale: 1 }),
    evalCount: integer("eval_count"),
    eventsCount: integer("events_count"),
    scoresJson: jsonb("scores_json"),
  },
  (t) => [
    unique("uq_snapshot_date").on(t.runtimeId, t.snapshotDate),
  ]
);

// ── Types ──

export type Runtime = typeof runtimes.$inferSelect;
export type NewRuntime = typeof runtimes.$inferInsert;
export type InteractionEvent = typeof interactionEvents.$inferSelect;
export type NewInteractionEvent = typeof interactionEvents.$inferInsert;
export type DailySnapshot = typeof dailySnapshots.$inferSelect;
export type RegistrationIntent = typeof registrationIntents.$inferSelect;
export type User = typeof users.$inferSelect;
