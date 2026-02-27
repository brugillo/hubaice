"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/utils";

interface RegisterResponse {
  runtimeId: string;
  apiKey: string;
  runtime: string;
  message: string;
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    platform: "",
    model: "",
    thinking: "high",
    displayName: "",
    ownerAlias: "",
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
          ...form,
          displayName: form.displayName || undefined,
          ownerAlias: form.ownerAlias || undefined,
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
            Runtime Registrado
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
                API Key (se muestra UNA VEZ — ¡guárdala ahora!)
              </label>
              <div className="flex gap-2 mt-1">
                <code className="flex-1 bg-muted p-3 rounded text-xs font-mono break-all">
                  {result.apiKey}
                </code>
                <button
                  onClick={copyKey}
                  className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm shrink-0"
                >
                  {copied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
            <p className="text-sm text-amber">{result.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-2">
        Registrar <span className="text-accent">Runtime</span>
      </h1>
      <p className="text-muted-foreground mb-8">
        Registra tu runtime IA para empezar a puntuar. Recibirás una API key para
        tu AICE skill.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Plataforma *</label>
          <input
            type="text"
            required
            placeholder="e.g. openclaw, claude-code"
            value={form.platform}
            onChange={(e) => setForm({ ...form, platform: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Modelo *</label>
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
          <label className="block text-sm font-medium mb-1">Thinking *</label>
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

        <div>
          <label className="block text-sm font-medium mb-1">Nombre para mostrar</label>
          <input
            type="text"
            placeholder="e.g. ComPi (Sergio's AI)"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Alias del propietario</label>
          <input
            type="text"
            placeholder="e.g. brugillo"
            value={form.ownerAlias}
            onChange={(e) => setForm({ ...form, ownerAlias: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
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
          {loading ? "Registrando..." : "Registrar Runtime"}
        </button>
      </form>
    </div>
  );
}
