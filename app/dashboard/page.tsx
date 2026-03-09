import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { 
  Phone, 
  Users, 
  Flag, 
  BarChart3, 
  ArrowRight,
  TrendingUp,
  Trophy
} from "lucide-react";

export const dynamic = "force-dynamic";

interface DashboardStats {
  totalCalls: number;
  avgScore: number | null;
  activeReps: number;
  totalReps: number;
  closerCount: number;
  sdrCount: number;
  flaggedCalls: number;
  topRep: { name: string; avgScore: number } | null;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  
  // Fetch all stats in parallel
  const [
    callsResult,
    repsResult,
    flaggedResult,
    recentCallsResult,
  ] = await Promise.all([
    // All calls with scores
    supabase
      .from("calls")
      .select(`
        id,
        call_scores(overall_score),
        reps!left(name, role)
      `)
      .eq("org_id", orgId),
    
    // All active reps
    supabase
      .from("reps")
      .select("id, name, role, call:calls(count)")
      .eq("org_id", orgId)
      .eq("status", "active"),
    
    // Flagged calls count
    supabase
      .from("flags")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
    
    // Recent calls
    supabase
      .from("calls")
      .select(`
        id, title, created_at,
        reps!left(name, role),
        call_scores(overall_score)
      `)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  
  // Calculate stats
  const calls = callsResult.data || [];
  const reps = repsResult.data || [];
  
  // Score calculations
  const scores: number[] = [];
  calls.forEach((call: any) => {
    if (call.call_scores?.overall_score) {
      scores.push(call.call_scores.overall_score);
    }
  });
  
  const avgScore = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : null;
  
  // Rep stats for leaderboard
  const repScores: Record<string, { name: string; scores: number[] }> = {};
  
  calls.forEach((call: any) => {
    const repId = call.reps?.id;
    const repName = call.reps?.name;
    const score = call.call_scores?.overall_score;
    
    if (repId && repName && score) {
      if (!repScores[repId]) {
        repScores[repId] = { name: repName, scores: [] };
      }
      repScores[repId].scores.push(score);
    }
  });
  
  // Find top rep
  let topRep: { name: string; avgScore: number } | null = null;
  
  Object.values(repScores).forEach((rep: any) => {
    if (rep.scores.length > 0) {
      const repAvg = rep.scores.reduce((a: number, b: number) => a + b, 0) / rep.scores.length;
      if (!topRep || repAvg > topRep.avgScore) {
        topRep = { name: rep.name, avgScore: repAvg };
      }
    }
  });
  
  // Count by role
  const closerCount = reps.filter((r: any) => r.role === "closer").length;
  const sdrCount = reps.filter((r: any) => r.role === "sdr").length;
  
  const stats: DashboardStats = {
    totalCalls: calls.length,
    avgScore,
    activeReps: reps.length,
    totalReps: reps.length,
    closerCount,
    sdrCount,
    flaggedCalls: flaggedResult.count || 0,
    topRep,
  };
  
  const recentCalls = recentCallsResult.data || [];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-zinc-400 mt-1">Welcome back, {user.rep.name}</p>
        </div>
        <Link 
          href="/dashboard/calls"
          className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View all calls
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Phone className="w-5 h-5" />}
          label="Total Calls"
          value={stats.totalCalls.toString()}
          href="/dashboard/calls"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Avg Score"
          value={stats.avgScore?.toFixed(1) || "-"}
          color={stats.avgScore && stats.avgScore >= 8 ? "green" : stats.avgScore && stats.avgScore < 7 ? "red" : "default"}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Team"
          value={`${stats.activeReps}`}
          subtext={`${stats.closerCount} closers, ${stats.sdrCount} SDRs`}
          href="/dashboard/team"
        />
        <StatCard
          icon={<Flag className="w-5 h-5" />}
          label="Flagged"
          value={stats.flaggedCalls.toString()}
          color={stats.flaggedCalls > 0 ? "red" : "default"}
        />
      </div>
      
      {/* Role Split & Top Rep */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Team Composition</h3>
          </div>          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Closers</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: `${stats.activeReps > 0 ? (stats.closerCount / stats.activeReps) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-white font-medium w-8">{stats.closerCount}</span>
              </div>
            </div>            
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">SDRs</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full" 
                    style={{ width: `${stats.activeReps > 0 ? (stats.sdrCount / stats.activeReps) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-white font-medium w-8">{stats.sdrCount}</span>
              </div>
            </div>
          </div>
        </div>        
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h3 className="font-semibold text-white">Top Performer</h3>
          </div>          
          {stats.topRep ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xl font-bold text-white">{stats.topRep.name}</p>
                <p className="text-zinc-400 text-sm">Highest average score</p>
              </div>
              <div className={`text-3xl font-bold ${
                stats.topRep.avgScore >= 8 ? "text-green-400" : 
                stats.topRep.avgScore < 7 ? "text-red-400" : "text-white"
              }`}>
                {stats.topRep.avgScore.toFixed(1)}
              </div>
            </div>
          ) : (
            <p className="text-zinc-500">No scored calls yet</p>
          )}
        </div>
      </div>
      
      {/* Recent Calls */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="font-semibold text-white">Recent Calls</h2>
        </div>        
        {recentCalls.length > 0 ? (
          <div className="divide-y divide-zinc-800">
            {recentCalls.map((call: any) => {
              const score = call.call_scores?.overall_score;
              const repRole = call.reps?.role;
              
              return (
                <Link 
                  key={call.id}
                  href={`/dashboard/calls/${call.id}`}
                  className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white truncate">{call.title || "Untitled Call"}</p>
                      {repRole && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          repRole === 'closer' ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"
                        }`}>
                          {repRole.toUpperCase()}
                        </span>
                      )}
                    </div>                    
                    <p className="text-sm text-zinc-500">
                      {call.reps?.name || "Unassigned"} • {new Date(call.created_at).toLocaleDateString()}
                    </p>
                  </div>                  
                  <div>
                    {score ? (
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                        score >= 8 ? "bg-green-500/20 text-green-400" : 
                        score < 7 ? "bg-red-500/20 text-red-400" : 
                        "bg-zinc-800 text-zinc-300"
                      }`}>
                        {score.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-sm">Not scored</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <TrendingUp className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-500">No calls yet. Send a test webhook to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  subtext,
  color = "default",
  href,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  subtext?: string;
  color?: "green" | "red" | "default";
  href?: string;
}) {
  const colors = {
    green: "bg-green-500/10 border-green-500/20",
    red: "bg-red-500/10 border-red-500/20",
    default: "bg-zinc-900 border-zinc-800",
  };
  
  const content = (
    <div className={`p-5 rounded-xl border ${colors[color]} ${href ? "hover:border-zinc-700 transition-colors cursor-pointer" : ""}`}>
      <div className="flex items-center gap-2 text-zinc-400 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>      
      <p className="text-3xl font-bold text-white">{value}</p>      
      {subtext && <p className="text-xs text-zinc-500 mt-1">{subtext}</p>}
    </div>
  );
  
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
