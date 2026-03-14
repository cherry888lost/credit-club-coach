import { getCurrentUserWithRole, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CloseTypeBadge } from "@/components/ui/CloseTypeBadge";
import {
  ArrowLeft,
  User,
  Trophy,
  TrendingUp,
  TrendingDown,
  Phone,
  CalendarDays,
  Target,
  CheckCircle,
  AlertCircle,
  Zap,
  BarChart3,
  ChevronRight,
  Award,
  Brain,
  Lightbulb,
  Crosshair,
  Activity,
} from "lucide-react";
import { ScoreTrendChart, CloseTypePieChart } from "../_components/RepCharts";
import { GradeBadge } from "@/components/ui/GradeBadge";

export const dynamic = "force-dynamic";

function getGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D+";
  if (score >= 45) return "D";
  if (score >= 40) return "D-";
  return "F";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-green-600 dark:text-green-400";
  if (grade.startsWith("B")) return "text-blue-600 dark:text-blue-400";
  if (grade.startsWith("C")) return "text-amber-600 dark:text-amber-400";
  if (grade.startsWith("D")) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function gradeBg(grade: string): string {
  if (grade.startsWith("A")) return "bg-green-100 dark:bg-green-900/30";
  if (grade.startsWith("B")) return "bg-blue-100 dark:bg-blue-900/30";
  if (grade.startsWith("C")) return "bg-amber-100 dark:bg-amber-900/30";
  if (grade.startsWith("D")) return "bg-orange-100 dark:bg-orange-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function roleBadgeStyle(role: string | null): string {
  const styles: Record<string, string> = {
    closer: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    sdr: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
    admin: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  };
  return styles[role || ""] || styles.admin;
}

