"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { 
  CheckCircle, AlertCircle, Lightbulb, Copy, Check, 
  TrendingUp, TrendingDown, Target
} from "lucide-react";

interface CoachingFeedbackProps {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  missedOpportunities?: string[];
  className?: string;
}

export function CoachingFeedback({ 
  strengths, weaknesses, recommendations, missedOpportunities, className 
}: CoachingFeedbackProps) {
  const [copied, setCopied] = useState(false);
  
  const copyAll = () => {
    const text = [
      "STRENGTHS",
      ...strengths.map(s => `• ${s}`),
      "",
      "WEAKNESSES",
      ...weaknesses.map(w => `• ${w}`),
      "",
      "RECOMMENDATIONS",
      ...recommendations.map((r, i) => `${i + 1}. ${r}`),
      ...(missedOpportunities?.length ? [
        "",
        "MISSED OPPORTUNITIES",
        ...missedOpportunities.map(m => `• ${m}`),
      ] : []),
    ].join("\n");
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Copy button */}
      <div className="flex justify-end">
        <button
          onClick={copyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy All"}
        </button>
      </div>
      
      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-800/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="text-sm font-semibold text-green-800 dark:text-green-400">Strengths</h4>
          </div>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-800 dark:text-green-300">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Weaknesses */}
      {weaknesses.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h4 className="text-sm font-semibold text-red-800 dark:text-red-400">Weaknesses</h4>
          </div>
          <ul className="space-y-2">
            {weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Missed Opportunities */}
      {missedOpportunities && missedOpportunities.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">Missed Opportunities</h4>
          </div>
          <ul className="space-y-2">
            {missedOpportunities.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-200 dark:border-indigo-800/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-400">Recommendations</h4>
          </div>
          <ol className="space-y-2">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-indigo-800 dark:text-indigo-300">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold shrink-0">
                  {i + 1}
                </span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
