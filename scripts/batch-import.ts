#!/usr/bin/env tsx
/**
 * AICE Hub — Batch Import Script
 * Importa historial real de ComPi al Hub production.
 *
 * Lee:
 *   - interaction-log.jsonl   → interacciones (agente+usuario, scores, cuadrante)
 *   - confidence.json         → estado actual del runtime (scores por dominio, anti-patrones)
 *   - confidence-log.jsonl    → historial de evaluaciones individuales (eventos de scoring)
 *
 * Convierte a llamadas POST /api/import/event, /api/import/state, y /api/import/interaction al Hub.
 *
 * Uso:
 *   API_KEY=aice_live_xxx HUB_URL=https://hubaice.com npx tsx scripts/batch-import.ts \
 *     --interaction-log /home/compi/.openclaw/workspace/skills/aice/interaction-log.jsonl \
 *     --confidence     /home/compi/.openclaw/workspace/skills/aice/confidence.json \
 *     --confidence-log /home/compi/.openclaw/workspace/skills/aice/confidence-log.jsonl
 *
 * Flags:
 *   --dry-run     Muestra lo que haría sin hacer llamadas a la API
 *   --skip-state  No importa el estado final (confidence.json), solo eventos
 *   --from-date   Importar solo eventos desde esta fecha (YYYY-MM-DD)
 *   --verbose     Log detallado de cada evento
 */

import fs from "node:fs";
import readline from "node:readline";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InteractionLog {
  id: string;
  date: string;
  task: string;
  userScore?: number;
  agentScore?: number;
  quadrant?: string;
  metrics?: Record<string, number>;
  notes?: string;
  agentDeltas?: Record<string, string[]>;
  userDeltas?: Record<string, string[]>;
  claudeCodeDeltas?: Record<string, string[]>;
}

