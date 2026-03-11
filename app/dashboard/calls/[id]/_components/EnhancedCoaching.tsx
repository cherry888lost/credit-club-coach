"use client";

import {
  AlertTriangle,
  MessageCircle,
  Lightbulb,
  ArrowRight,
  ShieldAlert,
  BookOpen,
} from "lucide-react";

interface EnhancedWeakness {
  category: string;
  what_went_wrong: string;
  why_it_matters: string;
  better_response_example: string;
  credit_club_context?: string;
}

interface ObjectionScript {
  objection: string;
  prospect_said: string;
  rep_said: string;
  better_response: string;
  technique: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  rapport_tone: "Rapport & Tone",
  discovery_quality: "Discovery Quality",
  call_control: "Call Control",
  pain_amplification: "Pain Amplification",
  offer_explanation: "Offer Explanation",
  objection_handling: "Objection Handling",
  urgency_close_attempt: "Urgency & Close",
  confidence_authority: "Confidence & Authority",
  next_steps_clarity: "Next Steps Clarity",
  overall_close_quality: "Close Quality",
};

export function EnhancedCoaching({
  enhancedWeaknesses,
  objectionScripts,
}: {
  enhancedWeaknesses: EnhancedWeakness[];
  objectionScripts: ObjectionScript[];
}) {
  if (
    (!enhancedWeaknesses || enhancedWeaknesses.length === 0) &&
    (!objectionScripts || objectionScripts.length === 0)
  ) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Weaknesses */}
      {enhancedWeaknesses && enhancedWeaknesses.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-800/50">
          <div className="p-4 border-b border-amber-200 dark:border-amber-800/50 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-amber-900 dark:text-amber-300">
              Detailed Coaching — What to Fix
            </h3>
          </div>

          <div className="p-4 space-y-4">
            {enhancedWeaknesses.map((w, i) => (
              <div
                key={i}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
              >
                {/* Category header */}
                <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500 uppercase">
                    {CATEGORY_LABELS[w.category] || w.category}
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* What went wrong */}
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                      <ShieldAlert className="w-4 h-4" />
                      What Went Wrong
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 pl-5.5">
                      {w.what_went_wrong}
                    </p>
                  </div>

                  {/* Why it matters */}
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                      <Lightbulb className="w-4 h-4" />
                      Why It Matters
                    </div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 pl-5.5">
                      {w.why_it_matters}
                    </p>
                  </div>

                  {/* Better response */}
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400 mb-1">
                      <ArrowRight className="w-4 h-4" />
                      Better Response (Credit Club Script)
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-green-800 dark:text-green-200 italic border-l-3 border-green-400">
                      &ldquo;{w.better_response_example}&rdquo;
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Objection Scripts */}
      {objectionScripts && objectionScripts.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-indigo-200 dark:border-indigo-800/50">
          <div className="p-4 border-b border-indigo-200 dark:border-indigo-800/50 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-indigo-900 dark:text-indigo-300">
              Objection Handling Scripts
            </h3>
          </div>

          <div className="p-4 space-y-4">
            {objectionScripts.map((os, i) => (
              <div
                key={i}
                className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden"
              >
                {/* Objection header */}
                <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                    Objection: &ldquo;{os.objection}&rdquo;
                  </span>
                  <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                    ({os.technique})
                  </span>
                </div>

                <div className="p-4 space-y-3">
                  {/* What prospect said */}
                  <div>
                    <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> Prospect Said:
                    </p>
                    <blockquote className="text-sm text-zinc-600 dark:text-zinc-400 border-l-2 border-red-300 pl-3 italic">
                      &ldquo;{os.prospect_said}&rdquo;
                    </blockquote>
                  </div>

                  {/* What rep said */}
                  <div>
                    <p className="text-xs font-medium text-zinc-500 mb-1 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> Rep Responded:
                    </p>
                    <blockquote className="text-sm text-zinc-600 dark:text-zinc-400 border-l-2 border-amber-300 pl-3 italic">
                      &ldquo;{os.rep_said}&rdquo;
                    </blockquote>
                  </div>

                  {/* Better response */}
                  <div>
                    <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" /> Better Script:
                    </p>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm text-green-800 dark:text-green-200 border-l-3 border-green-400">
                      &ldquo;{os.better_response}&rdquo;
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
