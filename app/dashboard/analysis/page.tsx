import { redirect } from "next/navigation";
import { getCurrentUserWithRole, getDefaultOrgId } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  BarChart3,
  Trophy,
  TrendingUp,
  TrendingDown,
  Users,
  Phone,
  Target,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  Shield,
  Lightbulb,
  ArrowUpDown,
  ChevronDown,
} from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  rapport_tone: "Rapport & Tone",
  discovery_quality: "Discovery Quality",
  call_control: "Call Control",
  pain_amplification: "Pain Amplification",
  offer_explanation: "Offer Explanation",
  objection_handling: "Objection Handling",
  urgency_close_attempt: "Urgency & Close",
  confidence_authority: "Confidence & Authority",
  next_steps_clarity: "Next Steps Clarity",
  overall_close_quality: "Close Quality",
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setHours(0, 0, 0, 0);
  date.setDate(diff);
  return date;
}

function getEffectiveOutcome(score: any): string | null {
  return score.manual_outcome || score.outcome || score.close_outcome || null;
}

function scoreBadgeClass(score: number): string {
  if (score >= 8) return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
  if (score >= 6) return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400";
  return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
}

function outcomePillClass(outcome: string): string {
  switch (outcome) {
    case "closed":
      return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400";
    case "follow_up":
      return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400";
    case "no_sale":
      return "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
    default:
      return "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
  }
}

function outcomePretty(outcome: string): string {
  switch (outcome) {
    case "closed": return "Closed";
    case "follow_up": return "Follow-up";
    case "no_sale": return "No Sale";
    default: return outcome;
  }
}

