interface MaturityBarProps {
  tier: string;
  evalCount?: number;
}

const TIERS = [
  { key: "GREEN", label: "Novice", threshold: 0 },
  { key: "YELLOW", label: "Growing", threshold: 10 },
  { key: "ORANGE", label: "Mature", threshold: 50 },
  { key: "BLUE", label: "Expert", threshold: 200 },
];

export default function MaturityBar({ tier, evalCount }: MaturityBarProps) {
  const currentIdx = TIERS.findIndex((t) => t.key === tier);
  const progress = currentIdx >= 0 ? ((currentIdx + 1) / TIERS.length) * 100 : 25;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
        {TIERS.map((t, i) => (
          <span
            key={t.key}
            className={i <= currentIdx ? "text-primary font-medium" : ""}
          >
            {t.label}
          </span>
        ))}
      </div>
      <div className="h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
      {evalCount !== undefined && (
        <p className="text-xs text-muted-foreground mt-1">
          {evalCount} evaluations
        </p>
      )}
    </div>
  );
}