interface ConfidenceState {
  version: number;
  agentId: string;
  runtime: {
    model: string;
    thinking: string;
  };
  domains: Record<string, {
    score: number;
    streak: number;
    evaluations: number;
    corrections: number;
    emoji?: string;
  }>;
  globalScore: number;
  maturity: {
    totalEvaluations: number;
    tier: string;
    tierLabel: string;
    tierEmoji: string;
  };
  antiPatterns: Array<{
    code: string;
    name: string;
    severity: string;
    domain: string;
    description: string;
    detectedAt: string;
    occurrences: number;
  }>;
  proPatterns: Array<{
    code: string;
    name: string;
    domain: string;
    description: string;
    detectedAt: string;
    occurrences: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface ConfidenceLogEntry {
  id: string;
  timestamp: string;
  domain?: string;
  result: string;
  severity?: string;
  category?: string;
  antiPattern?: string;
  delta: number;
  scoreBefore?: number;
  scoreAfter?: number;
  streakBefore?: number;
  streakAfter?: number;
  note?: string;
  evaluator?: string;
  implicit?: boolean;
}

interface ApiEvent {
  type: "evaluation" | "recalibration" | "init" | "interaction";
  side?: "agent" | "user" | "system";
  result: string;
  domain?: string;
  severity?: string;
  category?: string;
  delta: number;
  scoreBefore?: number;
  scoreAfter?: number;
  streakBefore?: number;
  streakAfter?: number;
  note?: string;
  evaluator?: string;
  timestamp: string;
  externalId?: string;
}

interface ImportStats {
  confidenceLogTotal: number;
  confidenceLogImported: number;
  confidenceLogSkipped: number;
  confidenceLogErrors: number;
  interactionLogTotal: number;
  interactionLogImported: number;
  interactionLogSkipped: number;
  stateImported: boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const API_KEY = process.env.API_KEY;
const HUB_URL = process.env.HUB_URL || "https://hubaice.com";
const RUNTIME_ID = process.env.RUNTIME_ID; // opcional, si ya existe el runtime

const args = process.argv.slice(2);
const flags = {
  dryRun:     args.includes("--dry-run"),
  skipState:  args.includes("--skip-state"),
  verbose:    args.includes("--verbose"),
  fromDate:   getArg("--from-date"),
  interactionLog: getArg("--interaction-log"),
  confidence:     getArg("--confidence"),
  confidenceLog:  getArg("--confidence-log"),
};

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

// Default paths (si no se pasan como args)
const DEFAULT_INTERACTION_LOG = "/home/compi/.openclaw/workspace/skills/aice/interaction-log.jsonl";
const DEFAULT_CONFIDENCE      = "/home/compi/.openclaw/workspace/skills/aice/confidence.json";
const DEFAULT_CONFIDENCE_LOG  = "/home/compi/.openclaw/workspace/skills/aice/confidence-log.jsonl";

const interactionLogPath = flags.interactionLog || DEFAULT_INTERACTION_LOG;
const confidencePath     = flags.confidence     || DEFAULT_CONFIDENCE;
const confidenceLogPath  = flags.confidenceLog  || DEFAULT_CONFIDENCE_LOG;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function verbose(msg: string) {
  if (flags.verbose) console.log(`  » ${msg}`);
}

function error(msg: string) {
  console.error(`[ERROR] ${msg}`);
}

async function apiPost(path: string, body: unknown): Promise<{ ok: boolean; status: number; data?: unknown }> {
  if (flags.dryRun) {
    verbose(`DRY RUN POST ${path}: ${JSON.stringify(body).slice(0, 100)}...`);
    return { ok: true, status: 200, data: { dryRun: true } };
  }

  const url = `${HUB_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      verbose(`HTTP ${res.status} for ${path}: ${text.slice(0, 200)}`);
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  const results: T[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed) as T);
    } catch {
      verbose(`Skipping invalid JSON line: ${trimmed.slice(0, 80)}`);
    }
  }
  return results;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Conversión: confidence-log.jsonl → API events ───────────────────────────

function confidenceLogEntryToApiEvent(entry: ConfidenceLogEntry): ApiEvent | null {
  // Filtrar entradas sin información útil
  if (!entry.result) return null;

  const type: ApiEvent["type"] =
    entry.result === "recalibration" ? "recalibration" :
    entry.result === "init"          ? "init" :
    "evaluation";

  const side: ApiEvent["side"] =
    entry.evaluator === "system" ? "system" :
    entry.evaluator === "user"   ? "user" :
    "agent";

  return {
    type,
    side,
    result: entry.result,
    domain:      entry.domain    || undefined,
    severity:    entry.severity  || undefined,
    category:    entry.category  || undefined,
    delta:       entry.delta     ?? 0,
    scoreBefore: entry.scoreBefore ?? undefined,
    scoreAfter:  entry.scoreAfter  ?? undefined,
    streakBefore: entry.streakBefore ?? undefined,
    streakAfter:  entry.streakAfter  ?? undefined,
    note:        entry.note      || undefined,
    evaluator:   entry.evaluator || undefined,
    timestamp:   entry.timestamp,
    externalId:  entry.id,
  };
}

// ─── Conversión: interaction-log.jsonl → API interactions ────────────────────

function interactionToApiEvent(interaction: InteractionLog): ApiEvent | null {
  // Solo procesar si tiene datos de score
  if (interaction.userScore === undefined && interaction.agentScore === undefined) {
    verbose(`Skipping interaction without scores: ${interaction.id}`);
    return null;
  }

  return {
    type: "interaction",
    side: "system",
    result: "interaction",
    delta: 0, // Las interacciones no tienen delta directo
    note: JSON.stringify({
      task: interaction.task,
      userScore: interaction.userScore,
      agentScore: interaction.agentScore,
      quadrant: interaction.quadrant,
      metrics: interaction.metrics,
      notes: interaction.notes,
    }),
    timestamp: `${interaction.date}T12:00:00Z`, // Aproximación si no hay hora exacta
    externalId: interaction.id,
  };
}

// ─── Importar estado final (confidence.json) ─────────────────────────────────

async function importFinalState(state: ConfidenceState): Promise<boolean> {
  log("Importing final runtime state from confidence.json...");

  const payload = {
    platform: "openclaw",
    model: state.runtime.model,
    thinking: state.runtime.thinking,
    displayName: `ComPi (${state.runtime.model.split("/").pop()})`,
    domains: state.domains,
    globalScore: state.globalScore,
    maturity: state.maturity,
    antiPatterns: state.antiPatterns,
    proPatterns: state.proPatterns || [],
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };

  verbose(`State payload: global=${state.globalScore}, evaluations=${state.maturity.totalEvaluations}`);

  const res = await apiPost("/api/import/state", payload);
  if (res.ok) {
    log(`✅ State imported. Runtime: ${state.runtime.model}, Score: ${state.globalScore}`);
    return true;
  } else {
    error(`Failed to import state: HTTP ${res.status}`);
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║       AICE Hub — Batch Import v1.0             ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  // Validaciones iniciales
  if (!API_KEY && !flags.dryRun) {
    error("API_KEY env var is required. Set API_KEY=<your-api-key>");
    error("Or run with --dry-run to test without making API calls.");
    process.exit(1);
  }

  log(`Hub URL:    ${HUB_URL}`);
  log(`Dry run:    ${flags.dryRun}`);
  log(`From date:  ${flags.fromDate || "all"}`);
  log(`Verbose:    ${flags.verbose}`);
  if (RUNTIME_ID) log(`Runtime ID: ${RUNTIME_ID}`);
  console.log("");

  // Verificar archivos
  for (const [name, filePath] of [
    ["interaction-log", interactionLogPath],
    ["confidence", confidencePath],
    ["confidence-log", confidenceLogPath],
  ] as const) {
    if (!fs.existsSync(filePath)) {
      error(`File not found: ${filePath} (--${name})`);
      process.exit(1);
    }
    log(`Found: ${filePath}`);
  }
  console.log("");

  const stats: ImportStats = {
    confidenceLogTotal: 0,
    confidenceLogImported: 0,
    confidenceLogSkipped: 0,
    confidenceLogErrors: 0,
    interactionLogTotal: 0,
    interactionLogImported: 0,
    interactionLogSkipped: 0,
    stateImported: false,
  };

  // ── 1. Importar estado final (confidence.json) ─────────────────────────────
  if (!flags.skipState) {
    const rawState = JSON.parse(fs.readFileSync(confidencePath, "utf-8")) as ConfidenceState;
    stats.stateImported = await importFinalState(rawState);
    console.log("");
  }

  // ── 2. Importar historial de evaluaciones (confidence-log.jsonl) ───────────
  log("Reading confidence-log.jsonl...");
  const confidenceLogEntries = await readJsonLines<ConfidenceLogEntry>(confidenceLogPath);
  log(`Found ${confidenceLogEntries.length} confidence log entries.`);

  // Filtrar por fecha si se especificó
  const filteredEntries = flags.fromDate
    ? confidenceLogEntries.filter(e => e.timestamp >= `${flags.fromDate}T00:00:00Z`)
    : confidenceLogEntries;

  if (flags.fromDate) {
    log(`Filtered to ${filteredEntries.length} entries from ${flags.fromDate}.`);
  }

  stats.confidenceLogTotal = filteredEntries.length;

  // Importar en batches de 10 con pausa para no saturar la API
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 500;

  for (let i = 0; i < filteredEntries.length; i += BATCH_SIZE) {
    const batch = filteredEntries.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(filteredEntries.length / BATCH_SIZE);

    log(`Processing confidence-log batch ${batchNum}/${totalBatches} (${batch.length} entries)...`);

    for (const entry of batch) {
      const apiEvent = confidenceLogEntryToApiEvent(entry);
      if (!apiEvent) {
        verbose(`Skipped entry ${entry.id}: no usable data`);
        stats.confidenceLogSkipped++;
        continue;
      }

      const res = await apiPost("/api/import/event", apiEvent);
      if (res.ok) {
        verbose(`✓ ${entry.id} → ${apiEvent.result} ${apiEvent.domain || ""} delta=${apiEvent.delta}`);
        stats.confidenceLogImported++;
      } else if (res.status === 409) {
        // Ya existe (idempotente: externalId duplicado)
        verbose(`⟳ ${entry.id} already imported (409)`);
        stats.confidenceLogSkipped++;
      } else {
        error(`✗ ${entry.id}: HTTP ${res.status}`);
        stats.confidenceLogErrors++;
      }
    }

    if (i + BATCH_SIZE < filteredEntries.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log("");

  // ── 3. Importar interacciones (interaction-log.jsonl) ─────────────────────
  log("Reading interaction-log.jsonl...");
  const interactions = await readJsonLines<InteractionLog>(interactionLogPath);
  log(`Found ${interactions.length} interactions.`);

  const filteredInteractions = flags.fromDate
    ? interactions.filter(i => i.date >= (flags.fromDate || ""))
    : interactions;

  stats.interactionLogTotal = filteredInteractions.length;

  for (let i = 0; i < filteredInteractions.length; i += BATCH_SIZE) {
    const batch = filteredInteractions.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(filteredInteractions.length / BATCH_SIZE);

    log(`Processing interaction-log batch ${batchNum}/${totalBatches} (${batch.length} interactions)...`);

    for (const interaction of batch) {
      const apiEvent = interactionToApiEvent(interaction);
      if (!apiEvent) {
        stats.interactionLogSkipped++;
        continue;
      }

      const res = await apiPost("/api/import/interaction", {
        externalId:  interaction.id,
        date:        interaction.date,
        task:        interaction.task,
        userScore:   interaction.userScore,
        agentScore:  interaction.agentScore,
        quadrant:    interaction.quadrant,
        metrics:     interaction.metrics,
        notes:       interaction.notes,
        agentDeltas: interaction.agentDeltas,
        userDeltas:  interaction.userDeltas,
        timestamp:   `${interaction.date}T12:00:00Z`,
      });

      if (res.ok) {
        verbose(`✓ ${interaction.id}: ${interaction.task.slice(0, 60)}`);
        stats.interactionLogImported++;
      } else if (res.status === 409) {
        verbose(`⟳ ${interaction.id} already imported (409)`);
        stats.interactionLogSkipped++;
      } else {
        error(`✗ ${interaction.id}: HTTP ${res.status}`);
      }
    }

    if (i + BATCH_SIZE < filteredInteractions.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // ── 4. Resumen ─────────────────────────────────────────────────────────────
  console.log("\n╔════════════════════════════════════════════════╗");
  console.log("║              IMPORT SUMMARY                    ║");
  console.log("╠════════════════════════════════════════════════╣");
  console.log(`║  State imported:       ${stats.stateImported ? "YES ✅" : "NO  ⚠️ "}                  ║`);
  console.log(`║  Confidence log:                               ║`);
  console.log(`║    Total entries:      ${String(stats.confidenceLogTotal).padEnd(6)}                  ║`);
  console.log(`║    Imported OK:        ${String(stats.confidenceLogImported).padEnd(6)} ✅             ║`);
  console.log(`║    Skipped:            ${String(stats.confidenceLogSkipped).padEnd(6)}                  ║`);
  console.log(`║    Errors:             ${String(stats.confidenceLogErrors).padEnd(6)} ${stats.confidenceLogErrors > 0 ? "❌" : "  "}             ║`);
  console.log(`║  Interactions:                                 ║`);
  console.log(`║    Total entries:      ${String(stats.interactionLogTotal).padEnd(6)}                  ║`);
  console.log(`║    Imported OK:        ${String(stats.interactionLogImported).padEnd(6)} ✅             ║`);
  console.log(`║    Skipped:            ${String(stats.interactionLogSkipped).padEnd(6)}                  ║`);
  console.log("╚════════════════════════════════════════════════╝\n");

  if (flags.dryRun) {
    log("DRY RUN completed. No actual API calls were made.");
    log("Remove --dry-run flag to execute for real.");
  } else if (stats.confidenceLogErrors > 0) {
    log(`⚠️  Import completed with ${stats.confidenceLogErrors} errors. Check logs above.`);
    process.exit(1);
  } else {
    log("✅ Import completed successfully!");
    log(`Check the leaderboard: ${HUB_URL}/leaderboard`);
  }
}

main().catch((err) => {
  error(`Unhandled error: ${err}`);
  process.exit(1);
});
