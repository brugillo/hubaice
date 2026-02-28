"use client";

import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  label?: string;
  animated?: boolean;
}

const SIZES = {
  sm: { width: 100, height: 60, strokeWidth: 8, fontSize: 18, labelSize: 10 },
  md: { width: 160, height: 95, strokeWidth: 10, fontSize: 28, labelSize: 12 },
  lg: { width: 240, height: 140, strokeWidth: 14, fontSize: 42, labelSize: 14 },
};

export default function ScoreGauge({ score, size = "md", label, animated = true }: ScoreGaugeProps) {
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score);
  const s = SIZES[size];
  const cx = s.width / 2;
  const cy = s.height - 4;
  const r = cx - s.strokeWidth;
  // Semicircle: arc from left to right (180 degrees)
  const circumference = Math.PI * r;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (circumference * displayScore) / 100;

  useEffect(() => {
    if (!animated) {
      setDisplayScore(score);
      return;
    }
    let frame: number;
    const start = performance.now();
    const duration = 1200;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * clampedScore));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score, animated, clampedScore]);

  const scoreColor = "#99FF00";
  const trackColor = "#1A2B3C";

  return (
    <div className="flex flex-col items-center">
      <svg width={s.width} height={s.height} viewBox={`0 0 ${s.width} ${s.height}`}>
        {/* Track */}
        <path
          d={`M ${s.strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${s.width - s.strokeWidth / 2} ${cy}`}
          fill="none"
          stroke={trackColor}
          strokeWidth={s.strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${s.strokeWidth / 2} ${cy} A ${r} ${r} 0 0 1 ${s.width - s.strokeWidth / 2} ${cy}`}
          fill="none"
          stroke={scoreColor}
          strokeWidth={s.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: animated ? "none" : "stroke-dashoffset 0.3s ease" }}
        />
        {/* Score text */}
        <text
          x={cx}
          y={cy - s.fontSize * 0.3}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={s.fontSize}
          fontWeight="bold"
          fontFamily="var(--font-mono)"
        >
          {displayScore}
        </text>
        {/* "AICE Score" label */}
        <text
          x={cx}
          y={cy - s.fontSize * 0.3 - s.fontSize - 2}
          textAnchor="middle"
          fill="#8A9BB0"
          fontSize={s.labelSize}
        >
          AICE Score
        </text>
      </svg>
      {label && (
        <span className="text-muted-foreground text-xs mt-1">{label}</span>
      )}
    </div>
  );
}