export default async function RepDetailPage({ params }: { params: { name: string } }) {
  const { name } = await Promise.resolve(params);
  const repName = decodeURIComponent(name);

  const user = await getCurrentUserWithRole();
  if (!user || !user.rep) return null;

  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();

  // Find rep by name
  const { data: rep } = await supabase
    .from("reps")
    .select("*")
    .eq("org_id", orgId)
    .eq("name", repName)
    .single();

  if (!rep) notFound();

  // Non-admins can only view their own rep page
  if (!user.isAdminUser && rep.id !== user.rep.id) {
    notFound();
  }

  // Get all calls for this rep with scores
  const { data: rawCalls } = await supabase
    .from("calls")
    .select(`*, call_scores(*)`)
    .eq("rep_id", rep.id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const calls = rawCalls || [];

  // Process calls and scores
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  let totalScore = 0;
  let scoredCount = 0;
  let closedCount = 0;
  let followUpCount = 0;
  let noSaleCount = 0;
  let thisMonthCalls = 0;
  let thisWeekCalls = 0;
  let lastMonthScores: number[] = [];
  let thisMonthScores: number[] = [];

  // For aggregating strengths/weaknesses
  const strengthCounts: Record<string, number> = {};
  const weaknessCounts: Record<string, number> = {};

  // Technique score aggregation
  let totalValueStacking = 0;
  let valueStackingCount = 0;
  let totalUrgency = 0;
  let urgencyCount = 0;

  // Score breakdown aggregation
  const breakdownTotals: Record<string, { sum: number; count: number }> = {};

  const scoredCalls: Array<{
    id: string;
    title: string;
    created_at: string;
    overall_score: number;
    close_type: string | null;
    close_outcome: string | null;
    grade: string | null;
    outcome: string | null;
  }> = [];

  for (const call of calls) {
    const callDate = new Date(call.created_at);
    if (callDate >= thisMonthStart) thisMonthCalls++;
    if (callDate >= weekStart) thisWeekCalls++;

    const scores = Array.isArray(call.call_scores) ? call.call_scores[0] : call.call_scores;
    const effectiveScore = scores?.overall_score ?? scores?.score_total;
    if (!scores || effectiveScore == null) continue;

    totalScore += effectiveScore;
    scoredCount++;

    const outcome = scores.close_outcome;
    if (outcome === "closed") closedCount++;
    else if (outcome === "follow_up") followUpCount++;
    else if (outcome === "no_sale") noSaleCount++;

    // Monthly breakdown
    if (callDate >= thisMonthStart) {
      thisMonthScores.push(effectiveScore);
    } else if (callDate >= lastMonthStart && callDate < thisMonthStart) {
      lastMonthScores.push(effectiveScore);
    }

    // Aggregate strengths
    for (const s of scores.strengths || []) {
      strengthCounts[s] = (strengthCounts[s] || 0) + 1;
    }

    // Aggregate weaknesses
    for (const w of scores.weaknesses || []) {
      weaknessCounts[w] = (weaknessCounts[w] || 0) + 1;
    }

    // Technique scores
    if (scores.value_stacking_score != null) {
      totalValueStacking += scores.value_stacking_score;
      valueStackingCount++;
    }
    if (scores.urgency_score != null) {
      totalUrgency += scores.urgency_score;
      urgencyCount++;
    }

    // Score breakdown
    if (scores.score_breakdown) {
      const bd = scores.score_breakdown as Record<string, number>;
      for (const [key, val] of Object.entries(bd)) {
        if (key === "total" || key === "grade" || typeof val !== "number") continue;
        if (!breakdownTotals[key]) breakdownTotals[key] = { sum: 0, count: 0 };
        breakdownTotals[key].sum += val;
        breakdownTotals[key].count++;
      }
    }

    scoredCalls.push({
      id: call.id,
      title: call.title || "Untitled Call",
      created_at: call.created_at,
      overall_score: effectiveScore,
      close_type: scores.close_type || null,
      close_outcome: scores.close_outcome || null,
      grade: scores.score_grade || scores.grade || null,
      outcome,
    });
  }

  const avgScore = scoredCount > 0 ? Math.round(totalScore / scoredCount) : null;
  const avgGrade = avgScore != null ? getGrade(avgScore) : null;
  const closeRate = scoredCount > 0 ? Math.round((closedCount / scoredCount) * 100) : null;

  // Trend calculation
  const thisMonthAvg = thisMonthScores.length > 0
    ? thisMonthScores.reduce((a, b) => a + b, 0) / thisMonthScores.length
    : null;
  const lastMonthAvg = lastMonthScores.length > 0
    ? lastMonthScores.reduce((a, b) => a + b, 0) / lastMonthScores.length
    : null;
  const scoreTrend = thisMonthAvg != null && lastMonthAvg != null
    ? Math.round(thisMonthAvg - lastMonthAvg)
    : null;

  // Top strengths and weaknesses (sorted by frequency)
  const topStrengths = Object.entries(strengthCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const topWeaknesses = Object.entries(weaknessCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Average technique scores
  const avgValueStacking = valueStackingCount > 0 ? Math.round(totalValueStacking / valueStackingCount) : null;
  const avgUrgency = urgencyCount > 0 ? Math.round(totalUrgency / urgencyCount) : null;

  // Score breakdown config
  const BREAKDOWN_CONFIG: Record<string, { label: string; max: number }> = {
    close_quality: { label: "Close Quality", max: 25 },
    objection_handling: { label: "Objection Handling", max: 20 },
    value_stacking: { label: "Value Stacking", max: 20 },
    urgency_usage: { label: "Urgency Usage", max: 15 },
    discovery_rapport: { label: "Discovery & Rapport", max: 10 },
    professionalism: { label: "Professionalism", max: 10 },
  };

  // Recent calls (limit 20)
  const recentCalls = scoredCalls.slice(0, 20);

  // ── Score Trend Data (last 30 days) ──
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const scoreTrendData = scoredCalls
    .filter((c) => new Date(c.created_at) >= thirtyDaysAgo)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((c) => ({
      date: c.created_at.slice(0, 10),
      score: c.overall_score,
    }));

  // ── Close Type Distribution ──
  const closeTypeCounts: Record<string, number> = {
    full: 0,
    payment_plan: 0,
    partial_access: 0,
    deposit: 0,
    none: 0,
  };
  for (const c of scoredCalls) {
    const ct = c.close_type || "none";
    if (ct in closeTypeCounts) closeTypeCounts[ct]++;
    else closeTypeCounts[ct] = (closeTypeCounts[ct] || 0) + 1;
  }
  const closeTypeColors: Record<string, string> = {
    full: "#22c55e",
    payment_plan: "#3b82f6",
    partial_access: "#a855f7",
    deposit: "#f59e0b",
    none: "#71717a",
  };
  const closeTypeLabels: Record<string, string> = {
    full: "Full Close",
    payment_plan: "Payment Plan",
    partial_access: "Partial Access",
    deposit: "Deposit",
    none: "No Close",
  };
  const closeTypeData = Object.entries(closeTypeCounts).map(([key, value]) => ({
    name: closeTypeLabels[key] || key,
    value,
    color: closeTypeColors[key] || "#71717a",
  }));

  // ── AI Insights (server-computed) ──
  const breakdownEntries = Object.entries(breakdownTotals)
    .filter(([k]) => BREAKDOWN_CONFIG[k])
    .map(([key, { sum, count }]) => {
      const config = BREAKDOWN_CONFIG[key];
      const pct = Math.round((sum / count / config.max) * 100);
      return { key, label: config.label, pct };
    })
    .sort((a, b) => b.pct - a.pct);

  const strongestArea = breakdownEntries.length > 0 ? breakdownEntries[0] : null;
  const weakestArea = breakdownEntries.length > 0 ? breakdownEntries[breakdownEntries.length - 1] : null;
  const trendSummary = scoreTrend != null
    ? scoreTrend > 2
      ? "Improving"
      : scoreTrend < -2
        ? "Declining"
        : "Consistent"
    : null;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/dashboard/reps"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to team
      </Link>

      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <span className="text-indigo-700 dark:text-indigo-400 font-bold text-2xl">
            {rep.name
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()}
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{rep.name}</h1>
            {rep.sales_role && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${roleBadgeStyle(rep.sales_role)}`}>
                {rep.sales_role.toUpperCase()}
              </span>
            )}
            {rep.status && (
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  rep.status === "active"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {rep.status}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{rep.email}</p>
        </div>

        {/* Big Score */}
        {avgScore != null && avgGrade && (
          <div className="text-center p-6 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 min-w-[140px]">
            <div className={`text-5xl font-bold ${scoreColor(avgScore)}`}>
              {avgScore}
            </div>
            <p className="text-sm text-zinc-500 mt-1">avg score</p>
            <p className={`text-xl font-bold mt-1 ${gradeColor(avgGrade)}`}>{avgGrade}</p>
          </div>
        )}
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Avg Score */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Avg Score</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${avgScore != null ? scoreColor(avgScore) : "text-zinc-400"}`}>
              {avgScore ?? "—"}
            </span>
            {scoreTrend != null && scoreTrend !== 0 && (
              <span className={`flex items-center gap-0.5 text-sm font-medium ${scoreTrend > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {scoreTrend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {scoreTrend > 0 ? "+" : ""}{scoreTrend}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">{scoredCount} scored call{scoredCount !== 1 ? "s" : ""}</p>
        </div>

        {/* Close Rate */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-green-500" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Close Rate</span>
          </div>
          <span className="text-3xl font-bold text-zinc-900 dark:text-white">
            {closeRate != null ? `${closeRate}%` : "—"}
          </span>
          <p className="text-xs text-zinc-500 mt-1">
            {closedCount} closed · {followUpCount} follow-up · {noSaleCount} no sale
          </p>
        </div>

        {/* This Week */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">This Week</span>
          </div>
          <span className="text-3xl font-bold text-zinc-900 dark:text-white">{thisWeekCalls}</span>
          <p className="text-xs text-zinc-500 mt-1">call{thisWeekCalls !== 1 ? "s" : ""}</p>
        </div>

        {/* This Month */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">This Month</span>
          </div>
          <span className="text-3xl font-bold text-zinc-900 dark:text-white">{thisMonthCalls}</span>
          <p className="text-xs text-zinc-500 mt-1">{calls.length} total all-time</p>
        </div>
      </div>

      {/* ─── Score Breakdown Averages ─── */}
      {Object.keys(breakdownTotals).length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Average Score Breakdown</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(breakdownTotals)
              .filter(([k]) => BREAKDOWN_CONFIG[k])
              .map(([key, { sum, count }]) => {
                const config = BREAKDOWN_CONFIG[key];
                const avg = Math.round((sum / count) * 10) / 10;
                const pct = Math.round((avg / config.max) * 100);
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{config.label}</span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-white">
                        {avg}<span className="text-zinc-400 font-normal">/{config.max}</span>
                      </span>
                    </div>
                    <div className="h-2.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ─── Technique Averages ─── */}
      {(avgValueStacking != null || avgUrgency != null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {avgValueStacking != null && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Value Stacking</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${avgValueStacking >= 15 ? "text-green-600" : avgValueStacking >= 10 ? "text-amber-600" : "text-red-600"}`}>
                  {avgValueStacking}
                </span>
                <span className="text-zinc-400 text-sm">/20 avg</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">across {valueStackingCount} call{valueStackingCount !== 1 ? "s" : ""}</p>
            </div>
          )}
          {avgUrgency != null && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Urgency Creation</h3>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${avgUrgency >= 11 ? "text-green-600" : avgUrgency >= 7 ? "text-amber-600" : "text-red-600"}`}>
                  {avgUrgency}
                </span>
                <span className="text-zinc-400 text-sm">/15 avg</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">across {urgencyCount} call{urgencyCount !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Strengths & Weaknesses ─── */}
      {(topStrengths.length > 0 || topWeaknesses.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          {topStrengths.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-green-200 dark:border-green-800/50 shadow-sm">
              <div className="p-4 border-b border-green-200 dark:border-green-800/50 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-400">Top Strengths</h3>
              </div>
              <ul className="p-4 space-y-2.5">
                {topStrengths.map(([strength, count], i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">{strength}</span>
                    <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      ×{count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {topWeaknesses.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-red-200 dark:border-red-800/50 shadow-sm">
              <div className="p-4 border-b border-red-200 dark:border-red-800/50 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <h3 className="text-sm font-semibold text-red-800 dark:text-red-400">Areas to Improve</h3>
              </div>
              <ul className="p-4 space-y-2.5">
                {topWeaknesses.map(([weakness, count], i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">{weakness}</span>
                    <span className="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      ×{count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ─── Charts ─── */}
      {(scoreTrendData.length > 0 || closeTypeData.some((d) => d.value > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ScoreTrendChart data={scoreTrendData} />
          <CloseTypePieChart data={closeTypeData} />
        </div>
      )}

      {/* ─── AI Insights ─── */}
      {(strongestArea || weakestArea || trendSummary) && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/50 shadow-sm">
          <div className="p-4 border-b border-indigo-200 dark:border-indigo-800/50 flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">AI Insights</h3>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {strongestArea && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Strongest Area</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-0.5">{strongestArea.label}</p>
                  <p className="text-xs text-green-600 dark:text-green-400">{strongestArea.pct}% average</p>
                </div>
              </div>
            )}
            {weakestArea && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <Crosshair className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Weakest Area</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-0.5">{weakestArea.label}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{weakestArea.pct}% average</p>
                </div>
              </div>
            )}
            {weakestArea && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Recommended Focus</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-0.5">{weakestArea.label}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Priority training area</p>
                </div>
              </div>
            )}
            {trendSummary && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Trend Summary</p>
                  <p className={`text-sm font-semibold mt-0.5 ${
                    trendSummary === "Improving"
                      ? "text-green-600 dark:text-green-400"
                      : trendSummary === "Declining"
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-700 dark:text-zinc-300"
                  }`}>
                    {trendSummary}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {scoreTrend != null && scoreTrend !== 0
                      ? `${scoreTrend > 0 ? "+" : ""}${scoreTrend} pts vs last month`
                      : "Steady performance"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Recent Calls ─── */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Calls</h3>
          </div>
          <span className="text-xs text-zinc-500">{scoredCalls.length} scored total</span>
        </div>

        {recentCalls.length > 0 ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentCalls.map((call) => (
              <Link
                key={call.id}
                href={`/dashboard/calls/${call.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                {/* Score */}
                <div className={`text-xl font-bold w-12 text-center ${scoreColor(call.overall_score)}`}>
                  {call.overall_score}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                    {call.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500">
                      {new Date(call.created_at).toLocaleDateString()}
                    </span>
                    {call.outcome && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase ${
                        call.outcome === "closed"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : call.outcome === "follow_up"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : call.outcome === "no_sale"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        {call.outcome.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {call.close_type && call.outcome !== "no_sale" && (
                    <CloseTypeBadge type={call.close_type} />
                  )}
                  {call.grade && (
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${gradeBg(call.grade)} ${gradeColor(call.grade)}`}>
                      {call.grade}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Phone className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No scored calls yet</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Calls will appear here once they&apos;re scored.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
