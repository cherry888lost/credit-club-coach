import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CallWithScore } from "@/types";
import Link from "next/link";

export default async function CallsPage() {
  const user = await getCurrentUser();
  
  if (!user.isOnboarded) {
    return null;
  }
  
  const supabase = await createClient();
  const orgId = user.org?.id;
  
  // Fetch calls with scores and rep info
  const { data: calls, error } = await supabase
    .from("calls")
    .select("*, call_scores(*), reps(name)")
    .eq("org_id", orgId)
    .order("occurred_at", { ascending: false });
  
  if (error) {
    console.error("Error fetching calls:", error);
  }
  
  // Calculate average score for each call
  const callsWithAvgScore = (calls || []).map((call: CallWithScore) => {
    const scores = call.call_scores;
    let avgScore = null;
    
    if (scores) {
      const allScores = [
        scores.opening_score,
        scores.discovery_score,
        scores.rapport_score,
        scores.objection_handling_score,
        scores.closing_score,
        scores.structure_score,
        scores.product_knowledge_score
      ].filter(Boolean) as number[];
      
      if (allScores.length > 0) {
        avgScore = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
      }
    }
    
    return { ...call, avgScore };
  });
  
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
            Calls
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            View and analyze all recorded calls
          </p>
        </div>
      </div>

      {/* Filters placeholder */}
      <div className="flex flex-wrap gap-3">
        <div className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-600 dark:text-zinc-400">
          Filter by Rep
        </div>
        <div className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-600 dark:text-zinc-400">
          Date Range
        </div>
        <div className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-600 dark:text-zinc-400">
          Score Range
        </div>
      </div>

      {/* Calls list */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">
            All Calls ({calls?.length || 0})
          </h2>
        </div>
        
        {callsWithAvgScore.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {callsWithAvgScore.map((call) => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-white truncate">
                    {call.title || "Untitled Call"}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {call.reps?.name || "Unknown"}
                    {" "}•{" "}
                    {call.occurred_at 
                      ? new Date(call.occurred_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })
                      : "Unknown date"
                    }
                  </p>
                </div>
                
                <div className="flex items-center gap-4">
                  {call.avgScore ? (
                    <div className="text-right">
                      <span className={`
                        inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium
                        ${parseFloat(call.avgScore) >= 8 
                          ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          : parseFloat(call.avgScore) >= 6
                          ? "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        }
                      `}>
                        {call.avgScore}
                      </span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Avg Score
                      </p>
                    </div>
                  ) : (
                    <span className="text-sm text-zinc-400 dark:text-zinc-500">
                      No score
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              No calls yet. Calls will appear here once Fathom integration is connected.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
