import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Phone, Users, Flag, BarChart3, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  // Fetch key metrics
  const [
    { count: callsCount },
    { count: repsCount },
    { count: flaggedCount },
    { data: recentCalls },
  ] = await Promise.all([
    supabase.from("calls").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("reps").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("flags").select("*", { count: "exact", head: true }).eq("org_id", orgId),
    supabase
      .from("calls")
      .select(`
        id, title, created_at, rep_id,
        reps!left(name),
        call_scores(opening_score, discovery_score, rapport_score, objection_handling_score, closing_score, structure_score, product_knowledge_score)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  
  // Calculate average score from recent calls
  let totalScore = 0;
  let scoredCount = 0;
  
  recentCalls?.forEach((call: any) => {
    const scores = call.call_scores;
    if (scores) {
      const values = [
        scores.opening_score, scores.discovery_score, scores.rapport_score,
        scores.objection_handling_score, scores.closing_score, scores.structure_score, scores.product_knowledge_score,
      ].filter((s: number | null): s is number => s !== null && s !== undefined);
      
      if (values.length > 0) {
        totalScore += values.reduce((a: number, b: number) => a + b, 0) / values.length;
        scoredCount++;
      }
    }
  });
  
  const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : "-";
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Overview</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Welcome back, {user.rep.name}</p>
        </div>
        <Link 
          href="/dashboard/calls" 
          className="flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          View all calls
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Phone className="w-5 h-5" />}
          label="Total Calls"
          value={callsCount?.toString() || "0"}
          href="/dashboard/calls"
        />
        <KpiCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Avg Score"
          value={avgScore}
          color={avgScore !== "-" && parseFloat(avgScore) >= 8 ? "green" : avgScore !== "-" && parseFloat(avgScore) < 7 ? "red" : "default"}
        />
        <KpiCard
          icon={<Users className="w-5 h-5" />}
          label="Team Members"
          value={repsCount?.toString() || "0"}
          href="/dashboard/reps"
        />
        <KpiCard
          icon={<Flag className="w-5 h-5" />}
          label="Flagged"
          value={flaggedCount?.toString() || "0"}
          color={flaggedCount && flaggedCount > 0 ? "red" : "default"}
        />
      </div>
      
      {/* Recent Calls */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Recent Calls</h2>
        </div>
        
        {recentCalls && recentCalls.length > 0 ? (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {recentCalls.map((call: any) => {
              const scores = call.call_scores;
              const scoreValues = scores ? [
                scores.opening_score, scores.discovery_score, scores.rapport_score,
                scores.objection_handling_score, scores.closing_score, scores.structure_score, scores.product_knowledge_score,
              ].filter((s: number | null): s is number => s !== null) : [];
              
              const callAvg = scoreValues.length > 0
                ? (scoreValues.reduce((a: number, b: number) => a + b, 0) / scoreValues.length).toFixed(1)
                : null;
              
              return (
                <Link 
                  key={call.id}
                  href={`/dashboard/calls/${call.id}`}
                  className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">
                      {call.title || "Untitled Call"}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {call.reps?.[0]?.name || "Unassigned"} • {new Date(call.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {callAvg ? (
                      <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${
                        parseFloat(callAvg) >= 8 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : parseFloat(callAvg) < 7
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }`}>
                        {callAvg}
                      </span>
                    ) : (
                      <span className="text-sm text-zinc-400">Not scored</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">No calls yet. Send a test webhook to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ 
  icon, 
  label, 
  value, 
  color = "default",
  href,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  color?: "green" | "red" | "default";
  href?: string;
}) {
  const colorClasses = {
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    default: "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
  };
  
  const content = (
    <div className={`p-5 rounded-xl border ${colorClasses[color]} ${href ? "hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors" : ""}`}>
      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-3xl font-bold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
  
  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  
  return content;
}
