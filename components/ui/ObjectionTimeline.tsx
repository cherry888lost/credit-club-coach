"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface ObjectionItem {
  type: string;
  timestamp?: string;
  quote: string;
  response_quote: string;
  handling_score: number;
  confidence?: number;
}

interface ObjectionTimelineProps {
  objections: ObjectionItem[];
  className?: string;
}

const OBJECTION_ICONS: Record<string, string> = {
  pricing: "💰",
  need_to_think: "🤔",
  partner: "👫",
  other: "❓",
};

function getScoreIcon(score: number) {
  if (score >= 8) return <CheckCircle className="w-4 h-4 text-green-500" />;
  if (score >= 5) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 5) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function ObjectionTimeline({ objections, className }: ObjectionTimelineProps) {
  if (!objections || objections.length === 0) {
    return (
      <div className={cn("text-sm text-zinc-500 dark:text-zinc-400 italic", className)}>
        No objections detected
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {objections.map((obj, i) => (
        <div
          key={i}
          className="relative pl-8 pb-4 last:pb-0 border-l-2 border-zinc-200 dark:border-zinc-700 last:border-transparent"
        >
          {/* Timeline dot */}
          <div className="absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-xs">
            {OBJECTION_ICONS[obj.type] || "❓"}
          </div>
          
          {/* Content */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {obj.timestamp && (
                  <span className="text-xs font-mono text-zinc-400">[{obj.timestamp}]</span>
                )}
                <span className="text-sm font-semibold text-zinc-900 dark:text-white capitalize">
                  {obj.type.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {getScoreIcon(obj.handling_score)}
                <span className={cn("text-sm font-bold", getScoreColor(obj.handling_score))}>
                  {obj.handling_score}/10
                </span>
              </div>
            </div>
            
            {/* Prospect quote */}
            <div className="mb-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Prospect:</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 italic border-l-2 border-red-300 dark:border-red-700 pl-3">
                &ldquo;{obj.quote}&rdquo;
              </p>
            </div>
            
            {/* Rep response */}
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Rep Response:</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 italic border-l-2 border-green-300 dark:border-green-700 pl-3">
                &ldquo;{obj.response_quote}&rdquo;
              </p>
            </div>
            
            {obj.confidence != null && (
              <div className="mt-2 text-xs text-zinc-400">
                Confidence: {obj.confidence}%
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
