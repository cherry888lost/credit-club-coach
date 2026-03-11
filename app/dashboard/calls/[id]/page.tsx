import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RefreshMediaButton } from "./refresh-media-button";
import { GenerateScoreButton } from "./generate-score-button";
import { OutcomeLogger } from "./_components/OutcomeLogger";
// import { FollowUpGenerator } from "./_components/FollowUpGenerator";
import { EnhancedCoaching } from "./_components/EnhancedCoaching";
import {
  ArrowLeft,
  User,
  Calendar,
  Flag,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Video,
  FileText,
  Sparkles,
  MonitorPlay,
  ChevronDown,
  Target,
  TrendingUp,
  TrendingDown,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lightbulb,
  MessageSquare,
  Wrench,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Category display names and icons
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

function scoreColor(score: number): string {
  if (score >= 8) return "text-green-600 dark:text-green-400";
  if (score >= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBgColor(score: number): string {
  if (score >= 8) return "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800";
  if (score >= 6) return "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800";
}

function qualityBadge(label: string) {
  const styles: Record<string, string> = {
    elite: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    strong: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    average: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    poor: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return styles[label] || styles.average;
}

export default async function CallDetailPage({ params }: { params: { id: string } }) {
  const { id } = await Promise.resolve(params);
  const user = await getCurrentUser();

  if (!user || !user.rep) {
    return null;
  }

  const isAdmin = user.rep.role === "admin";
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();

  // Fetch call with all related data
  const { data: call } = await supabase
    .from("calls")
    .select(`*, reps!left(id, name, role, sales_role), call_scores(*)`)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();

  if (!call) {
    notFound();
  }

  // Check if flagged
  const { data: flag } = await supabase
    .from("flags")
    .select("note, type")
    .eq("call_id", id)
    .eq("org_id", orgId)
    .single();

  const isFlagged = !!flag;
  const scores = call.call_scores;
  const isScored = scores?.overall_score != null;

  // Determine status
  const getStatus = () => {
    if (isFlagged) return { label: "Flagged", color: "red", icon: Flag };
    if (isScored) return { label: "Scored", color: "green", icon: CheckCircle };
    if (call.transcript) return { label: "Ready", color: "blue", icon: FileText };
    return { label: "Imported", color: "zinc", icon: AlertCircle };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  // Playback options
  const playbackOptions = [
    call.embed_url && { type: "embed", url: call.embed_url, label: "Watch" },
    call.video_url && { type: "video", url: call.video_url, label: "Download Video" },
    call.recording_url && { type: "audio", url: call.recording_url, label: "Download Audio" },
    call.share_url && { type: "share", url: call.share_url, label: "Open Recording" },
    !call.share_url && call.share_token && {
      type: "share",
      url: `https://fathom.video/share/${call.share_token}`,
      label: "Open Recording",
    },
  ].filter(Boolean) as { type: string; url: string; label: string }[];

  const bestOption = playbackOptions[0];

  // Parse categories from new scoring schema
  const categories = scores?.categories as Record<string, { score: number; reasoning: string; evidence: string; improvement_tip: string }> | null;

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/dashboard/calls"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to calls
      </Link>

      {/* ─── Header ─── */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
            {call.title || "Untitled Call"}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full ${
                status.color === "red"
                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  : status.color === "green"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : status.color === "blue"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              <StatusIcon className="w-4 h-4" /> {status.label}
            </span>

            {isScored && scores.quality_label && (
              <span className={`px-3 py-1.5 text-sm font-semibold rounded-full ${qualityBadge(scores.quality_label)}`}>
                {scores.quality_label.charAt(0).toUpperCase() + scores.quality_label.slice(1)}
              </span>
            )}

            {isScored && (
              <span className="px-2.5 py-1 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 text-xs font-semibold rounded-full uppercase">
                {(scores.manual_outcome || scores.outcome || "pending").replace("_", " ")}
              </span>
            )}

            {isScored && (scores.manual_close_type || scores.close_type) && (scores.manual_outcome || scores.outcome) !== 'no_sale' && (
              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-semibold rounded-full uppercase">
                {(scores.manual_close_type || scores.close_type).replace("_", " ")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" /> {call.reps?.name || "Unassigned"}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {new Date(call.created_at).toLocaleString()}
            </span>
            {call.duration_seconds && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {formatDuration(call.duration_seconds)}
              </span>
            )}
          </div>
        </div>

        {isScored && (
          <div className="text-center p-6 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 min-w-[140px]">
            <div
              className={`text-5xl font-bold ${
                scores.overall_score >= 80
                  ? "text-green-600"
                  : scores.overall_score >= 60
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {scores.overall_score}
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">/ 100</p>
          </div>
        )}
      </div>

      {/* ─── 1. Recording (prominent) ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
          <MonitorPlay className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Recording</h3>
        </div>

        <div className="aspect-video bg-zinc-950 flex items-center justify-center">
          {bestOption ? (
            bestOption.type === "embed" ? (
              <iframe
                src={bestOption.url}
                className="w-full h-full"
                allow="fullscreen"
                title="Recording"
              />
            ) : bestOption.type === "video" ? (
              <video
                src={bestOption.url}
                controls
                className="w-full h-full"
                poster={call.thumbnail_url}
              />
            ) : bestOption.type === "share" ? (
              <div className="text-center">
                {call.thumbnail_url && (
                  <img src={call.thumbnail_url} alt="" className="max-h-32 mx-auto mb-4 rounded" />
                )}
                <a
                  href={bestOption.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <ExternalLink className="w-5 h-5" /> Open Recording
                </a>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-zinc-500 mb-4">Recording available via {bestOption.label}</p>
                <a
                  href={bestOption.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Open →
                </a>
              </div>
            )
          ) : (
            <div className="text-center p-8">
              <Video className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 mb-2">Recording not available yet.</p>
              <p className="text-zinc-500 text-sm">Fathom may still be processing the share URL.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Generate / Regenerate Score Button ─── */}
      <GenerateScoreButton
        callId={call.id}
        hasScore={isScored}
        hasTranscript={!!call.transcript}
        isAdmin={isAdmin}
      />

      {/* ─── Low Signal Warning ─── */}
      {scores?.low_signal && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-400">Score Not Generated</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Transcript too short or not a real sales call. This appears to be a test recording or lacks the necessary sales conversation content for meaningful analysis.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── 2. Score Overview ─── */}
      {isScored && categories && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Score Breakdown</h3>
          </div>

          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(categories).map(([key, cat]) => (
              <div
                key={key}
                className={`rounded-lg p-4 text-center ${scoreBgColor(cat.score)}`}
              >
                <div className={`text-2xl font-bold ${scoreColor(cat.score)}`}>
                  {cat.score}
                </div>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-tight">
                  {CATEGORY_LABELS[key] || key}
                </p>
              </div>
            ))}
          </div>

          {/* Expandable details per category */}
          <div className="px-4 pb-4">
            <details className="group">
              <summary className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-300 py-2">
                <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
                Detailed category analysis
              </summary>
              <div className="mt-2 space-y-3">
                {Object.entries(categories).map(([key, cat]) => (
                  <div
                    key={key}
                    className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">
                        {CATEGORY_LABELS[key] || key}
                      </h4>
                      <span
                        className={`text-lg font-bold ${scoreColor(cat.score)}`}
                      >
                        {cat.score}/10
                      </span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      {cat.reasoning}
                    </p>
                    {cat.evidence && (
                      <blockquote className="text-xs text-zinc-500 dark:text-zinc-500 border-l-2 border-zinc-300 dark:border-zinc-600 pl-3 italic mb-2">
                        &ldquo;{cat.evidence}&rdquo;
                      </blockquote>
                    )}
                    {cat.improvement_tip && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 flex items-start gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        {cat.improvement_tip}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}

      {/* ─── 3. Strengths / Weaknesses ─── */}
      {isScored && (scores.strengths?.length > 0 || scores.weaknesses?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          {scores.strengths?.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-green-200 dark:border-green-800/50 shadow-sm">
              <div className="p-4 border-b border-green-200 dark:border-green-800/50 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-400">Strengths</h3>
              </div>
              <ul className="p-4 space-y-2">
                {scores.strengths.map((s: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {scores.weaknesses?.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-800/50 shadow-sm">
              <div className="p-4 border-b border-red-200 dark:border-red-800/50 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Weaknesses</h3>
              </div>
              <ul className="p-4 space-y-2">
                {scores.weaknesses.map((w: string, i: number) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ─── 4. Objections ─── */}
      {isScored &&
        (scores.objections_detected?.length > 0 ||
          scores.objections_handled_well?.length > 0 ||
          scores.objections_missed?.length > 0) && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Objections</h3>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Detected */}
              {scores.objections_detected?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MessageSquare className="w-4 h-4 text-zinc-500" />
                    <h4 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      Detected ({scores.objections_detected.length})
                    </h4>
                  </div>
                  <ul className="space-y-1">
                    {scores.objections_detected.map((o: string, i: number) => (
                      <li
                        key={i}
                        className="text-sm px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300"
                      >
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Handled well */}
              {scores.objections_handled_well?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <h4 className="text-sm font-medium text-green-700 dark:text-green-400">
                      Handled Well
                    </h4>
                  </div>
                  <ul className="space-y-1">
                    {scores.objections_handled_well.map((o: string, i: number) => (
                      <li
                        key={i}
                        className="text-sm px-2.5 py-1.5 bg-green-50 dark:bg-green-900/20 rounded text-green-700 dark:text-green-400"
                      >
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missed */}
              {scores.objections_missed?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <h4 className="text-sm font-medium text-red-700 dark:text-red-400">
                      Missed / Unresolved
                    </h4>
                  </div>
                  <ul className="space-y-1">
                    {scores.objections_missed.map((o: string, i: number) => (
                      <li
                        key={i}
                        className="text-sm px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 rounded text-red-700 dark:text-red-400"
                      >
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

      {/* ─── 5. Next Coaching Actions ─── */}
      {isScored && scores.next_coaching_actions?.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
          <div className="p-4 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">
              Next Coaching Actions
            </h3>
          </div>
          <ul className="p-4 space-y-2">
            {scores.next_coaching_actions.map((action: string, i: number) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-indigo-800 dark:text-indigo-200"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex-shrink-0">
                  {i + 1}
                </span>
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── 5b. Outcome Logger (manual) ─── */}
      {isScored && (
        <OutcomeLogger
          callId={call.id}
          initialOutcome={scores.manual_outcome}
          initialCloseType={scores.manual_close_type}
        />
      )}

      {/* ─── 5c. Enhanced Coaching (detailed weakness analysis) ─── */}
      {isScored && (
        <EnhancedCoaching
          enhancedWeaknesses={scores.enhanced_weaknesses || []}
          objectionScripts={scores.objection_scripts || []}
        />
      )}

      {/* ─── 5d. Follow-Up Message Generator (HIDDEN - not working) ─── */}
      {/* {isScored && <FollowUpGenerator callId={call.id} />} */}

      {/* ─── 6. Summary (if available, visible) ─── */}
      {call.summary && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Call Summary</h3>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{call.summary}</p>
        </div>
      )}

      {/* ─── 7. Transcript (collapsed) ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <details>
          <summary className="p-4 flex items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors">
            <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform [details[open]>&]:rotate-180" />
            <FileText className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Transcript</h3>
            {call.transcript && (
              <span className="text-xs text-zinc-400 ml-auto">
                {call.transcript.length.toLocaleString()} characters
              </span>
            )}
          </summary>
          <div className="px-4 pb-4 border-t border-zinc-200 dark:border-zinc-800">
            {call.transcript ? (
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 mt-4 max-h-[600px] overflow-y-auto">
                {call.transcript}
              </pre>
            ) : (
              <p className="text-zinc-500 mt-4">Transcript not available yet.</p>
            )}
          </div>
        </details>
      </div>

      {/* ─── 8. Admin Diagnostics (collapsed) ─── */}
      {isAdmin && (
        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
          <details>
            <summary className="p-4 flex items-center gap-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
              <ChevronDown className="w-5 h-5 text-zinc-400 transition-transform [details[open]>&]:rotate-180" />
              <Wrench className="w-4 h-4 text-zinc-500" />
              <h4 className="font-medium text-sm text-zinc-600 dark:text-zinc-400">
                Admin Diagnostics
              </h4>
            </summary>

            <div className="px-4 pb-4 border-t border-zinc-200 dark:border-zinc-700">
              <dl className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Source:</dt>
                  <dd className="font-mono">{call.source}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Recording ID:</dt>
                  <dd className="font-mono truncate max-w-[200px]">
                    {call.fathom_call_id || "N/A"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Rep Matched:</dt>
                  <dd>{call.reps?.name || "No"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Fathom Status:</dt>
                  <dd>{call.fathom_status || "unknown"}</dd>
                </div>

                {/* Media availability */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                  <p className="text-zinc-500 mb-2">Media Assets:</p>
                  <div className="flex flex-wrap gap-2">
                    {["embed_url", "share_url", "video_url", "recording_url"].map((key) => {
                      const present = !!(call as any)[key];
                      const label = key.replace("_url", "").replace("_", " ");
                      return (
                        <span
                          key={key}
                          className={`px-2 py-1 rounded text-[10px] ${
                            present
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {label} {present ? "✓" : "✗"}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Content availability */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                  <p className="text-zinc-500 mb-2">Content:</p>
                  <div className="space-y-1">
                    {[
                      { label: "Transcript", val: call.transcript, len: call.transcript?.length },
                      { label: "Summary", val: call.summary, len: call.summary?.length },
                      { label: "Scored", val: isScored, extra: isScored ? scores.overall_score : null },
                    ].map(({ label, val, len, extra }: any) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-zinc-500 text-[10px]">{label}:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            val
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {val ? `✓${len ? ` (${len} chars)` : ""}${extra != null ? ` ${extra}` : ""}` : "✗"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Webhook status */}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                  <p className="text-zinc-500 mb-2">Pipeline Status:</p>
                  <div className="space-y-1 text-[10px]">
                    {[
                      { label: "Event Type", val: call.fathom_event_type },
                      { label: "Share URL Source", val: call.share_url_source },
                      { label: "Transcript Source", val: call.transcript_source || (call.transcript ? "unknown" : "pending") },
                      { label: "Transcript Status", val: call.transcript_status || "pending" },
                      { label: "Summary Status", val: call.summary_status || "pending" },
                      { label: "Score Status", val: call.score_status || "pending" },
                    ].map(({ label, val }) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-zinc-500">{label}:</span>
                        <span
                          className={`font-mono ${
                            val === "ready" || val === "completed"
                              ? "text-green-600"
                              : val === "failed"
                              ? "text-red-600"
                              : "text-zinc-500"
                          }`}
                        >
                          {val || "N/A"}
                        </span>
                      </div>
                    ))}
                    {call.last_enriched_at && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Last Enriched:</span>
                        <span className="font-mono">
                          {new Date(call.last_enriched_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw webhook meta */}
                {call.raw_webhook_meta && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                    <details>
                      <summary className="text-zinc-500 text-[10px] cursor-pointer">
                        Raw Webhook Metadata
                      </summary>
                      <pre className="mt-1 p-2 bg-zinc-100 dark:bg-zinc-900 rounded text-[8px] overflow-x-auto max-h-40">
                        {JSON.stringify(call.raw_webhook_meta, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                {/* Fetch error */}
                {call.metadata?.fathom_api_fetch_error && (
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                    <p className="text-red-600 dark:text-red-400 text-[10px]">
                      Fetch Error: {call.metadata.fathom_api_fetch_error}
                    </p>
                  </div>
                )}
              </dl>

              {/* Refresh Media Button */}
              <RefreshMediaButton callId={call.id} />

              {call.metadata && (
                <details className="mt-4">
                  <summary className="text-xs text-zinc-500 cursor-pointer">
                    Raw Metadata
                  </summary>
                  <pre className="mt-2 text-[10px] text-zinc-600 overflow-auto max-h-40">
                    {JSON.stringify(call.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
