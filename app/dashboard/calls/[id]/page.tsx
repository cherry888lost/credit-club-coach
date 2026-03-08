import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, User, Calendar, Hash, Flag, CheckCircle, AlertCircle } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CallDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  // Fetch call with all related data
  const { data: call } = await supabase
    .from("calls")
    .select(`
      *,
      reps!left(id, name),
      call_scores(*)
    `)
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  
  if (!call) {
    notFound();
  }
  
  // Check if flagged
  const { data: flag } = await supabase
    .from("flags")
    .select("note")
    .eq("call_id", id)
    .eq("org_id", orgId)
    .single();
  
  const isFlagged = !!flag;
  const repName = call.reps?.[0]?.name || "Unassigned";
  
  // Calculate score
  const scores = call.call_scores;
  const scoreValues = scores ? [
    scores.opening_score, scores.discovery_score, scores.rapport_score,
    scores.objection_handling_score, scores.closing_score, scores.structure_score, scores.product_knowledge_score,
  ].filter((s): s is number => s !== null && s !== undefined) : [];
  
  const avgScore = scoreValues.length > 0
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
    : null;
  
  const isScored = avgScore !== null;
  
  // Parse strengths/improvements
  const strengths = scores?.strengths 
    ? (typeof scores.strengths === 'string' ? JSON.parse(scores.strengths) : scores.strengths)
    : [];
  const improvements = scores?.improvements
    ? (typeof scores.improvements === 'string' ? JSON.parse(scores.improvements) : scores.improvements)
    : [];
  
  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link 
        href="/dashboard/calls"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to calls
      </Link>
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {call.title || "Untitled Call"}
            </h1>
            <StatusBadge isScored={isScored} isFlagged={isFlagged} />
          </div>
          
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{repName}</span>
            </span>
            
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(call.created_at).toLocaleString()}
            </span>
            
            {call.fathom_call_id && (
              <span className="flex items-center gap-1.5 font-mono text-xs">
                <Hash className="w-4 h-4" />
                {call.fathom_call_id}
              </span>
            )}
          </div>        
          
          {isFlagged && flag.note && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <Flag className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-red-700 dark:text-red-300">{flag.note}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {avgScore !== null ? (
            <div className="text-center">
              <div className={`text-5xl font-bold ${
                avgScore >= 8 ? "text-green-600 dark:text-green-400" : 
                avgScore < 7 ? "text-red-600 dark:text-red-400" : 
                "text-zinc-900 dark:text-white"
              }`}>
                {avgScore.toFixed(1)}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Overall Score</p>
            </div>
          ) : (
            <div className="text-center px-6">
              <div className="text-3xl font-bold text-zinc-400 dark:text-zinc-600">-</div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Not scored</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Recording */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {call.recording_url ? (
              <video 
                src={call.recording_url} 
                controls 
                className="w-full aspect-video"
              >
                Your browser does not support video.
              </video>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-3">
                  <Play className="w-8 h-8 text-zinc-400" />
                </div>
                <p className="text-zinc-500 dark:text-zinc-400">No recording available</p>
              </div>
            )}
          </div>
          
          {/* Transcript */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Transcript</h3>
            {call.transcript ? (
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {call.transcript}
              </pre>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">No transcript available</p>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Score Breakdown */}
          {scores && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Score Breakdown</h3>
              <div className="space-y-3">
                {[
                  { name: "Opening", score: scores.opening_score },
                  { name: "Discovery", score: scores.discovery_score },
                  { name: "Rapport", score: scores.rapport_score },
                  { name: "Objection Handling", score: scores.objection_handling_score },
                  { name: "Closing", score: scores.closing_score },
                  { name: "Structure", score: scores.structure_score },
                  { name: "Product Knowledge", score: scores.product_knowledge_score },
                ].map(({ name, score }) => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">{name}</span>
                      <span className="text-sm font-medium">{score ?? "-"}</span>
                    </div>
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-600 rounded-full" 
                        style={{ width: score ? `${(score / 10) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* AI Summary */}
          {scores?.ai_summary && (
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900 p-6">
              <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300 mb-3">AI Summary</h3>
              <p className="text-sm text-indigo-800 dark:text-indigo-400 leading-relaxed">{scores.ai_summary}</p>
            </div>
          )}
          
          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-900 p-6">
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Strengths
              </h3>
              <ul className="space-y-2">
                {strengths.map((s: string, i: number) => (
                  <li key={i} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                    <span className="text-green-600">+</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Improvements */}
          {improvements.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900 p-6">
              <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Areas for Improvement
              </h3>
              <ul className="space-y-2">
                {improvements.map((imp: string, i: number) => (
                  <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <span className="text-amber-600">↑</span>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ isScored, isFlagged }: { isScored: boolean; isFlagged: boolean }) {
  if (isFlagged) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold rounded-full">
        <Flag className="w-3 h-3" />
        Flagged
      </span>
    );
  }
  
  if (isScored) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
        <CheckCircle className="w-3 h-3" />
        Scored
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-semibold rounded-full">
      <AlertCircle className="w-3 h-3" />
      Not Scored
    </span>
  );
}
