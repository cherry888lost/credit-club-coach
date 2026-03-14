"use client";

import { cn } from "@/lib/utils";
import { BookOpen, Star, TrendingUp, Clock, Shield, Target } from "lucide-react";

interface PatternCardProps {
  category: string;
  technique: string;
  examplePhrase: string;
  context?: string;
  usageCount?: number;
  effectivenessScore?: number;
  sourceCalls?: string[];
  isBenchmark?: boolean;
  className?: string;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  value_stacking: { icon: TrendingUp, color: "indigo", label: "Value Stacking" },
  objection_handling: { icon: Shield, color: "amber", label: "Objection Handling" },
  urgency_creation: { icon: Clock, color: "red", label: "Urgency Creation" },
  closing_phrases: { icon: Target, color: "green", label: "Closing Phrases" },
};

export function PatternCard({
  category, technique, examplePhrase, context, usageCount, effectivenessScore, isBenchmark, className,
}: PatternCardProps) {
  const config = CATEGORY_CONFIG[category] || { icon: BookOpen, color: "zinc", label: category };
  const Icon = config.icon;
  
  return (
    <div className={cn(
      "bg-white dark:bg-zinc-900 rounded-xl border shadow-sm hover:shadow-md transition-shadow",
      isBenchmark 
        ? "border-amber-300 dark:border-amber-700" 
        : "border-zinc-200 dark:border-zinc-800",
      className
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 text-${config.color}-600 dark:text-${config.color}-400`} />
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${config.color}-100 dark:bg-${config.color}-900/30 text-${config.color}-700 dark:text-${config.color}-400`}>
              {config.label}
            </span>
          </div>
          {isBenchmark && (
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          )}
        </div>
        
        {/* Technique name */}
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">{technique}</h4>
        
        {/* Example phrase */}
        <p className="text-sm text-zinc-700 dark:text-zinc-300 italic border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 mb-3">
          &ldquo;{examplePhrase}&rdquo;
        </p>
        
        {/* Context */}
        {context && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">{context}</p>
        )}
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          {usageCount != null && (
            <span>{usageCount} uses</span>
          )}
          {effectivenessScore != null && (
            <span className={cn(
              "font-medium",
              effectivenessScore >= 8 ? "text-green-600 dark:text-green-400" :
              effectivenessScore >= 5 ? "text-amber-600 dark:text-amber-400" :
              "text-red-600 dark:text-red-400"
            )}>
              {effectivenessScore}/10 effectiveness
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
