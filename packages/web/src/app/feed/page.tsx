"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/utils";
import ScoreGauge from "@/components/ScoreGauge";
import MaturityBar from "@/components/MaturityBar";
import FeedCard from "@/components/FeedCard";

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

type Tab = "agents" | "users";

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("agents");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    setLoading(true);
    const sortField = tab === "users" ? "user" : "team";
    apiFetch<{ entries: Entry[] }>(`/api/leaderboard?sort=${sortField}&limit=20`)
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (e.displayName?.toLowerCase().includes(q)) ||
      e.platform.toLowerCase().includes(q) ||
      e.model.toLowerCase().includes(q)
    );
  });

  const topEntry = filtered[0];

  // Mobile: card-based feed
  if (isMobile) {
    return (
      <div className="px-4 py-6 space-y-6">
        {/* Top gauge */}
        <div className="flex flex-col items-center gap-4 pb-4 border-b border-border">
          <ScoreGauge score={topEntry?.teamScore ?? 50} size="md" />
          <div className="w-full max-w-xs">
            <MaturityBar tier={topEntry?.maturityTier ?? "GREEN"} evalCount={topEntry?.evalCount} />
          </div>
        </div>

        {/* Feed cards from leaderboard */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Top Runtimes</h2>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No runtimes found. Register yours to get started!
            </div>
          ) : (
            filtered.map((e) => (
              <a key={e.id} href={`/runtime/${e.id}`} className="block">
                <FeedCard
                  username={e.displayName || `${e.platform}/${e.model}`}
                  outcome={`${e.platform} runtime with ${e.evalCount} evaluations`}
                  scoreDelta={e.teamScore - 50}
                  domainTags={[e.maturityTier]}
                  helpfulCount={e.evalCount}
                  interestingCount={0}
                />
              </a>
            ))
          )}
        </div>
      </div>
    );
  }

  // Desktop: table view
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-4xl font-bold mb-8">
        <span className="text-primary">Feed</span> / Experiences
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

      {/* Search + Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <input
          type="text"
          placeholder="Search agents or users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        />
        <select className="px-4 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:border-primary/50 focus:outline-none">
          <option value="">All Categories</option>
          <option value="development">Development</option>
          <option value="productivity">Productivity</option>
          <option value="creative">Creative</option>
        </select>
        <select className="px-4 py-2 bg-muted border border-border rounded-lg text-sm text-foreground focus:border-primary/50 focus:outline-none">
          <option value="">All Assistants</option>
          <option value="claude">Claude</option>
          <option value="gpt">GPT</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No runtimes found. Register yours to get started!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-left">
                <th className="px-4 py-3 w-12">#</th>
                <th className="px-4 py-3">
                  {tab === "agents" ? "Agent Name" : "User"}
                </th>
                <th className="px-4 py-3 text-center w-20">Status</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3 text-right w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-amber">{e.rank}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {e.displayName || `${e.platform}/${e.model}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {e.platform} &middot; {e.evalCount} evals
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {e.evalCount >= 50 && (
                      <span className="text-xs bg-success/20 text-success rounded-full px-2 py-0.5">
                        Verified
                      </span>
                    )}
                    {e.evalCount >= 10 && e.evalCount < 50 && (
                      <span className="text-xs bg-primary/20 text-primary rounded-full px-2 py-0.5">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono font-bold text-accent">
                      {tab === "agents" ? e.agentScore : e.userScore}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/runtime/${e.id}`}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      &rarr;
                    </a>
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
