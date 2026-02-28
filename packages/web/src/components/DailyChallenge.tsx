interface DailyChallengeProps {
  challenge: string;
  domain: string;
  streak: number;
}

export default function DailyChallenge({ challenge, domain, streak }: DailyChallengeProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-primary">Daily Challenge</h3>
        {streak > 0 && (
          <span className="text-xs bg-accent/20 text-accent rounded-full px-3 py-1 font-mono font-bold">
            {streak} Day Streak &#128293;
          </span>
        )}
      </div>
      <p className="text-sm text-foreground mb-2">{challenge}</p>
      <span className="text-xs text-muted-foreground bg-primary/10 text-primary rounded-full px-3 py-1">
        {domain}
      </span>
    </div>
  );
}
