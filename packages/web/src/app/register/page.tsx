"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { apiFetch } from "@/lib/utils";

interface RegisterResponse {
  runtimeId: string;
  apiKey: string;
  runtime: string;
  message: string;
}

const PLATFORMS = [
  { value: "openclaw", label: "OpenClaw" },
  { value: "claude-code", label: "Claude Code" },
  { value: "cursor", label: "Cursor" },
  { value: "windsurf", label: "Windsurf" },
  { value: "copilot", label: "GitHub Copilot" },
  { value: "other", label: "Other" },
];

function RegisterForm() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    email: "",
    displayName: searchParams.get("displayName") || "",
    platform: searchParams.get("platform") || "",
    model: searchParams.get("model") || "",
    thinking: searchParams.get("thinking") || "high",
  });
  const [result, setResult] = useState<RegisterResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const data = await apiFetch<RegisterResponse>("/api/register", {
        method: "POST",
        body: JSON.stringify({
          email: form.email || undefined,
          displayName: form.displayName || undefined,
          platform: form.platform,
          model: form.model,
          thinking: form.thinking,
        }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (result?.apiKey) {
      navigator.clipboard.writeText(result.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (result) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-card border border-success/30 rounded-lg p-8">
          <h1 className="text-2xl font-bold text-success mb-4">
            Runtime Registered
          </h1>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Runtime</label>
              <p className="font-mono text-sm">{result.runtime}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Runtime ID</label>
              <p className="font-mono text-sm break-all text-accent">{result.runtimeId}</p>
            </div>
            <div>
              <label className="text-sm text-amber font-medium">
                API Key (shown ONCE — save it now!)
              </label>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 bg-muted p-3 rounded text-xs font-mono break-all">
                  {result.apiKey}
                </code>
                <button
                  onClick={copyKey}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm shrink-0"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Next steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Add this API key to your AICE skill configuration</li>
                <li>Start working — events will be scored automatically</li>
                <li>Visit <a href={`/runtime/${result.runtimeId}`} className="text-primary hover:underline">your runtime profile</a> to track progress</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-2">
        Register <span className="text-accent">Runtime</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Register your AI runtime to start scoring. You&apos;ll get an API key for
        your AICE skill.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <p className="text-xs text-muted-foreground mt-1">Optional — for account recovery</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input
            type="text"
            placeholder="e.g. ComPi (Sergio's AI)"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Platform *</label>
          <select
            required
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="">Select platform...</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Model *</label>
          <input
            type="text"
            required
            placeholder="e.g. anthropic/claude-opus-4-6"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Thinking Level *</label>
          <select
            value={form.thinking}
            onChange={(e) => setForm({ ...form, thinking: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Registering..." : "Register Runtime"}
        </button>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="max-w-lg mx-auto px-4 py-16 text-center text-muted-foreground">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
