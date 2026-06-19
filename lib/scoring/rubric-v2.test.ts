/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_WEIGHTS_V2,
  buildRubricV2Result,
  calculateWeightedScore,
  mapRubricV2ToLegacy,
  normalizeCategoryEvidence,
} from './rubric-v2';
import { buildAnalysisMetadata, buildScoreRowForTest, validateAndParseForTest } from './worker';

const categoryScores = (overrides: Record<string, number> = {}): any[] =>
  CATEGORY_WEIGHTS_V2.map((category) => ({
    category_key: category.key,
    category_name: category.name,
    score: overrides[category.key] ?? 5,
    what_happened: `${category.name} happened`,
    why_this_score: `Scored ${overrides[category.key] ?? 5}`,
    evidence: [{ timestamp: '01:00', speaker: 'Rep', quote: `${category.name} evidence` }],
    coaching_feedback: `Improve ${category.name}`,
    improved_example_phrasing: `Better ${category.name}`,
  }));

const baseModelResult = (overrides: Record<string, number> = {}): any => ({
  analysis_status: 'complete' as const,
  deal_outcome: {
    final_outcome: 'no_sale' as const,
    outcome_confidence: 'medium' as const,
    offer_pitched: false,
    price_discussed: false,
    close_attempted: false,
    payment_collected: false,
    deposit_collected: false,
    payment_plan_arranged: false,
    follow_up_booked: false,
    onboarding_or_next_step_completed: false,
    evidence: [],
  },
  category_scores: categoryScores(overrides),
  best_moments: [],
  missed_opportunities: [],
  top_3_coaching_actions: [],
  compliance_flags: [],
  manager_summary: 'Manager summary',
  rep_facing_summary: 'Rep summary',
  timestamped_key_moments: [],
});

