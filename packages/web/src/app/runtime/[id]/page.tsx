import { apiFetch } from "@/lib/utils";
import ScoreGauge from "@/components/ScoreGauge";
import MaturityBar from "@/components/MaturityBar";
import ScoreBreakdown, { domainMeta } from "@/components/ScoreBreakdown";
import BadgesCabinet from "@/components/BadgesCabinet";
import WeeklyTrendChart from "@/components/WeeklyTrendChart";
import DailyChallenge from "@/components/DailyChallenge";

export const dynamic = "force-dynamic";

interface RuntimePublic {
  runtimeId: string;
  displayName: string | null;
  platform: string;
  model: string;
  thinking: string;
  globalScore: number;
  domains: Record<string, { score: number; evaluations: number; streak: number }>;
  maturity: {
    tier: string;
    tierLabel: string;
    tierEmoji: string;
    totalEvaluations: number;
  };
  history30d: Array<{
    date: string;
    globalScore: number;
    domainScores: Record<string, number>;
  }>;
  lastActivity: string | null;
}

async function getRuntime(id: string): Promise<RuntimePublic | null> {
  try {
    return await apiFetch<RuntimePublic>(`/api/runtime/${id}/public`);
  } catch {
    return null;
  }
}

function getWeeklyData(history: RuntimePublic["history30d"]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  if (history.length === 0) {
    return days.map((day) => ({ day, score: 50 }));
  }
  const last7 = history.slice(-7);
  return last7.map((h, i) => ({
    day: days[i % 7],
    score: Math.round(h.globalScore),
  }));
}

function generateBadges(runtime: RuntimePublic) {
  const badges = [];
  const { tier } = runtime.maturity;

  // Maturity badges
  badges.push({
    id: "novice",
    icon: "\u{1F952}",
    label: "Seedling",
    earned: true,
  });
  badges.push({
    id: "growing",
    icon: "\u{1F33F}",
    label: "Growing",
    earned: ["YELLOW", "ORANGE", "BLUE"].includes(tier),
  });
  badges.push({
    id: "mature",
    icon: "\u{1F333}",
    label: "Mature",
    earned: ["ORANGE", "BLUE"].includes(tier),
  });
  badges.push({
    id: "expert",
    icon: "\u{1F98C}",
    label: "Expert",
    earned: tier === "BLUE",
  });

  // Domain badges (earned if score > 70)
  for (const [code, data] of Object.entries(runtime.domains)) {
    const meta = domainMeta(code);
    badges.push({
      id: `domain-${code}`,
      icon: meta.emoji,
      label: `${meta.label} Pro`,
      earned: data.score >= 70,
    });
  }

  // Streak badge
  const maxStreak = Math.max(...Object.values(runtime.domains).map((d) => d.streak));
  badges.push({
    id: "streak",
    icon: "\u{1F525}",
    label: "On Fire",
    earned: maxStreak >= 5,
  });

  // Evaluations badge
  badges.push({
    id: "century",
    icon: "\u{1F4AF}",
    label: "100 Evals",
    earned: runtime.maturity.totalEvaluations >= 100,
  });

  // High score badge
  badges.push({
    id: "high-score",
    icon: "\u{2B50}",
    label: "Star Player",
    earned: runtime.globalScore >= 80,
  });

  return badges;
}

function getNextMission(runtime: RuntimePublic) {
  let lowestDomain = "TECH";
  let lowestScore = 100;
  for (const [code, data] of Object.entries(runtime.domains)) {
    if (data.score < lowestScore) {
      lowestScore = data.score;
      lowestDomain = code;
    }
  }
  const meta = domainMeta(lowestDomain);
  const missions: Record<string, string> = {
    TECH: "Complete a code review with detailed technical feedback",
    OPS: "Set up monitoring or improve CI/CD for your project",
    JUDGMENT: "Make a well-reasoned architectural decision with tradeoff analysis",
    COMMS: "Write clear documentation for a complex system",
    ORCH: "Coordinate a multi-step workflow across different agents",
  };
  return {
    challenge: missions[lowestDomain] || "Improve your lowest-scoring domain",
    domain: `${meta.emoji} ${meta.label}`,
    streak: Math.max(...Object.values(runtime.domains).map((d) => d.streak)),
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runtime = await getRuntime(id);

  if (!runtime) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Runtime not found</h1>
        <p className="text-muted-foreground mb-8">
          This runtime doesn&apos;t exist or has been removed.
        </p>
        <a href="/feed" className="text-primary hover:underline">
          Browse Feed &rarr;
        </a>
      </div>
    );
  }

  const domainScores = Object.entries(runtime.domains).map(([code, data]) => {
    const meta = domainMeta(code);
    return { domain: code, emoji: meta.emoji, label: meta.label, score: Math.round(data.score) };
  });
  const weeklyData = getWeeklyData(runtime.history30d);
  const badges = generateBadges(runtime);
  const mission = getNextMission(runtime);
  const name = runtime.displayName || `${runtime.platform}/${runtime.model}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {runtime.platform} &middot; {runtime.model} &middot; {runtime.thinking}
          </p>
        </div>
        <a
          href={`/share/${id}`}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Share Profile
        </a>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left column: Score + Maturity */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center">
            <ScoreGauge score={Math.round(runtime.globalScore)} size="lg" />
            <div className="w-full mt-6">
              <MaturityBar
                tier={runtime.maturity.tier}
                evalCount={runtime.maturity.totalEvaluations}
              />
            </div>
          </div>

          {/* Next Mission */}
          <DailyChallenge
            challenge={mission.challenge}
            domain={mission.domain}
            streak={mission.streak}
          />
        </div>

        {/* Center column: Chart + Breakdown */}
        <div className="md:col-span-2 space-y-6">
          {/* Weekly trend */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Weekly Trend</h2>
            <WeeklyTrendChart data={weeklyData} />
          </div>

          {/* Score breakdown */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Score Breakdown</h2>
            <ScoreBreakdown domains={domainScores} />
          </div>

          {/* Badges */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Badges Cabinet</h2>
            <BadgesCabinet badges={badges} />
          </div>
        </div>
      </div>
    </div>
  );
}
