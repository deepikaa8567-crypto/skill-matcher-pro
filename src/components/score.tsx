import { useEffect, useState } from "react";
import { motion, useMotionValue, animate } from "motion/react";
import { cn } from "@/lib/utils";

export function scoreTone(score: number) {
  if (score >= 75) return "high" as const;
  if (score >= 50) return "mid" as const;
  return "low" as const;
}

const toneVar: Record<"high" | "mid" | "low", string> = {
  high: "var(--score-high)",
  mid: "var(--score-mid)",
  low: "var(--score-low)",
};

export function useCountUp(target: number, duration = 1) {
  const mv = useMotionValue(0);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const controls = animate(mv, target, {
      duration,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, duration, mv]);
  return value;
}

export function ScoreRing({
  score,
  size = 96,
  label = "Overall",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const tone = scoreTone(score);
  const value = useCountUp(score);
  const stroke = size / 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            stroke="var(--color-muted)"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={toneVar[tone]}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-semibold tabular-nums"
            style={{ fontSize: size / 4, color: toneVar[tone] }}
          >
            {value}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = scoreTone(score);
  const value = useCountUp(score, 0.8);
  return (
    <span
      className={cn(
        "inline-flex min-w-14 items-center justify-center rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
      )}
      style={{
        color: toneVar[tone],
        backgroundColor: `color-mix(in oklch, ${toneVar[tone]}, transparent 88%)`,
      }}
    >
      {value}
    </span>
  );
}

export function ScoreBar({ label, score }: { label: string; score: number }) {
  const tone = scoreTone(score);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(score)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: toneVar[tone] }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
