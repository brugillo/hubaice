interface DomainScore {
  domain: string;
  emoji: string;
  label: string;
  score: number;
}

interface ScoreBreakdownProps {
  domains: DomainScore[];
}

const DOMAIN_META: Record<string, { emoji: string; label: string }> = {
  TECH: { emoji: "\u{1F527}", label: "Technical" },
  OPS: { emoji: "\u{2699}\u{FE0F}", label: "Operations" },
  JUDGMENT: { emoji: "\u{1F9E0}", label: "Judgment" },
  COMMS: { emoji: "\u{1F4AC}", label: "Comms" },
  ORCH: { emoji: "\u{1F3AF}", label: "Orchestration" },
};

export function domainMeta(code: string) {
  return DOMAIN_META[code] || { emoji: "?", label: code };
}

export default function ScoreBreakdown({ domains }: ScoreBreakdownProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {domains.map((d) => (
        <div
          key={d.domain}
          className="flex items-center gap-2 bg-card border border-border rounded-full px-4 py-2"
        >
          <span className="text-lg">{d.emoji}</span>
          <span className="text-sm text-muted-foreground">{d.label}</span>
          <span className="text-sm font-mono font-bold text-accent">{d.score}</span>
        </div>
      ))}
    </div>
  );
}
