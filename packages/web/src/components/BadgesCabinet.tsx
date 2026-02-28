interface Badge {
  id: string;
  icon: string;
  label: string;
  earned: boolean;
}

interface BadgesCabinetProps {
  badges: Badge[];
}

export default function BadgesCabinet({ badges }: BadgesCabinetProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
      {badges.map((b) => (
        <div
          key={b.id}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            b.earned
              ? "bg-primary/10 border border-primary/30"
              : "bg-muted/50 border border-border opacity-40"
          }`}
          title={b.label}
        >
          <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center text-xl">
            {b.icon}
          </div>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}
