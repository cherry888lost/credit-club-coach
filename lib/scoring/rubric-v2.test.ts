/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_WEIGHTS_V2,
  buildRubricV2Prompt,
  buildRubricV2Result,
  calculateWeightedScore,
  mapRubricV2ToLegacy,
  normalizeCategoryEvidence,
} from './rubric-v2';
import { buildAnalysisMetadata, buildClaimFiltersForTest, buildScoreRowForTest, validateAndParseForTest } from './worker';

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

  it('detects partial access/deposit/payment phrases as a close commitment from the transcript', () => {
    const raw = baseModelResult({
      closing_skill: 3,
      payment_commitment_next_steps: 3,
      pitch_offer_clarity: 4,
    });
    raw.deal_outcome = {
      ...raw.deal_outcome,
      final_outcome: 'no_sale',
      offer_pitched: false,
      price_discussed: false,
      close_attempted: false,
      deposit_collected: false,
      evidence: [],
    };
    raw.category_scores = categoryScores({
      closing_skill: 3,
      payment_commitment_next_steps: 3,
      pitch_offer_clarity: 4,
    }).map((category) => {
      if (category.category_key === 'closing_skill') {
        return { ...category, why_this_score: 'Closing not attempted yet.', coaching_feedback: 'Ask clearly for payment.' };
      }
      if (category.category_key === 'payment_commitment_next_steps') {
        return { ...category, why_this_score: 'No payment or commitment observed.', coaching_feedback: 'Secure a deposit.' };
      }
      if (category.category_key === 'pitch_offer_clarity') {
        return { ...category, why_this_score: 'Offer and price not discussed yet.' };
      }
      return category;
    });
    raw.missed_opportunities = [{ issue: 'No close attempt made', coaching_feedback: 'Ask for the close.' }];
    raw.top_3_coaching_actions = [{ action: 'Close the customer before ending the call.' }];

    const transcript = `
      Rep: So I'll tell you pricing, we normally charge £4,000, but today it is £3,000.
      Rep: We have this thing called partial access. What the partial access is, is you pay us £500.
      Prospect: Okay, let's do that one then.
      Rep: I sent you the payment link, bro, for the 500.
      Prospect: Yes, it's open, I'm just making the payment now.
      Rep: I think that was you that just come through as well, perfect, I can tick it off.
      Rep: He's just joined us on a partial access, let's get the ball rolling.
    `;

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100, transcript });
    const legacy = mapRubricV2ToLegacy(result);
    const allFeedback = JSON.stringify(result).toLowerCase();

    expect(result.deal_outcome.final_outcome).toBe('partial_access');
    expect(result.deal_outcome.offer_pitched).toBe(true);
    expect(result.deal_outcome.price_discussed).toBe(true);
    expect(result.deal_outcome.close_attempted).toBe(true);
    expect(result.deal_outcome.deposit_collected).toBe(true);
    expect(result.deal_outcome.onboarding_or_next_step_completed).toBe(true);
    expect(result.category_scores.find((c) => c.category_key === 'closing_skill')?.score).toBeGreaterThanOrEqual(6);
    expect(result.category_scores.find((c) => c.category_key === 'payment_commitment_next_steps')?.score).toBeGreaterThanOrEqual(7);
    expect(legacy.outcome).toBe('closed');
    expect(legacy.close_type).toBe('partial_access');
    expect(allFeedback).not.toContain('no close attempt');
    expect(allFeedback).not.toContain('no closing skill observed');
    expect(allFeedback).not.toContain('no evidence of payment');
    expect(allFeedback).not.toContain('no payment or commitment observed');
    expect(allFeedback).not.toContain('no payment or commitment activity observed');
    expect(allFeedback).not.toContain('closing skill was not demonstrated');
    expect(allFeedback).not.toContain('pitch and offer clarity was not present');
  });

  it('does not regress no-sale calls into closed outcomes without close evidence', () => {
    const raw = baseModelResult({ closing_skill: 2, payment_commitment_next_steps: 2 });
    const result = buildRubricV2Result(raw, {
      analysisCoveragePercentage: 100,
      transcript: 'Prospect: I am not interested right now. Rep: No problem, thanks for your time.',
    });

    expect(result.deal_outcome.final_outcome).not.toBe('partial_access');
    expect(result.deal_outcome.close_attempted).toBe(false);
    expect(mapRubricV2ToLegacy(result).outcome).toBe('no_sale');
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

  it('removes benchmark and previous-call names from user-facing coaching advice while preserving current-call evidence quotes', () => {
    const raw = baseModelResult({ objection_handling: 4, closing_skill: 4 });
    raw.manager_summary = 'Use benchmark Georgia Smith\'s approach to isolate the objection before responding.';
    raw.rep_facing_summary = 'Attempt a deposit close as Georgia Smith did, but keep it natural.';
    raw.category_scores = categoryScores({ objection_handling: 4, closing_skill: 4 }).map((category) => {
      if (category.category_key !== 'objection_handling') return category;
      return {
        ...category,
        coaching_feedback: 'Handle pricing objections by isolating and reframing as in Omar Pike\'s call.',
        improved_example_phrasing: 'Do not copy Example Rep; ask what is holding them back.',
        evidence: [{ timestamp: '12:00', speaker: 'Prospect', quote: 'Georgia Smith told me to ask about the programme.' }],
      };
    });
    raw.best_moments = [{ timestamp: '08:00', title: 'Current-call quote', quote: 'Previous Customer is my business partner.', why_it_was_strong: 'Used current-call evidence only.' }];
    raw.missed_opportunities = [{ timestamp: '22:00', issue: 'Benchmark Georgia Smith close missed', coaching_feedback: 'Use benchmark Georgia Smith\'s approach to isolate objections.', what_to_do_instead: 'Ask clearly, not like Omar Pike.' }];
    raw.top_3_coaching_actions = [{ priority: 1, skill: 'Deposit close', action: 'Attempt a deposit close as Georgia Smith did.', practice_drill: 'Do not copy Example Rep.', example_phrase: 'Secure your place with a £500 deposit.' }];

    const result = buildRubricV2Result(raw, { analysisCoveragePercentage: 100 });
    const legacy = mapRubricV2ToLegacy(result);
    const userFacingAdvice = JSON.stringify({
      manager_summary: result.manager_summary,
      rep_facing_summary: result.rep_facing_summary,
      top_3_coaching_actions: result.top_3_coaching_actions,
      missed_opportunities: result.missed_opportunities,
      categories: result.category_scores.map((category) => ({
        coaching_feedback: category.coaching_feedback,
        improved_example_phrasing: category.improved_example_phrasing,
      })),
      coach_summary: {
        needs_work: legacy.coach_summary.needs_work,
        action_items: legacy.coach_summary.action_items,
        manager_summary: legacy.coach_summary.manager_summary,
        rep_facing_summary: legacy.coach_summary.rep_facing_summary,
      },
      enhanced_weaknesses: legacy.enhanced_weaknesses,
      objection_scripts: (legacy.objection_scripts || []).map((script: any) => ({
        better_response: script.better_response,
        technique: script.technique,
      })),
    });

    expect(userFacingAdvice).not.toMatch(/Georgia Smith|Omar Pike|Example Rep|Previous Customer/);
    expect(userFacingAdvice).not.toMatch(/as\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+did/);
    expect(userFacingAdvice).not.toMatch(/benchmark\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i);
    expect(userFacingAdvice).not.toMatch(/copy\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i);
    expect(result.category_scores.find((category) => category.category_key === 'objection_handling')?.evidence[0].quote).toContain('Georgia Smith');
    expect(result.best_moments[0].quote).toContain('Previous Customer');
    expect(legacy.rubric_v2).toEqual(result);
    expect(legacy.categories.objection_handling).toBeTruthy();
  });

  it('treats benchmark context as internal guidance without exposing source names in prompts', () => {
    const prompt = buildRubricV2Prompt({
      transcript: 'Rep: The deposit is £500. Prospect: I need to think about it.',
      repName: 'Current Rep',
      benchmarkContext: 'Use benchmark Georgia Smith\'s approach. Handle pricing objections as in Omar Pike\'s call. Previous Customer accepted after this close.',
      knowledgeContext: 'A stronger approach would be to isolate the objection, then ask for a deposit commitment.',
    });

    expect(prompt).toContain('Benchmark and pattern-library examples are internal guidance only');
    expect(prompt).toContain('isolate the objection');
    expect(prompt).not.toMatch(/Georgia Smith|Omar Pike|Previous Customer/);
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

  it('only claims pending or stale processing requests, never actively-processing requests', () => {
    const filters = decodeURIComponent(buildClaimFiltersForTest('request-1', 15, new Date('2026-06-19T22:00:00.000Z')));

    expect(filters).toContain('id=eq.request-1');
    expect(filters).toContain('status.eq.pending');
    expect(filters).toContain('and(status.eq.processing,updated_at.lt.2026-06-19T21:45:00.000Z)');
    expect(filters).not.toContain('status.eq.processing)');
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
