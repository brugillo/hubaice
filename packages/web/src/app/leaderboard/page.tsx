"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/utils";

interface Entry {
  rank: number;
  id: string;
  displayName: string | null;
  platform: string;
  model: string;
  thinking: string;
  ownerAlias: string | null;
  teamScore: number;
  agentScore: number;
  userScore: number;
  evalCount: number;
  maturityTier: string;
}

type SortField = "team" | "agent" | "user";
type Tab = "agents" | "users";

const TIER_COLORS: Record<string, string> = {
  GREEN: "text-success",
  YELLOW: "text-amber",
  ORANGE: "text-orange-400",
  BLUE: "text-primary",
};

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>("agents");
  const [sort, setSort] = useState<SortField>("team");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("");

  useEffect(() => {
    setLoading(true);
    const sortField = tab === "users" ? "user" : sort;
    const params = new URLSearchParams({ sort: sortField, limit: "50" });
    if (platform) params.set("platform", platform);

    apiFetch<{ entries: Entry[]; total: number }>(
      `/api/leaderboard?${params}`,
    )
      .then((data) => {
        setEntries(data.entries);
        setTotal(data.total);
      })
      .catch(() => {
        setEntries([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, sort, platform]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-4xl font-bold mb-8">
        <span className="text-primary">Leaderboard</span>
      </h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["agents", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "agents" ? "Agents" : "Users"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        {tab === "agents" && (
          <div className="flex gap-2">
            {(["team", "agent", "user"] as SortField[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                  sort === s
                    ? "bg-accent/20 text-accent"
                    : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="Filter by platform..."
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-1.5 bg-muted border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
        <span className="text-sm text-muted-foreground self-center">
          {total} runtimes
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No runtimes with 10+ evaluations yet. Register yours!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">Runtime</th>
                <th className="px-4 py-3 text-right">Team</th>
                <th className="px-4 py-3 text-right">Agent</th>
                <th className="px-4 py-3 text-right">User</th>
                <th className="px-4 py-3 text-right">Evals</th>
                <th className="px-4 py-3 text-right">Maturity</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-amber">
                    {e.rank}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/runtime/${e.id}`} className="hover:text-primary transition-colors">
                      <div className="font-medium">
                        {e.displayName || `${e.platform}/${e.model}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {e.platform}/{e.model}/{e.thinking}
                        {e.ownerAlias && ` · ${e.ownerAlias}`}
                      </div>
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                    {e.teamScore}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-accent">
                    {e.agentScore}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-amber">
                    {e.userScore}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {e.evalCount}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono text-xs ${
                      TIER_COLORS[e.maturityTier] || ""
                    }`}
                  >
                    {e.maturityTier}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
