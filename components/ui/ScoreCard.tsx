"use client";

import { cn } from "@/lib/utils";

interface ScoreCardProps {
  score: number;
  maxScore?: number;
  label: string;
  grade?: string;
  size?: "sm" | "md" | "lg";
  showBar?: boolean;
  className?: string;
}

export function ScoreCard({ score, maxScore = 100, label, grade, size = "md", showBar = false, className }: ScoreCardProps) {
  const percentage = (score / maxScore) * 100;
  
  const getColor = (pct: number) => {
    if (pct >= 80) return { text: "text-green-600 dark:text-green-400", bg: "bg-green-500", ring: "ring-green-500/20" };
    if (pct >= 60) return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", ring: "ring-amber-500/20" };
    return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500", ring: "ring-red-500/20" };
  };
  
  const colors = getColor(percentage);
  
  const sizes = {
    sm: { score: "text-2xl", label: "text-xs", container: "p-3", grade: "text-sm" },
    md: { score: "text-4xl", label: "text-sm", container: "p-5", grade: "text-lg" },
    lg: { score: "text-6xl", label: "text-base", container: "p-8", grade: "text-2xl" },
  };
  
  const s = sizes[size];
  
  return (
    <div className={cn(
      "bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm",
      s.container,
      className
    )}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className={cn("font-bold", s.score, colors.text)}>{score}</p>
          <p className={cn("text-zinc-500 dark:text-zinc-400 mt-1", s.label)}>{label}</p>
        </div>
        {grade && (
          <span className={cn("font-bold", s.grade, colors.text)}>{grade}</span>
        )}
      </div>
      {showBar && (
        <div className="mt-3 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full transition-all duration-500", colors.bg)}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
