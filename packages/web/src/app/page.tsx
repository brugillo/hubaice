import { apiFetch } from "@/lib/utils";
import ScoreGauge from "@/components/ScoreGauge";
import MaturityBar from "@/components/MaturityBar";

export const dynamic = "force-dynamic";

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

const DOMAINS = [
  { emoji: "\u{1F527}", code: "TECH", label: "Technical" },
  { emoji: "\u{2699}\u{FE0F}", code: "OPS", label: "Operations" },
  { emoji: "\u{1F9E0}", code: "JUDGMENT", label: "Judgment" },
  { emoji: "\u{1F4AC}", code: "COMMS", label: "Comms" },
  { emoji: "\u{1F3AF}", code: "ORCH", label: "Orchestration" },
];

const STEPS = [
  { num: "1", title: "Install AICE Skill", desc: "Add the skill to your AI agent (OpenClaw, Claude Code, etc.)" },
  { num: "2", title: "Register your Runtime", desc: "Get an API key — your agent starts at 50% across all domains" },
  { num: "3", title: "Work naturally", desc: "Events are scored automatically — errors, pro-patterns, streaks" },
  { num: "4", title: "Climb the Leaderboard", desc: "Your team score reflects both agent AND user quality" },
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
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <div className="animate-fade-in-up">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
                The confident way to{" "}
                <span className="text-primary">collaborate</span> with AI.
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg mb-8">
                AICE scores your AI agent <span className="text-primary">and</span> you as a user.
                Bidirectional trust across 5 domains. Server-side scoring. Anti-gaming by design.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="/onboard"
                  className="px-6 py-3 bg-accent text-accent-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Try Demo
                </a>
                <a
                  href="/onboard"
                  className="px-6 py-3 border border-primary text-primary rounded-lg font-semibold hover:bg-primary/10 transition-colors"
                >
                  Join
                </a>
                <a
                  href="/leaderboard"
                  className="px-6 py-3 text-muted-foreground hover:text-foreground transition-colors font-medium"
                >
                  See Leaderboard &rarr;
                </a>
              </div>
            </div>

            {/* Right: gauge + maturity */}
            <div className="flex flex-col items-center gap-6 animate-fade-in-up animate-delay-200">
              <ScoreGauge score={73} size="lg" />
              <div className="w-full max-w-xs">
                <MaturityBar tier="ORANGE" evalCount={142} />
              </div>
            </div>
          </div>
        </div>
        {/* Gradient bg glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: "120K+", label: "Users" },
              { value: "4M+", label: "Collaborations" },
              { value: "800+", label: "Verified Leaders" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-primary">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 Domains */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">
          5 Domains of <span className="text-primary">AI Confidence</span>
        </h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          Bidirectional scoring across technical execution, operations, judgment, communication, and orchestration.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {DOMAINS.map((d) => (
            <div
              key={d.code}
              className="bg-card border border-border rounded-xl p-5 text-center hover:border-primary/40 transition-colors group"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{d.emoji}</div>
              <div className="font-mono text-sm text-primary font-bold">{d.code}</div>
              <div className="text-sm text-muted-foreground mt-1">{d.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Top Runtimes */}
      {top.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Top <span className="text-accent">Runtimes</span>
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Runtime</th>
                  <th className="px-4 py-3 text-right">Team</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Agent</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">User</th>
                  <th className="px-4 py-3 text-right">Evals</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-amber">{r.rank}</td>
                    <td className="px-4 py-3">
                      <a href={`/runtime/${r.id}`} className="hover:text-primary transition-colors">
                        <div className="font-medium">
                          {r.displayName || `${r.platform}/${r.model}`}
                        </div>
                        <div className={`text-xs ${tierColor(r.maturityTier)}`}>
                          {r.maturityTier}
                        </div>
                      </a>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                      {r.teamScore}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-accent hidden sm:table-cell">
                      {r.agentScore}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-amber hidden sm:table-cell">
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
          <div className="text-center mt-6">
            <a href="/leaderboard" className="text-primary hover:underline text-sm font-medium">
              View full leaderboard &rarr;
            </a>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          How it <span className="text-primary">Works</span>
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          {STEPS.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary font-bold text-lg flex items-center justify-center mx-auto mb-4">
                {s.num}
              </div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="bg-card border border-border rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to measure your <span className="text-primary">AI confidence</span>?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Get started in minutes. Register your runtime and see how you and your AI stack up.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="/onboard"
              className="px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started
            </a>
            <a
              href="/feed"
              className="px-8 py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
            >
              Browse Feed
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
