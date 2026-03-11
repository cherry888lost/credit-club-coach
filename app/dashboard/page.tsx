import { getCurrentUser, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import { 
  Phone, 
  Users, 
  Flag, 
  BarChart3, 
  ArrowRight,
  Trophy,
  AlertTriangle,
  Target,
  Hash,
  PieChart,
  MessageSquareWarning
} from "lucide-react";

export const dynamic = "force-dynamic";

function getMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  
  if (!user || !user.rep) {
    return null;
  }
  
  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  const weekStart = getMonday();
  
  // ── All-time queries (KPI cards) ──────────────────────────────
  
  const { data: allCalls, error: callsError } = await supabase
    .from("calls")
    .select("id, title, created_at, source, rep_id")
    .eq("org_id", orgId)
    .neq("source", "demo")
    .order("created_at", { ascending: false });
  
  if (callsError) {
    console.error("[Dashboard] Calls query error:", callsError);
  }
  
  const { data: repsData } = await supabase
    .from("reps")
    .select("id, name, email, role, sales_role");
  
  const repMap = new Map(repsData?.map(r => [r.id, r]) || []);
  
  const { data: allScoresData } = await supabase
    .from("call_scores")
    .select("call_id, overall_score");
  
  const scoreMap = new Map(allScoresData?.map(s => [s.call_id, s.overall_score]) || []);
  
  const { count: flaggedCount } = await supabase
    .from("flags")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  
  // Process all-time stats
  const calls = allCalls || [];
  const scoredCallsAll = calls.filter(c => scoreMap.has(c.id));
  const scoresAll = scoredCallsAll.map(c => scoreMap.get(c.id)).filter(Boolean) as number[];
  const avgScoreAll = scoresAll.length > 0 
    ? scoresAll.reduce((a, b) => a + b, 0) / scoresAll.length 
    : null;
  
  const closerCount = repsData?.filter(r => r.sales_role === "closer").length || 0;
  const sdrCount = repsData?.filter(r => r.sales_role === "sdr").length || 0;
  
  // ── This-week queries (At a Glance) ──────────────────────────
  
  // Get call IDs for this week
  const weekCallIds = calls
    .filter(c => c.created_at >= weekStart)
    .map(c => c.id);
  
  // Build a map of call_id -> rep_id for this week's calls
  const weekCallRepMap = new Map(
    calls.filter(c => c.created_at >= weekStart).map(c => [c.id, c.rep_id])
  );
  
  // Fetch scores + outcomes for this week's calls
  let weekScores: Array<{
    call_id: string;
    overall_score: number | null;
    outcome: string | null;
    manual_outcome: string | null;
    low_signal: boolean | null;
    weaknesses: string[] | null;
    objections_detected: string[] | null;
  }> = [];
  
  if (weekCallIds.length > 0) {
    const { data } = await supabase
      .from("call_scores")
      .select("call_id, overall_score, outcome, manual_outcome, low_signal, weaknesses, objections_detected")
      .in("call_id", weekCallIds);
    weekScores = data || [];
  }
  
  // Team Score This Week
  const weekScoresValues = weekScores
    .map(s => s.overall_score)
    .filter((v): v is number => v != null);
  const teamScoreWeek = weekScoresValues.length > 0
    ? weekScoresValues.reduce((a, b) => a + b, 0) / weekScoresValues.length
    : null;
  
  // Scored Calls count
  const scoredCallsWeek = weekScoresValues.length;
  
  // Outcome Breakdown
  let closedCount = 0;
  let followUpCount = 0;
  let noSaleCount = 0;
  
  for (const s of weekScores) {
    const outcome = s.manual_outcome || s.outcome;
    if (!outcome) continue;
    if (outcome === "closed") closedCount++;
    else if (outcome === "follow_up") followUpCount++;
    else if (outcome === "no_sale") noSaleCount++;
  }
  
  // Per-rep averages this week (min 3 calls)
  const repWeekScores: Record<string, { name: string; scores: number[] }> = {};
  
  for (const s of weekScores) {
    if (s.overall_score == null) continue;
    const repId = weekCallRepMap.get(s.call_id);
    if (!repId) continue;
    const rep = repMap.get(repId);
    if (!rep) continue;
    
    if (!repWeekScores[repId]) {
      repWeekScores[repId] = { name: rep.name, scores: [] };
    }
    repWeekScores[repId].scores.push(s.overall_score);
  }
  
  let topPerformer: { name: string; avg: number; count: number } | null = null;
  let needsReview: { name: string; avg: number; count: number } | null = null;
  
  for (const [, rep] of Object.entries(repWeekScores)) {
    if (rep.scores.length < 3) continue;
    const avg = rep.scores.reduce((a, b) => a + b, 0) / rep.scores.length;
    
    if (!topPerformer || avg > topPerformer.avg) {
      topPerformer = { name: rep.name, avg, count: rep.scores.length };
    }
    if (!needsReview || avg < needsReview.avg) {
      needsReview = { name: rep.name, avg, count: rep.scores.length };
    }
  }
  
  // If top and bottom are the same person, clear needsReview
  if (topPerformer && needsReview && topPerformer.name === needsReview.name) {
    needsReview = null;
  }
  
  // Common Objections - top 3
  const objectionCounts: Record<string, number> = {};
  for (const s of weekScores) {
    if (!s.objections_detected) continue;
    for (const obj of s.objections_detected) {
      const normalized = obj.trim().toLowerCase();
      if (normalized) {
        objectionCounts[normalized] = (objectionCounts[normalized] || 0) + 1;
      }
    }
  }
  
  const topObjections = Object.entries(objectionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([objection, count]) => ({ 
      objection: objection.charAt(0).toUpperCase() + objection.slice(1), 
      count 
    }));
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Overview</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Welcome back, {user.rep.name}
          </p>
        </div>
        <Link 
          href="/dashboard/calls"
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
        >
          View all calls
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Phone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          label="Total Calls"
          value={calls.length.toString()}
          href="/dashboard/calls"
        />
        <KpiCard
          icon={<BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          label="Avg Score"
          value={avgScoreAll?.toFixed(1) || "—"}
          valueColor={
            avgScoreAll != null && avgScoreAll >= 8 ? "text-green-700 dark:text-green-400" : 
            avgScoreAll != null && avgScoreAll < 7 ? "text-red-700 dark:text-red-400" : 
            undefined
          }
        />
        <KpiCard
          icon={<Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          label="Team"
          value={`${repsData?.length || 0}`}
          subtext={`${closerCount} closers · ${sdrCount} SDRs`}
          href="/dashboard/reps"
        />
        <KpiCard
          icon={<Flag className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          label="Flagged"
          value={(flaggedCount || 0).toString()}
          valueColor={flaggedCount && flaggedCount > 0 ? "text-red-700 dark:text-red-400" : undefined}
        />
      </div>
      
      {/* At a Glance */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
          At a Glance — This Week
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Team Score This Week */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Team Score
                </span>
              </div>
              {teamScoreWeek != null ? (
                <p className={`text-3xl font-bold ${
                  teamScoreWeek >= 8 ? "text-green-700 dark:text-green-400" :
                  teamScoreWeek < 7 ? "text-red-700 dark:text-red-400" :
                  "text-zinc-900 dark:text-white"
                }`}>
                  {teamScoreWeek.toFixed(1)}
                </p>
              ) : (
                <p className="text-3xl font-bold text-zinc-300 dark:text-zinc-600">—</p>
              )}
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                Average across all scored calls
              </p>
            </div>
            
            {/* Scored Calls */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-center gap-2 mb-3">
                <Hash className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Scored Calls
                </span>
              </div>
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                {scoredCallsWeek}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                {weekCallIds.length} total calls this week
              </p>
            </div>
            
            {/* Outcome Breakdown */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Outcome Breakdown
                </span>
              </div>
              <div className="space-y-3">
                <OutcomeRow label="Closed" count={closedCount} color="green" />
                <OutcomeRow label="Follow-up" count={followUpCount} color="amber" />
                <OutcomeRow label="No Sale" count={noSaleCount} color="red" />
              </div>
            </div>
          </div>
          
          {/* Right Column */}
          <div className="space-y-4">
            {/* Top Performer */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Top Performer
                </span>
              </div>
              {topPerformer ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{topPerformer.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {topPerformer.count} calls scored
                    </p>
                  </div>
                  <p className={`text-3xl font-bold ${
                    topPerformer.avg >= 8 ? "text-green-700 dark:text-green-400" :
                    topPerformer.avg < 7 ? "text-red-700 dark:text-red-400" :
                    "text-zinc-900 dark:text-white"
                  }`}>
                    {topPerformer.avg.toFixed(1)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Need at least 3 scored calls to rank
                </p>
              )}
            </div>
            
            {/* Needs Review */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Needs Review
                </span>
              </div>
              {needsReview ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-zinc-900 dark:text-white">{needsReview.name}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {needsReview.count} calls scored
                    </p>
                  </div>
                  <p className={`text-3xl font-bold ${
                    needsReview.avg < 7 ? "text-red-700 dark:text-red-400" :
                    "text-amber-700 dark:text-amber-400"
                  }`}>
                    {needsReview.avg.toFixed(1)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Need at least 2 reps with 3+ scored calls
                </p>
              )}
            </div>
            
            {/* Common Objections */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquareWarning className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Common Objections
                </span>
              </div>
              {topObjections.length > 0 ? (
                <div className="space-y-3">
                  {topObjections.map((obj, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate mr-3">
                        {obj.objection}
                      </span>
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shrink-0">
                        {obj.count}×
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No objections recorded this week
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable components ─────────────────────────────────────── */

function KpiCard({ 
  icon, 
  label, 
  value, 
  subtext,
  valueColor,
  href,
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
  subtext?: string;
  valueColor?: string;
  href?: string;
}) {
  const content = (
    <div className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow p-5 h-full ${href ? "cursor-pointer" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </span>
      </div>
      <p className={`text-3xl font-bold ${valueColor || "text-zinc-900 dark:text-white"}`}>
        {value}
      </p>
      {subtext && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{subtext}</p>
      )}
    </div>
  );
  
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

function OutcomeRow({ 
  label, 
  count, 
  color 
}: { 
  label: string; 
  count: number; 
  color: "green" | "amber" | "red" 
}) {
  const styles = {
    green: {
      bg: "bg-green-50 dark:bg-green-900/20",
      text: "text-green-700 dark:text-green-400",
      dot: "bg-green-500",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      text: "text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-900/20",
      text: "text-red-700 dark:text-red-400",
      dot: "bg-red-500",
    },
  };
  
  const s = styles[color];
  
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      </div>
      <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${s.bg} ${s.text}`}>
        {count}
      </span>
    </div>
  );
}
