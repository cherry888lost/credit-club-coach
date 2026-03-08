import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Calendar, User, Flag, Hash } from "lucide-react";

interface CallDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CallDetailPage({ params }: CallDetailPageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  const { data: call, error } = await supabase
    .from("calls")
    .select("*, call_scores(*), reps!left(name)")
    .eq("id", id)
    .eq("org_id", orgId)
    .single();
  
  if (error || !call) {
    notFound();
  }
  
  // Check if call is flagged
  const { data: flags } = await supabase
    .from("flags")
    .select("*")
    .eq("call_id", id)
    .eq("org_id", orgId);
  
  const isFlagged = flags && flags.length > 0;
  const flagNote = flags?.[0]?.note;
  
  const scores = call.call_scores;
  const hasScores = scores && (scores.opening_score || scores.discovery_score || scores.rapport_score);
  
  const scoreCategories = hasScores ? [
    { name: "Opening", score: scores.opening_score },
    { name: "Discovery", score: scores.discovery_score },
    { name: "Rapport", score: scores.rapport_score },
    { name: "Objection Handling", score: scores.objection_handling_score },
    { name: "Closing", score: scores.closing_score },
    { name: "Structure", score: scores.structure_score },
    { name: "Product Knowledge", score: scores.product_knowledge_score },
  ] : [];
  
  const avgScore = scoreCategories.length > 0 && scoreCategories.some(s => s.score)
    ? (scoreCategories.filter(s => s.score).reduce((a, b) => a + (b.score || 0), 0) / scoreCategories.filter(s => s.score).length).toFixed(1)
    : null;
  
  // Parse strengths/improvements from JSON if needed
  const strengths = scores?.strengths 
    ? (typeof scores.strengths === 'string' ? JSON.parse(scores.strengths) : scores.strengths)
    : [];
  const improvements = scores?.improvements
    ? (typeof scores.improvements === 'string' ? JSON.parse(scores.improvements) : scores.improvements)
    : [];
  
  return (
    <div className="space-y-6">
      <Link href="/dashboard/calls" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />Back to calls
      </Link>
      
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">{call.title || "Untitled Call"}</h1>
            {isFlagged && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-full">
                <Flag className="w-3 h-3" />
                Flagged
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1"><User className="w-4 h-4" />{call.reps?.[0]?.name || "Unassigned"}</span>
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{call.created_at ? new Date(call.created_at).toLocaleString() : "Unknown date"}</span>
            {call.fathom_call_id && (
              <span className="flex items-center gap-1"><Hash className="w-4 h-4" />{call.fathom_call_id.slice(0, 12)}...</span>
            )}
          </div>          
          {flagNote && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400"><strong>Flag:</strong> {flagNote}</p>
            </div>
          )}
        </div>
        
        {avgScore ? (
          <div className="text-right">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-lg font-semibold ${parseFloat(avgScore) >= 8 ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" : parseFloat(avgScore) >= 6 ? "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
              {avgScore}
            </span>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Overall Score</p>
          </div>
        ) : (
          <div className="text-right">
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              Not scored
            </span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {call.recording_url ? (
            <div className="bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
              <video src={call.recording_url} controls className="w-full h-full">Your browser does not support the video tag.</video>
            </div>
          ) : (
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl aspect-video flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-4"><Play className="w-8 h-8 text-zinc-400" /></div>
              <p className="text-zinc-500 dark:text-zinc-400">No recording available</p>
            </div>
          )}
          
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Transcript</h3>
            {call.transcript ? (
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{call.transcript}</pre>
              </div>
            ) : (
              <p className="text-zinc-500 dark:text-zinc-400">No transcript available</p>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          {scoreCategories.length > 0 && scoreCategories.some(s => s.score) && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">Score Breakdown</h3>
              <div className="space-y-4">
                {scoreCategories.map((category) => (
                  <div key={category.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">{category.name}</span>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">{category.score || "-"}</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: category.score ? `${(category.score / 10) * 100}%` : "0%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {scores?.ai_summary && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-4">AI Summary</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{scores.ai_summary}</p>
            </div>
          )}
          
          {strengths.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-medium text-green-600 dark:text-green-400 mb-4">Strengths</h3>
              <ul className="space-y-2">
                {strengths.map((strength: string, i: number) => (
                  <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-green-500">+</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {improvements.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-medium text-amber-600 dark:text-amber-400 mb-4">Areas for Improvement</h3>
              <ul className="space-y-2">
                {improvements.map((improvement: string, i: number) => (
                  <li key={i} className="text-sm text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                    <span className="text-amber-500">↑</span>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {scores?.coaching_recommendation && (
            <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900 p-6">
              <h3 className="text-lg font-medium text-indigo-900 dark:text-indigo-300 mb-4">Coaching Recommendation</h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">{scores.coaching_recommendation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
