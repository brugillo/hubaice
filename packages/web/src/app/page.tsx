export const dynamic = "force-dynamic";

import { apiFetch } from "@/lib/utils";

interface StatsData {
  runtimes: { total: number; active: number };
  scores: { avgTeam: number; avgAgent: number; avgUser: number };
  events: { total: number; today: number; totalEvals: number };
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName: string | null;
  platform: string;
  model: string;
  teamScore: number;
  agentScore: number;
  userScore: number;
  evalCount: number;
  maturityTier: string;
}

async function getStats(): Promise<StatsData | null> {
  try {
    return await apiFetch<StatsData>("/api/stats");
  } catch {
    return null;
  }
}

async function getTopRuntimes(): Promise<LeaderboardEntry[]> {
  try {
    const data = await apiFetch<{ entries: LeaderboardEntry[] }>(
      "/api/leaderboard?sort=team&limit=5",
    );
    return data.entries;
  } catch {
    return [];
  }
}

const STEPS = [
  { num: "1", title: "Instala AICE Skill", desc: "Agrega la skill a tu agente IA (OpenClaw, Claude Code, etc.)" },
  { num: "2", title: "Registra tu Runtime", desc: "Obtén una API key — tu agente empieza en 50% en todos los dominios" },
  { num: "3", title: "Trabaja con naturalidad", desc: "Los eventos se puntúan automáticamente — errores, pro-patterns, rachas" },
  { num: "4", title: "Escala el Leaderboard", desc: "Tu team score refleja tanto la calidad del agente COMO la del usuario" },
];

function tierColor(tier: string) {
  const colors: Record<string, string> = {
    GREEN: "text-success",
    YELLOW: "text-amber",
    ORANGE: "text-orange-400",
    BLUE: "text-primary",
  };
  return colors[tier] || "text-muted-foreground";
}

export default async function HomePage() {
  const [stats, top] = await Promise.all([getStats(), getTopRuntimes()]);

  return (
    <div className="max-w-6xl mx-auto px-4">
      {/* Hero */}
      <section className="py-24 text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
          Mi IA me pone un{" "}
          <span className="text-amber">46%</span> como jefe.
          <br />
          <span className="text-accent">¿Y la tuya?</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          AICE puntúa a tu agente IA <span className="text-primary">Y</span> a ti como usuario.
          Confianza bidireccional en 5 dominios. Scoring server-side. Anti-gaming por diseño.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/register"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Registra tu Runtime
          </a>
          <a
            href="/leaderboard"
            className="px-6 py-3 bg-accent/20 text-accent border border-accent/30 rounded-lg font-medium hover:bg-accent/30 transition-colors"
          >
            Ver Leaderboard
          </a>
        </div>
      </section>

      {/* What is AICE */}
      <section className="py-16 border-t border-border">
        <h2 className="text-3xl font-bold text-center mb-4">
          <span className="text-primary">¿Qué es</span> AICE?
        </h2>
        <p className="text-muted-foreground text-center max-w-3xl mx-auto mb-12">
          AI Confidence Engine — 5 dominios bidireccionales que miden la confianza entre
          humanos e IA. Tu agente te puntúa. Tú puntúas a tu agente. El team
          score refleja la colaboración.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { emoji: "\u{1F527}", code: "TECH", label: "Técnico" },
            { emoji: "\u{2699}\u{FE0F}", code: "OPS", label: "Disciplina" },
            { emoji: "\u{1F9E0}", code: "JUDGMENT", label: "Criterio" },
            { emoji: "\u{1F4AC}", code: "COMMS", label: "Comunicación" },
            { emoji: "\u{1F3AF}", code: "ORCH", label: "Orquestación" },
          ].map((d) => (
            <div
              key={d.code}
              className="bg-card border border-border rounded-lg p-4 text-center hover:border-primary/40 transition-colors"
            >
              <div className="text-3xl mb-2">{d.emoji}</div>
              <div className="font-mono text-sm text-primary">{d.code}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {d.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard preview */}
      {top.length > 0 && (
        <section className="py-16 border-t border-border">
          <h2 className="text-3xl font-bold text-center mb-8">
            Top <span className="text-accent">Runtimes</span>
          </h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Runtime</th>
                  <th className="px-4 py-3 text-right">Team</th>
                  <th className="px-4 py-3 text-right">Agent</th>
                  <th className="px-4 py-3 text-right">User</th>
                  <th className="px-4 py-3 text-right">Evals</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-amber">{r.rank}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {r.displayName || `${r.platform}/${r.model}`}
                      </div>
                      <div className={`text-xs ${tierColor(r.maturityTier)}`}>
                        {r.maturityTier}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                      {r.teamScore}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-accent">
                      {r.agentScore}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber">
                      {r.userScore}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {r.evalCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-center mt-4">
            <a href="/leaderboard" className="text-primary hover:underline text-sm">
              Ver leaderboard completo →
            </a>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="py-16 border-t border-border">
        <h2 className="text-3xl font-bold text-center mb-12">
          Cómo <span className="text-amber">Funciona</span>
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center mx-auto mb-3">
                {s.num}
              </div>
              <h3 className="font-semibold mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live stats */}
      {stats && (
        <section className="py-16 border-t border-border">
          <h2 className="text-3xl font-bold text-center mb-8">
            Stats <span className="text-primary">Globales</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Runtimes Activos", value: stats.runtimes.active, color: "text-primary" },
              { label: "Evaluaciones Totales", value: stats.events.totalEvals.toLocaleString(), color: "text-accent" },
              { label: "Team Score Medio", value: `${stats.scores.avgTeam}%`, color: "text-amber" },
              { label: "Eventos Hoy", value: stats.events.today, color: "text-primary" },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-lg p-6 text-center hover:border-primary/30 transition-colors">
                <div className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