function roleBadge(role: string | null) {
  if (!role) return null;
  const styles: Record<string, string> = {
    closer: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    sdr: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
    admin: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[role] || styles.admin}`}>
      {role.toUpperCase()}
    </span>
  );
}

function countFrequency(arrays: (unknown[] | null)[]): [string, number][] {
  const counts: Record<string, number> = {};
  for (const arr of arrays) {
    if (!arr) continue;
    for (const item of arr) {
      if (!item) continue;
      // Handle both string items and object items (e.g. { type: "pricing", quote: "..." })
      let key: string;
      if (typeof item === "string") {
        key = item.trim();
      } else if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        key = String(obj.type || obj.label || obj.quote || "").trim();
      } else {
        key = String(item).trim();
      }
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUserWithRole();

  if (!user || !user.rep) {
    return null;
  }

  // SERVER-SIDE: Analysis is admin-only
  if (!user.isAdminUser) {
    redirect("/dashboard");
  }

  const supabase = await createServiceClient();
  const orgId = await getDefaultOrgId();
  const sortBy = params.sort || "score";

  // Get Monday of current week
  const monday = getMonday(new Date());
  const mondayISO = monday.toISOString();

  // Fetch all reps for this org
  const { data: reps } = await supabase
    .from("reps")
    .select("id, name, email, role, sales_role, status")
    .eq("org_id", orgId)
    .eq("status", "active");

  // Fetch calls this week with scores (excluding soft-deleted)
  const { data: weekCalls } = await supabase
    .from("calls")
    .select(`
      id,
      title,
      created_at,
      rep_id,
      call_scores(
        call_id,
        overall_score,
        score_total,
        close_outcome,
        close_type,
        strengths,
        weaknesses,
        objections_detected,
        score_grade,
        score_breakdown,
        coaching_feedback,
        missed_opportunities
      )
    `)
    .eq("org_id", orgId)
    .gte("created_at", mondayISO)
    .is("deleted_at", null); // CRITICAL: Exclude soft-deleted calls

  // Build scored calls list (only calls that have scores)
  // call_scores may be returned as array or object depending on Supabase FK constraints
  const scoredCalls = (weekCalls || [])
    .filter((c: any) => {
      const cs = c.call_scores;
      if (!cs) return false;
      if (Array.isArray(cs)) return cs.length > 0;
      return true;
    })
    .map((c: any) => {
      const s = Array.isArray(c.call_scores) ? c.call_scores[0] : c.call_scores;
      return {
        id: c.id,
        title: c.title,
        created_at: c.created_at,
        rep_id: c.rep_id,
        score: {
          ...s,
          score_total: s.overall_score ?? s.score_total,
          outcome: s.close_outcome,
          manual_outcome: null,
          categories: null,
          quality_label: s.score_grade,
          rubric_type: null,
          next_coaching_actions: s.coaching_feedback ? [s.coaching_feedback] : [],
        } as any,
      };
    });

  // ---- Section A: Team Snapshot ----
  const totalScored = scoredCalls.length;
  const allScores = scoredCalls.map((c) => c.score.score_total).filter((s: any): s is number => s != null);
  const teamAvg = allScores.length > 0 ? allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length : null;

  let closedCount = 0;
  let followUpCount = 0;
  let noSaleCount = 0;

  for (const c of scoredCalls) {
    const outcome = getEffectiveOutcome(c.score);
    if (outcome === "closed") closedCount++;
    else if (outcome === "follow_up") followUpCount++;
    else if (outcome === "no_sale") noSaleCount++;
  }

  // ---- Section B: Weekly Review Queue (per rep) ----
  const repMap = new Map<string, any>();
  for (const rep of reps || []) {
    repMap.set(rep.id, { ...rep, calls: [] as any[] });
  }
  for (const c of scoredCalls) {
    if (c.rep_id && repMap.has(c.rep_id)) {
      repMap.get(c.rep_id)!.calls.push(c);
    }
  }

  type RepReview = {
    rep: any;
    avgScore: number;
    bestClosed: any | null;
    bestNonClosed: any | null;
    worstCall: any | null;
    callCount: number;
  };

  const reviewQueue: RepReview[] = [];

  for (const [, repData] of repMap) {
    const calls: any[] = repData.calls;
    if (calls.length === 0) continue;

    const scores = calls.map((c) => c.score.score_total).filter((s: any): s is number => s != null);
    const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

    const pool = calls;

    // Best closed call
    const closedCalls = pool.filter((c) => getEffectiveOutcome(c.score) === "closed" && c.score.score_total != null);
    const bestClosed = closedCalls.length > 0
      ? closedCalls.reduce((best: any, c: any) => (c.score.score_total > best.score.score_total ? c : best))
      : null;

    // Best non-closed call
    const nonClosedCalls = pool.filter((c) => {
      const oc = getEffectiveOutcome(c.score);
      return oc && oc !== "closed" && c.score.score_total != null;
    });
    const bestNonClosed = nonClosedCalls.length > 0
      ? nonClosedCalls.reduce((best: any, c: any) => (c.score.score_total > best.score.score_total ? c : best))
      : null;

    // Worst call
    const allWithScores = pool.filter((c) => c.score.score_total != null);
    const worstCall = allWithScores.length > 0
      ? allWithScores.reduce((worst: any, c: any) => (c.score.score_total < worst.score.score_total ? c : worst))
      : null;

    reviewQueue.push({
      rep: repData,
      avgScore: avg,
      bestClosed,
      bestNonClosed,
      worstCall,
      callCount: calls.length,
    });
  }

  // Sort review queue by avg score desc
  reviewQueue.sort((a, b) => b.avgScore - a.avgScore);

  // ---- Section C: Trend Insights ----
  const objectionArrays = scoredCalls.map((c) => c.score.objections_detected);
  const weaknessArrays = scoredCalls.map((c) => c.score.weaknesses);

  const topObjections = countFrequency(objectionArrays).slice(0, 5);
  const topWeaknesses = countFrequency(weaknessArrays).slice(0, 5);

  // Category averages
  const categoryTotals: Record<string, { sum: number; count: number }> = {};
  for (const c of scoredCalls) {
    const cats = c.score.categories;
    if (!cats || typeof cats !== "object") continue;
    for (const [key, val] of Object.entries(cats)) {
      if (typeof val === "number") {
        if (!categoryTotals[key]) categoryTotals[key] = { sum: 0, count: 0 };
        categoryTotals[key].sum += val;
        categoryTotals[key].count++;
      }
    }
  }

  const categoryAvgs = Object.entries(categoryTotals)
    .map(([key, { sum, count }]) => ({ key, avg: sum / count }))
    .sort((a, b) => a.avg - b.avg);

  const weakCategories = categoryAvgs.slice(0, 3);
  const strongCategories = [...categoryAvgs].sort((a, b) => b.avg - a.avg).slice(0, 3);

  // ---- Section D: Coaching Priorities ----
  // Count weaknesses per rep to get "X reps struggled with this"
  const weaknessRepMap: Record<string, Set<string>> = {};
  for (const c of scoredCalls) {
    const weaknesses = c.score.weaknesses;
    if (!weaknesses || !c.rep_id) continue;
    for (const w of weaknesses) {
      const key = w?.trim();
      if (!key) continue;
      if (!weaknessRepMap[key]) weaknessRepMap[key] = new Set();
      weaknessRepMap[key].add(c.rep_id);
    }
  }
  const coachingPriorities = Object.entries(weaknessRepMap)
    .map(([weakness, repSet]) => ({ weakness, repCount: repSet.size }))
    .sort((a, b) => b.repCount - a.repCount)
    .slice(0, 3);

  // ---- Section E: Leaderboard ----
  type LeaderboardRow = {
    rep: any;
    avgScore: number;
    callCount: number;
    closed: number;
    followUp: number;
    noSale: number;
  };

  const leaderboard: LeaderboardRow[] = [];
  for (const [, repData] of repMap) {
    const calls: any[] = repData.calls;
    if (calls.length === 0) continue;
    const scores = calls.map((c) => c.score.score_total).filter((s: any): s is number => s != null);
    const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
    let cl = 0, fu = 0, ns = 0;
    for (const c of calls) {
      const oc = getEffectiveOutcome(c.score);
      if (oc === "closed") cl++;
      else if (oc === "follow_up") fu++;
      else if (oc === "no_sale") ns++;
    }
    leaderboard.push({ rep: repData, avgScore: avg, callCount: calls.length, closed: cl, followUp: fu, noSale: ns });
  }

  // Sort leaderboard
  switch (sortBy) {
    case "name":
      leaderboard.sort((a, b) => a.rep.name.localeCompare(b.rep.name));
      break;
    case "calls":
      leaderboard.sort((a, b) => b.callCount - a.callCount);
      break;
    case "closed":
      leaderboard.sort((a, b) => b.closed - a.closed);
      break;
    case "role":
      leaderboard.sort((a, b) => (a.rep.sales_role || "").localeCompare(b.rep.sales_role || ""));
      break;
    case "score":
    default:
      leaderboard.sort((a, b) => b.avgScore - a.avgScore);
      break;
  }

  const hasData = scoredCalls.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Weekly Manager Operating System</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          Week of {monday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} — Team review & coaching insights
        </p>
      </div>

      {hasData ? (
        <>
          {/* Section A: Team Snapshot */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Team Snapshot</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Scored This Week</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{totalScored}</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Team Avg Score</p>
                <p className={`text-2xl font-bold ${teamAvg && teamAvg >= 8 ? "text-green-600 dark:text-green-400" : teamAvg && teamAvg < 6 ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white"}`}>
                  {teamAvg?.toFixed(1) || "-"}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">Closed</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{closedCount}</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">Follow-up</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{followUpCount}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400 mb-1">No Sale</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{noSaleCount}</p>
              </div>
            </div>
          </section>

          {/* Section B: Weekly Review Queue */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Weekly Review Queue</h2>
              <span className="text-xs text-zinc-500 ml-1">({reviewQueue.length} reps with calls)</span>
            </div>
            <div className="space-y-3">
              {reviewQueue.map((item) => (
                <details key={item.rep.id} open className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm group">
                  <summary className="flex items-center justify-between p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-700 dark:text-indigo-400 font-semibold text-sm">
                          {item.rep.name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-900 dark:text-white">{item.rep.name}</span>
                          {roleBadge(item.rep.sales_role)}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {item.callCount} calls · Avg {item.avgScore.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${item.avgScore >= 8 ? "text-green-600 dark:text-green-400" : item.avgScore < 6 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {item.avgScore.toFixed(1)}
                      </span>
                      <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform group-open:rotate-180" />
                    </div>
                  </summary>
                  <div className="px-5 pb-5 pt-0 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                      {/* Best Closed */}
                      <CallCard
                        label="Best Closed Call"
                        icon={<Trophy className="w-4 h-4 text-green-600 dark:text-green-400" />}
                        call={item.bestClosed}
                        accentColor="green"
                      />
                      {/* Best Non-Closed */}
                      <CallCard
                        label="Best Non-Closed"
                        icon={<TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                        call={item.bestNonClosed}
                        accentColor="blue"
                      />
                      {/* Worst Call */}
                      <CallCard
                        label="Worst Call"
                        icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                        call={item.worstCall}
                        accentColor="red"
                      />
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Section C: Trend Insights */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Trend Insights</h2>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Most Common Objections */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Most Common Objections</h3>
                  </div>
                  {topObjections.length > 0 ? (
                    <div className="space-y-2">
                      {topObjections.map(([objection, count], i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate mr-3">{objection}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex-shrink-0">
                            {count}×
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No objections detected this week</p>
                  )}
                </div>

                {/* Most Common Weaknesses */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Most Common Weaknesses</h3>
                  </div>
                  {topWeaknesses.length > 0 ? (
                    <div className="space-y-2">
                      {topWeaknesses.map(([weakness, count], i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate mr-3">{weakness}</span>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex-shrink-0">
                            {count}×
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No weaknesses recorded this week</p>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Team Weak Categories */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Team Weak Categories</h3>
                  </div>
                  {weakCategories.length > 0 ? (
                    <div className="space-y-3">
                      {weakCategories.map((cat) => (
                        <div key={cat.key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              {CATEGORY_LABELS[cat.key] || cat.key}
                            </span>
                            <span className={`text-sm font-bold ${cat.avg < 6 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                              {cat.avg.toFixed(1)}
                            </span>
                          </div>
                          <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cat.avg < 6 ? "bg-red-500" : "bg-amber-500"}`}
                              style={{ width: `${(cat.avg / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No category data this week</p>
                  )}
                </div>

                {/* Team Strong Categories */}
                <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Team Strong Categories</h3>
                  </div>
                  {strongCategories.length > 0 ? (
                    <div className="space-y-3">
                      {strongCategories.map((cat) => (
                        <div key={cat.key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              {CATEGORY_LABELS[cat.key] || cat.key}
                            </span>
                            <span className={`text-sm font-bold ${cat.avg >= 8 ? "text-green-600 dark:text-green-400" : "text-zinc-900 dark:text-white"}`}>
                              {cat.avg.toFixed(1)}
                            </span>
                          </div>
                          <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cat.avg >= 8 ? "bg-green-500" : "bg-indigo-500"}`}
                              style={{ width: `${(cat.avg / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No category data this week</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Section D: Coaching Priorities */}
          {coachingPriorities.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Coaching Priorities</h2>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 shadow-sm p-6">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Top topics to address with the team this week:</p>
                <ol className="space-y-3">
                  {coachingPriorities.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{i + 1}</span>
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.weakness}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {item.repCount} rep{item.repCount !== 1 ? "s" : ""} struggled with this
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {/* Section E: Rep Comparison / Leaderboard */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Rep Comparison</h2>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-zinc-400" />
                <div className="flex gap-1.5">
                  <SortPill href="/dashboard/analysis?sort=score" active={sortBy === "score"}>Score</SortPill>
                  <SortPill href="/dashboard/analysis?sort=name" active={sortBy === "name"}>Name</SortPill>
                  <SortPill href="/dashboard/analysis?sort=calls" active={sortBy === "calls"}>Volume</SortPill>
                  <SortPill href="/dashboard/analysis?sort=closed" active={sortBy === "closed"}>Closed</SortPill>
                  <SortPill href="/dashboard/analysis?sort=role" active={sortBy === "role"}>Role</SortPill>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800">
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 px-5 py-3">Rep</th>
                      <th className="text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 px-5 py-3">Role</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 px-5 py-3">Avg Score</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 px-5 py-3">Calls</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 px-5 py-3">Closed</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 px-5 py-3">Follow-up</th>
                      <th className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 px-5 py-3">No Sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {leaderboard.map((row) => (
                      <tr key={row.rep.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-medium text-sm text-zinc-900 dark:text-white">{row.rep.name}</span>
                        </td>
                        <td className="px-5 py-3">
                          {roleBadge(row.rep.sales_role)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-sm font-bold ${row.avgScore >= 8 ? "text-green-600 dark:text-green-400" : row.avgScore < 6 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                            {row.avgScore.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">{row.callCount}</td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-sm font-medium text-green-700 dark:text-green-400">{row.closed}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{row.followUp}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-sm font-medium text-red-700 dark:text-red-400">{row.noSale}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-12 text-center">
          <Target className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">No scored calls this week</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
            The weekly operating system will populate once calls are scored this week.
            Check back after your team has some calls graded.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function CallCard({
  label,
  icon,
  call,
  accentColor,
}: {
  label: string;
  icon: React.ReactNode;
  call: any | null;
  accentColor: "green" | "blue" | "red";
}) {
  const borderColors = {
    green: "border-l-green-500",
    blue: "border-l-blue-500",
    red: "border-l-red-500",
  };

  if (!call) {
    return (
      <div className={`bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border-l-4 ${borderColors[accentColor]} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs font-semibold text-zinc-500 uppercase">{label}</span>
        </div>
        <p className="text-xs text-zinc-400 italic">No matching calls</p>
      </div>
    );
  }

  const outcome = getEffectiveOutcome(call.score);
  const score = call.score.score_total;

  return (
    <div className={`bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border-l-4 ${borderColors[accentColor]} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold text-zinc-500 uppercase">{label}</span>
      </div>
      <Link
        href={`/dashboard/calls/${call.id}`}
        className="text-sm font-medium text-zinc-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2 block mb-2"
      >
        {call.title || "Untitled Call"}
      </Link>
      <div className="flex items-center gap-2">
        {score != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBadgeClass(score)}`}>
            {score.toFixed(1)}
          </span>
        )}
        {outcome && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${outcomePillClass(outcome)}`}>
            {outcomePretty(outcome)}
          </span>
        )}
      </div>
    </div>
  );
}

function SortPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </a>
  );
}
