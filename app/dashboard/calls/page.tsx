import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { CallWithScoreAndRep } from "@/types";
import Link from "next/link";
import { Phone } from "lucide-react";
import SendTestWebhookButton from "./_components/SendTestWebhookButton";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  const { data: calls, error } = await supabase
    .from("calls")
    .select("*, call_scores(*), reps!left(name)")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  
  if (error) {
    console.error("[CallsPage] Error:", error);
  }
  
  const callsWithAvgScore = (calls || []).map((call: CallWithScoreAndRep) => {
    const scores = call.call_scores;
    let avgScore = null;
    
    if (scores) {
      const allScores = [
        scores.opening_score, scores.discovery_score, scores.rapport_score,
        scores.objection_handling_score, scores.closing_score, scores.structure_score, scores.product_knowledge_score
      ].filter(Boolean) as number[];
      
      if (allScores.length > 0) {
        avgScore = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
      }
    }
    
    return { ...call, avgScore };
  });
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Calls</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {callsWithAvgScore.length} total calls
          </p>
        </div>
        <SendTestWebhookButton />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        {callsWithAvgScore.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {callsWithAvgScore.map((call) => (
              <Link key={call.id} href={`/dashboard/calls/${call.id}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">{call.title || "Untitled Call"}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {call.reps?.[0]?.name || "Unassigned"} • {call.created_at ? new Date(call.created_at).toLocaleString() : "Unknown"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {call.avgScore ? (
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium ${parseFloat(call.avgScore) >= 8 ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" : parseFloat(call.avgScore) >= 6 ? "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                        {call.avgScore}
                      </span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Avg Score</p>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-400 dark:text-zinc-500">Not scored</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-4">
              <Phone className="w-12 h-12" />
            </div>
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">No calls found</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              Click &quot;Send Test Webhook&quot; to create a test call.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
