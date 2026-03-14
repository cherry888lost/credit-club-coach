"use client";

import { cn } from "@/lib/utils";
import { TrendingUp, Clock, Anchor, ShieldCheck, ChevronDown } from "lucide-react";
import { useState } from "react";

interface TechniqueData {
  score: number;
  components_used?: string[];
  types_used?: string[];
  evidence: string[];
}

interface TechniqueBadgeProps {
  name: string;
  technique: TechniqueData;
  maxScore?: number;
  className?: string;
}

const TECHNIQUE_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
  value_stacking: { icon: TrendingUp, color: "indigo" },
  urgency_creation: { icon: Clock, color: "red" },
  anchoring: { icon: Anchor, color: "blue" },
  authority_framing: { icon: ShieldCheck, color: "purple" },
};

export function TechniqueBadge({ name, technique, maxScore = 10, className }: TechniqueBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const config = TECHNIQUE_CONFIG[name] || { icon: TrendingUp, color: "zinc" };
  const Icon = config.icon;
  const pct = (technique.score / maxScore) * 100;
  
  const scoreColor = pct >= 80 ? "text-green-600 dark:text-green-400" 
    : pct >= 50 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";
  
  const barColor = pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  
  const displayName = name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  
  return (
    <div className={cn(
      "bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden",
      className
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <Icon className={cn("w-5 h-5", `text-${config.color}-600 dark:text-${config.color}-400`)} />
        <span className="flex-1 text-left text-sm font-medium text-zinc-900 dark:text-white">
          {displayName}
        </span>
        <span className={cn("text-lg font-bold", scoreColor)}>
          {technique.score}/{maxScore}
        </span>
        <ChevronDown className={cn(
          "w-4 h-4 text-zinc-400 transition-transform",
          expanded && "rotate-180"
        )} />
      </button>
      
      {/* Score bar */}
      <div className="px-4 pb-2">
        <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
          {/* Tags */}
          {(technique.components_used || technique.types_used) && (
            <div className="flex flex-wrap gap-1.5">
              {(technique.components_used || technique.types_used || []).map((item, i) => (
                <span key={i} className="px-2 py-0.5 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {item.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          
          {/* Evidence */}
          {technique.evidence.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Evidence:</p>
              {technique.evidence.map((ev, i) => (
                <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 italic border-l-2 border-zinc-300 dark:border-zinc-600 pl-3">
                  &ldquo;{ev}&rdquo;
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
