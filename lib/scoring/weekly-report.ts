/**
 * Weekly Manager Report Generator
 *
 * Produces a structured weekly summary covering:
 * - Common objections & trends
 * - No-sale reasons
 * - Coaching gaps by category
 * - Rep strengths/weaknesses + best/worst calls
 * - Marketing angle suggestions
 * - Script priorities
 * - Benchmark candidates
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface WeeklyReportData {
  summary: string;
  period: { start: string; end: string };
  total_calls: number;
  total_scored: number;

  common_objections: Array<{
    label: string;
    count: number;
    trend: string | null;
    best_handler: string | null;
  }>;

  no_sale_reasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;

  coaching_gaps: Array<{
    category: string;
    avg_score: number;
    reps_below_5: string[];
    recommendation: string;
  }>;

  rep_performance: Array<{
    rep: string;
    calls: number;
    avg_score: number;
    strengths: string[];
    weaknesses: string[];
    best_call_id: string | null;
    best_call_score: number | null;
    worst_call_id: string | null;
    worst_call_score: number | null;
    trend: string;
  }>;

  marketing_angles: Array<{
    insight: string;
    suggested_angle: string;
    priority: string;
  }>;

  script_priorities: Array<{
    priority: number;
    area: string;
    current_gap: string;
    suggestion: string;
  }>;

  benchmark_candidates: Array<{
    call_id: string;
    rep: string;
    score: number;
    reason: string;
  }>;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface CallScoreRow {
  id: string;
  call_id: string;
  overall_score: number;
  quality_label: string;
  outcome: string;
  close_type: string | null;
  categories: Record<string, { score: number; reasoning: string }>;
  strengths: string[];
  weaknesses: string[];
  objections_detected: string[];
  objections_handled_well: string[];
  objections_missed: string[];
  manual_outcome: string | null;
  calls?: {
    id: string;
    rep_id: string;
    occurred_at: string;
    reps?: { name: string } | null;
  };
}

export async function generateWeeklyReport(
  supabase: SupabaseClient,
  orgId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyReportData> {
  const startISO = weekStart.toISOString();
  const endISO = weekEnd.toISOString();

  // Fetch all scored calls for the week
  const { data: scores, error } = await supabase
    .from('call_scores')
    .select(`
      id, call_id, overall_score, quality_label, outcome, close_type,
      categories, strengths, weaknesses,
      objections_detected, objections_handled_well, objections_missed,
      manual_outcome,
      calls!inner (id, rep_id, occurred_at, reps (name))
    `)
    .gte('scored_at', startISO)
    .lte('scored_at', endISO)
    .order('overall_score', { ascending: false });

  if (error) {
    console.error('Failed to fetch scores for weekly report:', error.message);
  }

  const rows = (scores || []) as unknown as CallScoreRow[];

  // Fetch total calls (even unscored)
  const { count: totalCalls } = await supabase
    .from('calls')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .gte('occurred_at', startISO)
    .lte('occurred_at', endISO);

  // Fetch objection library for trend comparison
  const { data: objections } = await supabase
    .from('objection_library')
    .select('label, display_name, total_occurrences, trend')
    .eq('org_id', orgId)
    .eq('is_active', true);

  return buildReport(rows, totalCalls || 0, objections || [], weekStart, weekEnd);
}

// ---------------------------------------------------------------------------
// Report builder (pure function, testable)
// ---------------------------------------------------------------------------

function buildReport(
  scores: CallScoreRow[],
  totalCalls: number,
  objectionLib: any[],
  weekStart: Date,
  weekEnd: Date
): WeeklyReportData {
  const period = {
    start: weekStart.toISOString().split('T')[0],
    end: weekEnd.toISOString().split('T')[0],
  };

  // --- Objection aggregation ---
  const objectionCounts: Record<string, number> = {};
  const objectionHandlers: Record<string, Record<string, number>> = {};

  for (const s of scores) {
    const repName = (s.calls?.reps?.name) || 'Unknown';
    for (const obj of s.objections_detected || []) {
      const key = obj.toLowerCase().trim();
      objectionCounts[key] = (objectionCounts[key] || 0) + 1;
    }
    for (const obj of s.objections_handled_well || []) {
      const key = obj.toLowerCase().trim();
      if (!objectionHandlers[key]) objectionHandlers[key] = {};
      objectionHandlers[key][repName] = (objectionHandlers[key][repName] || 0) + 1;
    }
  }

  const common_objections = Object.entries(objectionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([label, count]) => {
      const handlers = objectionHandlers[label] || {};
      const bestHandler = Object.entries(handlers).sort(([, a], [, b]) => b - a)[0]?.[0] || null;
      const libEntry = objectionLib.find(o => o.label === label);
      return { label, count, trend: libEntry?.trend || null, best_handler: bestHandler };
    });

  // --- No-sale reasons ---
  const noSaleScores = scores.filter(s => {
    const outcome = s.manual_outcome || s.outcome;
    return outcome === 'no_sale';
  });
  const noSaleReasonCounts: Record<string, number> = {};
  for (const s of noSaleScores) {
    // Use weaknesses and missed objections as proxy for reasons
    for (const w of s.weaknesses || []) {
      noSaleReasonCounts[w] = (noSaleReasonCounts[w] || 0) + 1;
    }
    for (const obj of s.objections_missed || []) {
      const key = `missed_objection:${obj}`;
      noSaleReasonCounts[key] = (noSaleReasonCounts[key] || 0) + 1;
    }
  }
  const totalNoSale = noSaleScores.length || 1;
  const no_sale_reasons = Object.entries(noSaleReasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([reason, count]) => ({
      reason,
      count,
      percentage: Math.round((count / totalNoSale) * 100),
    }));

  // --- Coaching gaps (categories averaging below 6) ---
  const CATEGORIES = [
    'rapport_tone', 'discovery_quality', 'call_control', 'pain_amplification',
    'offer_explanation', 'objection_handling', 'urgency_close_attempt',
    'confidence_authority', 'next_steps_clarity', 'overall_close_quality',
  ];

  const categoryAggs: Record<string, { total: number; count: number; repScores: Record<string, number[]> }> = {};
  for (const cat of CATEGORIES) {
    categoryAggs[cat] = { total: 0, count: 0, repScores: {} };
  }

  for (const s of scores) {
    const repName = s.calls?.reps?.name || 'Unknown';
    for (const cat of CATEGORIES) {
      const catScore = s.categories?.[cat]?.score;
      if (catScore != null) {
        categoryAggs[cat].total += catScore;
        categoryAggs[cat].count += 1;
        if (!categoryAggs[cat].repScores[repName]) categoryAggs[cat].repScores[repName] = [];
        categoryAggs[cat].repScores[repName].push(catScore);
      }
    }
  }

  const coaching_gaps = CATEGORIES
    .map(cat => {
      const agg = categoryAggs[cat];
      const avg = agg.count > 0 ? agg.total / agg.count : 0;
      const repsBelow5 = Object.entries(agg.repScores)
        .filter(([, scores]) => {
          const repAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
          return repAvg < 5;
        })
        .map(([rep]) => rep);

      return {
        category: cat,
        avg_score: Math.round(avg * 10) / 10,
        reps_below_5: repsBelow5,
        recommendation: generateCoachingRec(cat, avg, repsBelow5),
      };
    })
    .filter(g => g.avg_score < 6)
    .sort((a, b) => a.avg_score - b.avg_score);

  // --- Rep performance ---
  const repData: Record<string, {
    calls: number;
    scores: number[];
    catScores: Record<string, number[]>;
    bestCall: { id: string; score: number } | null;
    worstCall: { id: string; score: number } | null;
  }> = {};

  for (const s of scores) {
    const repName = s.calls?.reps?.name || 'Unknown';
    if (!repData[repName]) {
      repData[repName] = { calls: 0, scores: [], catScores: {}, bestCall: null, worstCall: null };
    }
    const rd = repData[repName];
    rd.calls++;
    rd.scores.push(s.overall_score);

    if (!rd.bestCall || s.overall_score > rd.bestCall.score) {
      rd.bestCall = { id: s.call_id, score: s.overall_score };
    }
    if (!rd.worstCall || s.overall_score < rd.worstCall.score) {
      rd.worstCall = { id: s.call_id, score: s.overall_score };
    }

    for (const [cat, catData] of Object.entries(s.categories || {})) {
      if (!rd.catScores[cat]) rd.catScores[cat] = [];
      rd.catScores[cat].push(catData.score);
    }
  }

  const rep_performance = Object.entries(repData).map(([rep, rd]) => {
    const avg = rd.scores.reduce((a, b) => a + b, 0) / rd.scores.length;

    // Find top 2 strengths and weaknesses by avg category score
    const catAvgs = Object.entries(rd.catScores).map(([cat, scores]) => ({
      cat,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    })).sort((a, b) => b.avg - a.avg);

    const strengths = catAvgs.slice(0, 2).map(c => c.cat);
    const weaknesses = catAvgs.slice(-2).map(c => c.cat);

    // Trend: compare first half vs second half
    const mid = Math.floor(rd.scores.length / 2);
    const firstHalf = rd.scores.slice(0, mid || 1);
    const secondHalf = rd.scores.slice(mid || 1);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trend = secondAvg > firstAvg + 3 ? 'improving' : secondAvg < firstAvg - 3 ? 'declining' : 'stable';

    return {
      rep,
      calls: rd.calls,
      avg_score: Math.round(avg),
      strengths,
      weaknesses,
      best_call_id: rd.bestCall?.id || null,
      best_call_score: rd.bestCall?.score || null,
      worst_call_id: rd.worstCall?.id || null,
      worst_call_score: rd.worstCall?.score || null,
      trend,
    };
  }).sort((a, b) => b.avg_score - a.avg_score);

  // --- Marketing angles ---
  const marketing_angles: WeeklyReportData['marketing_angles'] = [];

  // Derive from top objections
  if (common_objections.length > 0) {
    const topObj = common_objections[0];
    marketing_angles.push({
      insight: `"${topObj.label}" is the #1 objection (${topObj.count} occurrences this week)`,
      suggested_angle: `Address "${topObj.label}" directly in ad copy and landing page`,
      priority: topObj.count > 5 ? 'high' : 'medium',
    });
  }

  // Price objection frequency
  const priceObj = common_objections.find(o => o.label.includes('price') || o.label.includes('expensive') || o.label.includes('cost'));
  if (priceObj && priceObj.count >= 3) {
    marketing_angles.push({
      insight: `Price objection hit ${priceObj.count} times — prospects don't see the ROI`,
      suggested_angle: 'ROI calculator or "cost of bad credit" comparison ad',
      priority: 'high',
    });
  }

  // --- Script priorities ---
  const script_priorities: WeeklyReportData['script_priorities'] = coaching_gaps
    .slice(0, 5)
    .map((gap, i) => ({
      priority: i + 1,
      area: gap.category,
      current_gap: `Team avg ${gap.avg_score}/10 — ${gap.reps_below_5.length} rep(s) below 5`,
      suggestion: gap.recommendation,
    }));

  // --- Benchmark candidates ---
  const benchmark_candidates = scores
    .filter(s => s.overall_score >= 80)
    .slice(0, 5)
    .map(s => ({
      call_id: s.call_id,
      rep: s.calls?.reps?.name || 'Unknown',
      score: s.overall_score,
      reason: `${s.quality_label} call — strong in ${(s.strengths || []).slice(0, 2).join(', ')}`,
    }));

  // --- Summary ---
  const avgOverall = scores.length > 0
    ? Math.round(scores.reduce((a, s) => a + s.overall_score, 0) / scores.length)
    : 0;
  const closedCount = scores.filter(s => (s.manual_outcome || s.outcome) === 'closed').length;

  const summary = [
    `Week of ${period.start} to ${period.end}:`,
    `${totalCalls} calls total, ${scores.length} scored.`,
    `Avg score: ${avgOverall}/100.`,
    `${closedCount} closed, ${noSaleScores.length} no-sale.`,
    coaching_gaps.length > 0 ? `Coaching priority: ${coaching_gaps[0].category} (avg ${coaching_gaps[0].avg_score}).` : '',
    benchmark_candidates.length > 0 ? `${benchmark_candidates.length} benchmark candidate(s).` : '',
  ].filter(Boolean).join(' ');

  return {
    summary,
    period,
    total_calls: totalCalls,
    total_scored: scores.length,
    common_objections,
    no_sale_reasons,
    coaching_gaps,
    rep_performance,
    marketing_angles,
    script_priorities,
    benchmark_candidates,
  };
}

function generateCoachingRec(category: string, avg: number, repsBelow5: string[]): string {
  const recs: Record<string, string> = {
    'rapport_tone': 'Run a "first 90 seconds" drill — practice opening warmth and name usage',
    'discovery_quality': 'Provide a discovery question cheat sheet with 5 must-ask questions',
    'call_control': 'Practice "redirect phrases" for when prospects go off-topic',
    'pain_amplification': 'Role-play pain amplification — practice "what happens if..." questions',
    'offer_explanation': 'Create call-specific offer templates tied to discovery answers',
    'objection_handling': 'Weekly objection drill — pick the top objection and practice 3 responses',
    'urgency_close_attempt': 'Practice assumptive close language and urgency tie-ins',
    'confidence_authority': 'Build confidence with success story scripts and specific numbers',
    'next_steps_clarity': 'Mandate: every call must end with a specific date/time for next contact',
    'overall_close_quality': 'Review best close calls from benchmark library as a team',
  };

  let rec = recs[category] || `Focus training on ${category}`;
  if (repsBelow5.length > 0) {
    rec += ` — priority reps: ${repsBelow5.join(', ')}`;
  }
  return rec;
}

// ---------------------------------------------------------------------------
// Save weekly report
// ---------------------------------------------------------------------------

export async function saveWeeklyReport(
  supabase: SupabaseClient,
  orgId: string,
  report: WeeklyReportData,
  weekStart: Date,
  weekEnd: Date
): Promise<{ id: string | null; error?: string }> {
  const { data, error } = await supabase
    .from('weekly_reports')
    .upsert({
      org_id: orgId,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      report_data: report,
      model_version: 'controlled-learning-v1',
    }, {
      onConflict: 'org_id,week_start',
    })
    .select('id')
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data!.id };
}
