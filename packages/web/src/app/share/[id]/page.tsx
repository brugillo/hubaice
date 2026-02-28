"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/utils";
import ScoreGauge from "@/components/ScoreGauge";
import { domainMeta } from "@/components/ScoreBreakdown";
import { useParams } from "next/navigation";

interface RuntimePublic {
  runtimeId: string;
  displayName: string | null;
  platform: string;
  model: string;
  globalScore: number;
  domains: Record<string, { score: number; evaluations: number; streak: number }>;
  maturity: {
    tier: string;
    tierLabel: string;
    totalEvaluations: number;
  };
}

export default function SharePage() {
  const params = useParams();
  const id = params.id as string;
  const [runtime, setRuntime] = useState<RuntimePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [hideUsername, setHideUsername] = useState(false);
  const [hideExactScore, setHideExactScore] = useState(false);
  const [includeQR, setIncludeQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    apiFetch<RuntimePublic>(`/api/runtime/${id}/public`)
      .then(setRuntime)
      .catch(() => setRuntime(null))
      .finally(() => setLoading(false));
  }, [id]);

  const drawCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !runtime) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = 600;
    const h = 400;
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.fillStyle = "#0A0F14";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 16);
    ctx.fill();

    // Border
    ctx.strokeStyle = "#1A2B3C";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, w - 2, h - 2, 16);
    ctx.stroke();

    // Title
    ctx.fillStyle = "#5FE0CF";
    ctx.font = "bold 14px Inter, sans-serif";
    ctx.fillText("HUBAICE", 30, 40);

    // Name
    const name = hideUsername ? "Anonymous" : (runtime.displayName || `${runtime.platform}/${runtime.model}`);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px Inter, sans-serif";
    ctx.fillText(name, 30, 80);

    // Score gauge (drawn manually)
    const cx = 300;
    const cy = 200;
    const r = 80;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.strokeStyle = "#1A2B3C";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score arc
    const score = runtime.globalScore;
    const displayScore = hideExactScore ? Math.round(score / 10) * 10 : Math.round(score);
    const angle = Math.PI - (Math.PI * displayScore) / 100;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI + (Math.PI * displayScore) / 100, false);
    ctx.strokeStyle = "#99FF00";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.stroke();

    // Score text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 36px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(displayScore), cx, cy - 10);
    ctx.fillStyle = "#8A9BB0";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("AICE Score", cx, cy - 50);
    ctx.textAlign = "start";

    // Domain scores
    const domains = Object.entries(runtime.domains);
    let dy = 260;
    for (const [code, data] of domains) {
      const meta = domainMeta(code);
      ctx.fillStyle = "#8A9BB0";
      ctx.font = "12px Inter, sans-serif";
      ctx.fillText(`${meta.emoji} ${meta.label}`, 100, dy);
      ctx.fillStyle = "#99FF00";
      ctx.font = "bold 12px monospace";
      ctx.fillText(String(Math.round(data.score)), 280, dy);
      dy += 24;
    }

    // Maturity
    ctx.fillStyle = "#5FE0CF";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(`${runtime.maturity.tierLabel} · ${runtime.maturity.totalEvaluations} evals`, 30, h - 30);

    // QR placeholder
    if (includeQR) {
      ctx.fillStyle = "#1A2B3C";
      ctx.fillRect(w - 90, h - 90, 60, 60);
      ctx.fillStyle = "#8A9BB0";
      ctx.font = "8px monospace";
      ctx.fillText("QR", w - 68, h - 55);
    }
  }, [runtime, hideUsername, hideExactScore, includeQR]);

  useEffect(() => {
    drawCard();
  }, [drawCard]);

  const downloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `aice-score-${id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const copyLink = () => {
    const url = `${window.location.origin}/runtime/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!runtime) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-4xl font-bold mb-4">Runtime not found</h1>
        <a href="/feed" className="text-primary hover:underline">
          Browse Feed &rarr;
        </a>
      </div>
    );
  }

  const name = hideUsername ? "Anonymous" : (runtime.displayName || `${runtime.platform}/${runtime.model}`);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">
        Share <span className="text-primary">Card</span>
      </h1>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left: Preview */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>

            {/* Live component preview */}
            <div className="bg-background border border-border rounded-xl p-6 space-y-4">
              <div className="text-xs text-primary font-bold tracking-wider">HUBAICE</div>
              <h3 className="text-xl font-bold">{name}</h3>
              <div className="flex justify-center">
                <ScoreGauge
                  score={hideExactScore ? Math.round(runtime.globalScore / 10) * 10 : Math.round(runtime.globalScore)}
                  size="md"
                  animated={false}
                />
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {Object.entries(runtime.domains).map(([code, data]) => {
                  const meta = domainMeta(code);
                  return (
                    <div key={code}>
                      <div className="text-lg">{meta.emoji}</div>
                      <div className="text-xs text-muted-foreground">{meta.label}</div>
                      <div className="text-sm font-mono font-bold text-accent">{Math.round(data.score)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {runtime.maturity.tierLabel} &middot; {runtime.maturity.totalEvaluations} evals
              </div>
            </div>

            {/* Hidden canvas for PNG export */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        </div>

        {/* Right: Options */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold">Options</h2>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Hide Username</span>
              <input
                type="checkbox"
                checked={hideUsername}
                onChange={(e) => setHideUsername(e.target.checked)}
                className="w-5 h-5 rounded border-border bg-muted accent-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Hide Exact Score (round to 10s)</span>
              <input
                type="checkbox"
                checked={hideExactScore}
                onChange={(e) => setHideExactScore(e.target.checked)}
                className="w-5 h-5 rounded border-border bg-muted accent-primary"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Include QR Code</span>
              <input
                type="checkbox"
                checked={includeQR}
                onChange={(e) => setIncludeQR(e.target.checked)}
                className="w-5 h-5 rounded border-border bg-muted accent-primary"
              />
            </label>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-3">
            <h2 className="text-lg font-semibold">Export</h2>

            <button
              onClick={downloadPNG}
              className="w-full py-3 bg-accent text-accent-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Download PNG
            </button>

            <button
              onClick={copyLink}
              className="w-full py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
            >
              {copied ? "Copied!" : "Copy Profile Link"}
            </button>
          </div>

          {/* Social share */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-3">Share</h2>
            <div className="flex gap-3">
              {[
                { name: "X", icon: "𝕏" },
                { name: "LinkedIn", icon: "in" },
                { name: "Email", icon: "@" },
              ].map((s) => (
                <button
                  key={s.name}
                  className="w-10 h-10 bg-muted border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors text-sm font-bold"
                  title={`Share on ${s.name}`}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
