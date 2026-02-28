"use client";

import { useState } from "react";

type Step = 1 | 2 | 3;

const GOALS = [
  { id: "work", icon: "\u{1F4BC}", label: "Work" },
  { id: "study", icon: "\u{1F4DA}", label: "Study" },
  { id: "creativity", icon: "\u{1F3A8}", label: "Creativity" },
  { id: "parenting", icon: "\u{1F476}", label: "Parenting" },
  { id: "health", icon: "\u{1F3CB}\u{FE0F}", label: "Health" },
];

const ASSISTANTS = [
  { id: "claude", icon: "\u{1F916}", label: "Claude" },
  { id: "gpt", icon: "\u{1F4A1}", label: "GPT" },
  { id: "gemini", icon: "\u{2728}", label: "Gemini" },
  { id: "copilot", icon: "\u{1F6E9}\u{FE0F}", label: "Copilot" },
  { id: "other", icon: "\u{2699}\u{FE0F}", label: "Other" },
];

const DOMAINS = [
  { code: "TECH", emoji: "\u{1F527}", label: "Technical", desc: "Code quality, debugging, architecture" },
  { code: "OPS", emoji: "\u{2699}\u{FE0F}", label: "Operations", desc: "Process discipline, CI/CD, monitoring" },
  { code: "JUDGMENT", emoji: "\u{1F9E0}", label: "Judgment", desc: "Decision quality, tradeoff analysis" },
  { code: "COMMS", emoji: "\u{1F4AC}", label: "Comms", desc: "Documentation, clarity, handoffs" },
  { code: "ORCH", emoji: "\u{1F3AF}", label: "Orchestration", desc: "Coordination, workflows, delegation" },
];

export default function OnboardPage() {
  const [step, setStep] = useState<Step>(1);
  const [goal, setGoal] = useState("");
  const [assistant, setAssistant] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [platform, setPlatform] = useState("");
  const [model, setModel] = useState("");
  const [privacyMode, setPrivacyMode] = useState(true);

  const handleFinish = () => {
    const params = new URLSearchParams();
    params.set("platform", platform || assistant);
    params.set("model", model || assistant);
    params.set("thinking", "high");
    window.location.href = `/register?${params.toString()}`;
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`flex-1 h-0.5 ${
                  step > s ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Pick your goal */}
      {step === 1 && (
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-bold mb-2">Pick your goal</h1>
          <p className="text-muted-foreground mb-8">
            What do you primarily use AI for?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`p-4 rounded-xl border text-center transition-colors ${
                  goal === g.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="text-3xl mb-2">{g.icon}</div>
                <div className="text-sm font-medium">{g.label}</div>
              </button>
            ))}
          </div>
          <button
            onClick={() => goal && setStep(2)}
            disabled={!goal}
            className="w-full mt-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Pick your AI assistant */}
      {step === 2 && (
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-bold mb-2">Pick your AI assistant</h1>
          <p className="text-muted-foreground mb-8">
            Which AI do you work with most?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {ASSISTANTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAssistant(a.id)}
                className={`p-4 rounded-xl border text-center transition-colors ${
                  assistant === a.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="text-3xl mb-2">{a.icon}</div>
                <div className="text-sm font-medium">{a.label}</div>
              </button>
            ))}
          </div>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? "Hide" : "Show"} advanced options {showAdvanced ? "\u25B2" : "\u25BC"}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 bg-card border border-border rounded-xl p-4">
              <div>
                <label className="block text-sm font-medium mb-1">Platform</label>
                <input
                  type="text"
                  placeholder="e.g. openclaw, claude-code"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Model / Version</label>
                <input
                  type="text"
                  placeholder="e.g. anthropic/claude-opus-4-6"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
                />
              </div>
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="text-sm font-medium">Privacy Mode</div>
                  <div className="text-xs text-muted-foreground">Score patterns only, never store content</div>
                </div>
                <input
                  type="checkbox"
                  checked={privacyMode}
                  onChange={(e) => setPrivacyMode(e.target.checked)}
                  className="w-5 h-5 rounded border-border bg-muted accent-primary"
                />
              </label>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => assistant && setStep(3)}
              disabled={!assistant}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: How we score */}
      {step === 3 && (
        <div className="animate-fade-in-up">
          <h1 className="text-3xl font-bold mb-2">How we score</h1>
          <p className="text-muted-foreground mb-8">
            AICE measures AI collaboration confidence across 5 domains.
          </p>

          <div className="space-y-3 mb-8">
            {DOMAINS.map((d) => (
              <div
                key={d.code}
                className="flex items-start gap-3 bg-card border border-border rounded-xl p-4"
              >
                <span className="text-2xl">{d.emoji}</span>
                <div>
                  <div className="font-medium text-sm">
                    <span className="text-primary font-mono">{d.code}</span>
                    {" — "}
                    {d.label}
                  </div>
                  <div className="text-xs text-muted-foreground">{d.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-primary/30 rounded-xl p-4 mb-8">
            <p className="text-sm text-muted-foreground">
              <span className="text-primary font-bold">Privacy-first:</span> We analyze interaction patterns
              to compute scores. We never store your actual conversations or sell your data.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 border border-border text-foreground rounded-lg font-semibold hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleFinish}
              className="flex-1 py-3 bg-accent text-accent-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
