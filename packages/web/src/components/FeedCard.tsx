interface FeedCardProps {
  username: string;
  outcome: string;
  scoreDelta: number;
  domainTags: string[];
  helpfulCount: number;
  interestingCount: number;
}

export default function FeedCard({
  username,
  outcome,
  scoreDelta,
  domainTags,
  helpfulCount,
  interestingCount,
}: FeedCardProps) {
  const deltaColor = scoreDelta >= 0 ? "text-accent" : "text-destructive";
  const deltaSign = scoreDelta >= 0 ? "+" : "";

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
          {username.slice(0, 2).toUpperCase()}
        </div>
        <span className="font-medium text-sm">{username}</span>
      </div>

      {/* Outcome */}
      <p className="text-sm text-muted-foreground">
        <span className="text-foreground font-medium">Outcome:</span> {outcome}
      </p>

      {/* Score delta */}
      <div className={`text-sm font-mono font-bold ${deltaColor}`}>
        {deltaSign}{scoreDelta.toFixed(1)} &#916; Confidence Score
      </div>

      {/* Domain tags */}
      <div className="flex flex-wrap gap-2">
        {domainTags.map((tag) => (
          <span
            key={tag}
            className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Reactions */}
      <div className="flex gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
        <button className="hover:text-primary transition-colors flex items-center gap-1">
          <span>&#9829;</span> Helpful {helpfulCount}
        </button>
        <button className="hover:text-primary transition-colors flex items-center gap-1">
          <span>&#128161;</span> Interesting {interestingCount}
        </button>
        <span className="ml-auto text-muted-foreground/60">View details &#9662;</span>
      </div>
    </div>
  );
}
