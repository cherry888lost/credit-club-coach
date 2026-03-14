"use client";

import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
} from "lucide-react";

export interface CoachingMarker {
  timestamp: string;
  seconds: number;
  title: string;
  category: string;
  type: "positive" | "negative";
  severity: "high" | "medium" | "low";
  note: string;
}

interface CoachingMarkersProps {
  markers: CoachingMarker[];
  /** Optional: URL to recording that supports #t= fragment for timestamp jumping */
  recordingUrl?: string | null;
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

function severityRing(type: "positive" | "negative", severity: string): string {
  if (type === "positive") {
    return severity === "high"
      ? "border-green-400 dark:border-green-500"
      : severity === "medium"
      ? "border-green-300 dark:border-green-600"
      : "border-green-200 dark:border-green-700";
  }
  return severity === "high"
    ? "border-red-400 dark:border-red-500"
    : severity === "medium"
    ? "border-amber-400 dark:border-amber-500"
    : "border-amber-300 dark:border-amber-600";
}

function typeBg(type: "positive" | "negative"): string {
  return type === "positive"
    ? "bg-green-50 dark:bg-green-900/20"
    : "bg-red-50 dark:bg-red-900/20";
}

function typeText(type: "positive" | "negative"): string {
  return type === "positive"
    ? "text-green-700 dark:text-green-400"
    : "text-red-700 dark:text-red-400";
}

export function CoachingMarkers({ markers, recordingUrl }: CoachingMarkersProps) {
  if (!markers || markers.length === 0) return null;

  // Sort by seconds (timeline order)
  const sorted = [...markers].sort((a, b) => a.seconds - b.seconds);

  const positiveCount = sorted.filter((m) => m.type === "positive").length;
  const negativeCount = sorted.filter((m) => m.type === "negative").length;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Coaching Markers
          </h3>
          <span className="text-xs text-zinc-400 ml-1">
            {sorted.length} moment{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {positiveCount > 0 && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <TrendingUp className="w-3.5 h-3.5" /> {positiveCount}
            </span>
          )}
          {negativeCount > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <TrendingDown className="w-3.5 h-3.5" /> {negativeCount}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {sorted.map((marker, i) => {
          const Icon =
            marker.type === "positive"
              ? CheckCircle
              : marker.severity === "high"
              ? AlertTriangle
              : TrendingDown;

          return (
            <div
              key={i}
              className={`p-4 flex gap-3 border-l-3 ${severityRing(
                marker.type,
                marker.severity
              )}`}
              style={{ borderLeftWidth: "3px" }}
            >
              {/* Timestamp */}
              <div className="flex-shrink-0 pt-0.5">
                {recordingUrl ? (
                  <a
                    href={`${recordingUrl}#t=${marker.seconds}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeBg(
                      marker.type
                    )} ${typeText(marker.type)} hover:opacity-80 transition-opacity`}
                    title="Jump to timestamp"
                  >
                    <Clock className="w-3 h-3" />
                    {marker.timestamp}
                  </a>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeBg(
                      marker.type
                    )} ${typeText(marker.type)}`}
                  >
                    <Clock className="w-3 h-3" />
                    {marker.timestamp}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${typeText(marker.type)}`}
                  />
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {marker.title}
                  </h4>
                  {marker.severity === "high" && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                        marker.type === "negative"
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                          : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      }`}
                    >
                      {marker.type === "negative" ? "critical" : "highlight"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  {CATEGORY_LABELS[marker.category] || marker.category}
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {marker.note}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
