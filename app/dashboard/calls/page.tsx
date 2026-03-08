import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Phone, Calendar, User, Flag } from "lucide-react";
import SendTestWebhookButton from "./_components/SendTestWebhookButton";

export const dynamic = "force-dynamic";

interface CallWithData {
  id: string;
  title: string | null;
  created_at: string;
  rep_id: string | null;
  reps: { name: string }[] | null;
  call_scores: {
    opening_score: number | null;
    discovery_score: number | null;
    rapport_score: number | null;
    objection_handling_score: number | null;
    closing_score: number | null;
    structure_score: number | null;
    product_knowledge_score: number | null;
  } | null;
  has_flag: boolean;
}

export default async function CallsPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  // Get calls with reps and scores
  const { data: calls } = await supabase
    .from("calls")
    .select(`
      id, title, created_at, rep_id,
      reps!left(name),
      call_scores(opening_score, discovery_score, rapport_score, objection_handling_score, closing_score, structure_score, product_knowledge_score)
    `)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  
  // Get flagged call IDs
  const { data: flags } = await supabase
    .from("flags")
    .select("call_id")
    .eq("org_id", orgId);
  
  const flaggedIds = new Set(flags?.map(f => f.call_id) || []);
  
  // Process calls with calculated scores
  const processedCalls = (calls || []).map((call: any): CallWithData => {
    const scores = call.call_scores;
    const scoreValues = scores ? [
      scores.opening_score, scores.discovery_score, scores.rapport_score,
      scores.objection_handling_score, scores.closing_score, scores.structure_score, scores.product_knowledge_score,
    ].filter((s: number | null): s is number => s !== null && s !== undefined) : [];
    
    const avgScore = scoreValues.length > 0
      ? scoreValues.reduce((a: number, b: number) => a + b, 0) / scoreValues.length
      : null;
    
    return {
      ...call,
      avgScore,
      has_flag: flaggedIds.has(call.id),
    };
  });
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Calls</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{processedCalls.length} total calls</p>
        </div>
        <SendTestWebhookButton />
      </div>
      
      {processedCalls.length > 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {processedCalls.map((call) => (
              <Link 
                key={call.id} 
                href={`/dashboard/calls/${call.id}`}
                className="block p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-zinc-900 dark:text-white truncate">
                        {call.title || "Untitled Call"}
                      </h3>
                      {call.has_flag && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium rounded-full">
                          <Flag className="w-3 h-3" />
                          Flagged
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {call.reps?.[0]?.name || "Unassigned"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(call.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {(call as any).avgScore !== null && (call as any).avgScore !== undefined ? (
                      <div className="text-right">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold ${
                          (call as any).avgScore >= 8 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : (call as any).avgScore < 7 
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}>
                          {(call as any).avgScore.toFixed(1)}
                        </span>
                        <p className="text-xs text-zinc-400 mt-0.5">Avg Score</p>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-400 dark:text-zinc-500 px-2">Not scored</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-4">
            <Phone className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">No calls yet</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Send a test webhook to create your first demo call.</p>
        </div>
      )}
    </div>
  );
}
