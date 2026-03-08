import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Phone, Users, Flag, BarChart3, Plus } from "lucide-react";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createClient();
  const orgId = await getDefaultOrgId();
  
  // Fetch stats
  const [
    { count: callsCount },
    { count: repsCount },
    { count: flaggedCount },
    { data: recentCalls }
  ] = await Promise.all([
    supabase.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("reps").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("flags").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase
      .from("calls")
      .select("*, call_scores(*), reps!left(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5)
  ]);
  
  // Calculate average score
  const { data: scores } = await supabase
    .from("call_scores")
    .select("opening_score, discovery_score, rapport_score, objection_handling_score, closing_score, structure_score, product_knowledge_score")
    .in("call_id", recentCalls?.map(c => c.id) || []);
  
  let avgScore = "-";
  if (scores && scores.length > 0) {
    const allScores = scores.flatMap(s => [
      s.opening_score, s.discovery_score, s.rapport_score,
      s.objection_handling_score, s.closing_score, s.structure_score, s.product_knowledge_score
    ].filter(Boolean) as number[]);
    
    if (allScores.length > 0) {
      avgScore = (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1);
    }
  }
  
  const hasData = (callsCount || 0) > 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Overview</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Welcome back, {user.rep.name}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<Phone className="w-5 h-5" />} 
          title="Total Calls" 
          value={callsCount?.toString() || "0"} 
          description="All time calls analyzed" 
        />
        <StatCard 
          icon={<BarChart3 className="w-5 h-5" />} 
          title="Avg Score" 
          value={avgScore} 
          description="Average call quality score" 
        />
        <StatCard 
          icon={<Users className="w-5 h-5" />} 
          title="Team Members" 
          value={repsCount?.toString() || "0"} 
          description="Active reps" 
        />
        <StatCard 
          icon={<Flag className="w-5 h-5" />} 
          title="Flagged Calls" 
          value={flaggedCount?.toString() || "0"} 
          description="Calls needing review" 
        />
      </div>

      {/* Recent Calls Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Recent Calls</h2>
          {hasData && <Link href="/dashboard/calls" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">View all</Link>}
        </div>
        
        {recentCalls && recentCalls.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {recentCalls.map((call) => (
              <Link key={call.id} href={`/dashboard/calls/${call.id}`} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900 dark:text-white">{call.title || "Untitled Call"}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{call.reps?.[0]?.name || "Unknown"} • {call.occurred_at ? new Date(call.occurred_at).toLocaleDateString() : "Unknown date"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {call.call_scores && (
                    <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-sm font-medium rounded">
                      {(([call.call_scores.opening_score, call.call_scores.discovery_score, call.call_scores.rapport_score, call.call_scores.objection_handling_score, call.call_scores.closing_score, call.call_scores.structure_score, call.call_scores.product_knowledge_score].filter(Boolean) as number[]).reduce((a, b) => a + b, 0) / 7).toFixed(1)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState 
            icon={<Phone className="w-12 h-12" />}
            title="No calls yet"
            description="Calls will appear here once you connect Fathom or send a test webhook."
            action={
              <Link href="/dashboard/settings" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" />
                Connect Fathom
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, description }: { icon: React.ReactNode; title: string; value: string; description: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
          {icon}
        </div>
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
      </div>
      <p className="text-3xl font-semibold text-zinc-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{description}</p>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-6">{description}</p>
      {action}
    </div>
  );
}