describe('Credit Club scoring rubric v2', () => {
  it('calculates deterministic weighted scores from category scores', () => {
    const scores = categoryScores({
      opening_agenda: 10,
      discovery_qualification: 8,
      pain_problem_awareness: 10,
      solution_explanation: 10,
      value_building: 10,
      pitch_offer_clarity: 10,
      objection_handling: 6,
      closing_skill: 10,
      payment_commitment_next_steps: 10,
      compliance_professionalism: 10,
      communication_call_control: 10,
    });

    const result = calculateWeightedScore(scores, []);

    expect(result.categoryScores.find((c) => c.category_key === 'discovery_qualification')?.weighted_points).toBe(12);
    expect(result.categoryScores.find((c) => c.category_key === 'objection_handling')?.weighted_points).toBe(9);
    expect(result.overallScore).toBe(91);
    expect(result.scoreCalculation.method).toBe('deterministic_weighted_average');
  });

  it('does not auto-inflate a weak closed call just because payment was collected', () => {
    const raw = baseModelResult({
      opening_agenda: 4,
      discovery_qualification: 2,
      pain_problem_awareness: 3,
      solution_explanation: 4,
      value_building: 2,
      pitch_offer_clarity: 5,
      objection_handling: 3,
      closing_skill: 7,
      payment_commitment_next_steps: 10,
      compliance_professionalism: 4,
      communication_call_control: 4,
    });
    raw.deal_outcome = {
      ...raw.deal_outcome,
      final_outcome: 'payment_collected',
      outcome_confidence: 'high',
      offer_pitched: true,
      price_discussed: true,
      close_attempted: true,
      payment_collected: true,
      evidence: [{ timestamp: '42:10', speaker: 'Prospect', quote: 'I have paid the full amount.' }],
    };
    raw.missed_opportunities = [{ timestamp: '10:00', issue: 'Weak discovery', coaching_feedback: 'Ask about goals first.' }];

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.deal_outcome.final_outcome).toBe('payment_collected');
    expect(result.overall_score).toBeLessThan(60);
    expect(result.missed_opportunities.length).toBeGreaterThan(0);
  });

  it('allows a strong no-sale process to score well when follow-up is booked', () => {
    const raw = baseModelResult({
      opening_agenda: 8,
      discovery_qualification: 9,
      pain_problem_awareness: 8,
      solution_explanation: 8,
      value_building: 8,
      pitch_offer_clarity: 8,
      objection_handling: 8,
      closing_skill: 7,
      payment_commitment_next_steps: 7,
      compliance_professionalism: 10,
      communication_call_control: 8,
    });
    raw.deal_outcome = {
      ...raw.deal_outcome,
      final_outcome: 'follow_up_booked',
      outcome_confidence: 'high',
      offer_pitched: true,
      price_discussed: true,
      close_attempted: true,
      follow_up_booked: true,
      evidence: [{ timestamp: '35:20', speaker: 'Rep', quote: 'Let’s speak tomorrow at 2pm after you check affordability.' }],
    };

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.deal_outcome.final_outcome).toBe('follow_up_booked');
    expect(result.overall_score).toBeGreaterThanOrEqual(80);
  });

  it('detects strong closed calls from high process scores and payment evidence', () => {
    const raw = baseModelResult(Object.fromEntries(CATEGORY_WEIGHTS_V2.map((c) => [c.key, 9])));
    raw.deal_outcome = {
      ...raw.deal_outcome,
      final_outcome: 'payment_collected',
      outcome_confidence: 'high',
      offer_pitched: true,
      price_discussed: true,
      close_attempted: true,
      payment_collected: true,
      onboarding_or_next_step_completed: true,
      evidence: [{ timestamp: '48:05', speaker: 'Rep', quote: 'Payment is confirmed and I’ll add you to Skool now.' }],
    };

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.overall_score).toBe(90);
    expect(result.deal_outcome.payment_collected).toBe(true);
    expect(result.deal_outcome.evidence[0].quote).toContain('Payment is confirmed');
  });

  it('keeps weak closed calls in the low or mid score range', () => {
    const raw = baseModelResult({
      opening_agenda: 3,
      discovery_qualification: 3,
      pain_problem_awareness: 2,
      solution_explanation: 4,
      value_building: 3,
      pitch_offer_clarity: 5,
      objection_handling: 3,
      closing_skill: 6,
      payment_commitment_next_steps: 10,
      compliance_professionalism: 5,
      communication_call_control: 4,
    });
    raw.deal_outcome = { ...raw.deal_outcome, final_outcome: 'payment_collected', payment_collected: true, outcome_confidence: 'high' };

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.deal_outcome.payment_collected).toBe(true);
    expect(result.overall_score).toBeLessThanOrEqual(50);
  });

  it('preserves late close evidence rather than forcing premature no-sale', () => {
    const raw = baseModelResult({ payment_commitment_next_steps: 9, closing_skill: 8 });
    raw.deal_outcome = {
      ...raw.deal_outcome,
      final_outcome: 'payment_collected',
      payment_collected: true,
      close_attempted: true,
      outcome_confidence: 'high',
      evidence: [{ timestamp: '59:40', speaker: 'Prospect', quote: 'Okay, I just sent the payment.' }],
    };

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.deal_outcome.final_outcome).toBe('payment_collected');
    expect(result.deal_outcome.evidence[0].timestamp).toBe('59:40');
  });

  it('distinguishes follow-up booked from payment collected', () => {
    const raw = baseModelResult({ payment_commitment_next_steps: 7 });
    raw.deal_outcome = {
      ...raw.deal_outcome,
      final_outcome: 'follow_up_booked',
      follow_up_booked: true,
      payment_collected: false,
      deposit_collected: false,
      outcome_confidence: 'high',
      evidence: [{ timestamp: '31:00', speaker: 'Rep', quote: 'I will call you Friday at 11am.' }],
    };

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.deal_outcome.follow_up_booked).toBe(true);
    expect(result.deal_outcome.payment_collected).toBe(false);
    expect(result.deal_outcome.deposit_collected).toBe(false);
    expect(result.deal_outcome.final_outcome).not.toBe('payment_collected');
  });

  it('balances poor discovery with strong closing instead of making the score outcome-only', () => {
    const result = buildRubricV2Result(baseModelResult({ discovery_qualification: 2, closing_skill: 9 }), { analysisCoveragePercentage: 100 });

    expect(result.category_scores.find((c) => c.category_key === 'discovery_qualification')?.score).toBe(2);
    expect(result.category_scores.find((c) => c.category_key === 'closing_skill')?.score).toBe(9);
    expect(result.overall_score).toBeLessThan(65);
  });

  it('keeps good discovery visible when the close is weak', () => {
    const raw = baseModelResult({ discovery_qualification: 9, closing_skill: 2 });
    raw.missed_opportunities = [{ timestamp: '44:00', issue: 'Weak close', coaching_feedback: 'Ask clearly for payment.' }];

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.category_scores.find((c) => c.category_key === 'discovery_qualification')?.score).toBe(9);
    expect(result.category_scores.find((c) => c.category_key === 'closing_skill')?.score).toBe(2);
    expect(result.missed_opportunities[0].coaching_feedback).toContain('payment');
  });

  it('applies compliance caps only when clear high severity evidence is present', () => {
    const raw = baseModelResult(Object.fromEntries(CATEGORY_WEIGHTS_V2.map((c) => [c.key, 10])));
    raw.compliance_flags = [
      {
        severity: 'high' as const,
        issue: 'Guaranteed approval claim',
        timestamp: '12:00',
        evidence: 'We guarantee you will get approved.',
        safer_wording: 'We can help improve your approval chances, but no approval is guaranteed.',
      },
    ];

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.compliance_flags[0].severity).toBe('high');
    expect(result.score_calculation.score_cap_applied).toBe(true);
    expect(result.overall_score).toBe(75);
  });

  it('supports unclear outcomes without hallucinating payment', () => {
    const raw = baseModelResult();
    raw.deal_outcome = { ...raw.deal_outcome, final_outcome: 'unclear', outcome_confidence: 'low' };

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });

    expect(result.deal_outcome.final_outcome).toBe('unclear');
    expect(result.deal_outcome.outcome_confidence).toBe('low');
    expect(result.deal_outcome.payment_collected).toBe(false);
  });

  it('uses approved missing-evidence language only when full transcript coverage is available', () => {
    const full = normalizeCategoryEvidence([], 100);
    const partial = normalizeCategoryEvidence([], 80);

    expect(full[0].quote).toBe('Not observed in the full analyzed transcript.');
    expect(partial[0].quote).toBe('Not observed in the analyzed transcript segment. Do not conclude this was absent from the full call.');
  });

  it('maps v2 output into legacy fields for dashboards and controlled learning', () => {
    const raw = baseModelResult({
      discovery_qualification: 8,
      pain_problem_awareness: 7,
      solution_explanation: 6,
      value_building: 7,
      objection_handling: 9,
      closing_skill: 8,
      payment_commitment_next_steps: 6,
      communication_call_control: 8,
    });
    raw.best_moments = [{ timestamp: '03:00', title: 'Good discovery', quote: 'What are you trying to get approved for?', why_it_was_strong: 'Uncovered goal.' }];
    raw.missed_opportunities = [{ timestamp: '22:00', issue: 'Value gap', coaching_feedback: 'Tie the offer to their goal.' }];

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });
    const legacy = mapRubricV2ToLegacy(result);

    expect(legacy.overall_score).toBe(result.overall_score);
    expect(legacy.score_total).toBe(result.overall_score);
    expect(legacy.categories.discovery_quality.score).toBe(8);
    expect(legacy.categories.pain_amplification.score).toBe(7);
    expect(legacy.categories.offer_explanation.score).toBe(6);
    expect(legacy.categories.objection_handling.score).toBe(9);
    expect(legacy.categories.overall_close_quality.score).toBe(8);
    expect(legacy.categories.urgency_close_attempt.score).toBe(6);
    expect(legacy.categories.next_steps_clarity.score).toBe(6);
    expect(legacy.strengths[0]).toContain('Good discovery');
    expect(legacy.weaknesses[0]).toContain('Value gap');
    expect(legacy.rubric_v2).toEqual(result);
    expect(legacy.rubric_version).toBe('v2');
  });

  it('writes v2 analysis metadata into the call_scores row without dropping rubric or legacy fields', () => {
    const metadata = buildAnalysisMetadata({
      analyzedCharacterCount: 1200,
      fullTranscriptCharacterCount: 1200,
      chunksAnalyzed: 1,
      totalChunks: 1,
    });
    const result = validateAndParseForTest(JSON.stringify(baseModelResult()), { analysisMetadata: metadata });
    const row = buildScoreRowForTest({
      callId: 'call-1',
      requestId: 'request-1',
      result,
      repName: 'Callum',
      callTitle: 'Test call',
    });

    expect(row.analysis_metadata).toEqual(metadata);
    expect(row.rubric_version).toBe('v2');
    expect(row.rubric_v2).toBeTruthy();
    expect(row.rubric_v2.category_scores).toHaveLength(11);
    expect(row.rubric_v2.score_calculation.method).toBe('deterministic_weighted_average');
    expect(row.overall_score).toBe(row.rubric_v2.overall_score);
    expect(row.score_total).toBe(row.rubric_v2.overall_score);
    expect(row.quality_label).toBeTruthy();
    expect(row.score_breakdown).toBeTruthy();
    expect(row.categories.discovery_quality).toBeTruthy();
    expect(row.strengths).toBeTruthy();
    expect(row.weaknesses).toBeTruthy();
    expect(Array.isArray(row.objection_scripts)).toBe(true);
  });

  it('preserves incomplete analysis metadata through v2 mapping instead of presenting it as complete', () => {
    const metadata = buildAnalysisMetadata({
      analyzedCharacterCount: 600,
      fullTranscriptCharacterCount: 1200,
      chunksAnalyzed: 1,
      totalChunks: 2,
    });
    const result = validateAndParseForTest(JSON.stringify(baseModelResult()), { analysisMetadata: metadata });
    const row = buildScoreRowForTest({ callId: 'call-1', requestId: 'request-1', result });

    expect(metadata.analysis_status).toBe('incomplete');
    expect(metadata.analysis_coverage_percentage).toBe(50);
    expect(row.analysis_metadata.analysis_status).toBe('incomplete');
    expect(row.rubric_v2.analysis_status).toBe('incomplete');
    expect(row.rubric_v2.category_scores[0].evidence[0].quote).not.toBe('Not observed in the full analyzed transcript.');
  });

  it('keeps old non-v2 score rows compatible when analysis metadata is absent', () => {
    const legacyResult: any = {
      overall_score: 72,
      quality_label: 'strong',
      outcome: 'no_sale',
      close_type: null,
      coach_summary: { did_well: [], needs_work: [], action_items: [] },
      categories: Object.fromEntries(['rapport_tone', 'discovery_quality', 'call_control', 'pain_amplification', 'offer_explanation', 'objection_handling', 'urgency_close_attempt', 'confidence_authority', 'next_steps_clarity', 'overall_close_quality'].map((key) => [key, { score: 7, reasoning: 'ok', evidence: 'evidence' }])),
      strengths: [],
      weaknesses: [],
      objections_detected: [],
      objections_handled_well: [],
      objections_missed: [],
      next_coaching_actions: [],
      coaching_markers: [],
    };

    const row = buildScoreRowForTest({ callId: 'call-1', requestId: 'request-1', result: legacyResult });

    expect(row.rubric_version).toBeNull();
    expect(row.rubric_v2).toBeNull();
    expect(row.analysis_metadata).toBeNull();
    expect(row.overall_score).toBe(72);
    expect(row.categories.discovery_quality).toBeTruthy();
  });
});
