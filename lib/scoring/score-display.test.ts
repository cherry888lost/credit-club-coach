/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';

import { buildScoreDisplayModel } from './score-display';

const v2CategoryNames = [
  'Opening and agenda setting',
  'Discovery and qualification',
  'Pain and problem awareness',
  'Solution explanation',
  'Value building',
  'Pitch and offer clarity',
  'Objection handling',
  'Closing skill',
  'Payment / commitment / next steps',
  'Compliance and professionalism',
  'Communication and call control',
];

const v2Categories = v2CategoryNames.map((name, index) => ({
  category_key: `v2_category_${index + 1}`,
  category_name: name,
  weight: index === 0 ? 5 : 10,
  score: index >= 6 && index <= 8 ? 4 : index === 2 ? 5 : 6,
  weighted_points: index === 0 ? 3 : index >= 6 && index <= 8 ? 4 : 6,
  what_happened: `V2 happened ${index + 1}`,
  why_this_score: `V2 reason ${index + 1}. Additional sentence that should be trimmed away from the compact reason.`,
  evidence: [{ timestamp: index === 0 ? null : '01:00', speaker: 'Rep', quote: `V2 quote ${index + 1}` }],
  coaching_feedback: `Fix ${name.toLowerCase()}`,
  improved_example_phrasing: index === 0 ? 'Before we get into it, I will ask a few questions then explain the next step.' : `V2 script ${index + 1}`,
}));

const legacyCategories = {
  call_control: { score: 4, reasoning: 'Legacy reason', evidence: 'Legacy evidence', improvement_tip: 'Legacy tip' },
  rapport_tone: { score: 7, reasoning: 'Legacy rapport', evidence: 'Legacy rapport evidence', improvement_tip: 'Legacy rapport tip' },
};

function baseScore(overrides: Record<string, any> = {}) {
  return {
    score_total: 62,
    overall_score: 62,
    quality_label: 'average',
    outcome: 'closed',
    close_type: 'full_close',
    manual_outcome: null,
    manual_close_type: null,
    coach_summary: {
      did_well: [
        'I do travel a lot. And what caught my attention was obviously paying for the premium...',
        'And just by opening your cards in that order you collect points faster...',
        'Built rapport again',
        'Extra win',
      ],
      needs_work: ['No clear close / next step', 'No solution explanation or value building', 'No clear close and next step'],
      action_items: ['Clearly explain the solution', 'Set a clear next step', 'Create urgency', 'Extra action'],
    },
    strengths: ['Built rapport'],
    weaknesses: ['No solution explanation / value building', 'Weak objection isolation'],
    missed_opportunities: ['No clear close / next step', 'Limited urgency discovery', 'No solution explanation or value building'],
    next_coaching_actions: ['Explain the offer clearly', 'Set a clear next step', 'Isolate objections', 'Extra recommendation'],
    objection_scripts: [
      { objection: 'Need to think', better_response: 'What part do you need to think about?' },
      { objection: 'Too expensive', better_response: '' },
      { objection: 'Partner', better_response: '[Full transcript] Bring the partner into the decision.' },
      { objection: 'Later', better_response: 'Book the next step now.' },
    ],
    coaching_markers: [
      { timestamp: null, title: 'Null timestamp should hide', feedback: '[Full transcript] Improve the close.' },
      { timestamp: '03:00', title: 'Good rapport', feedback: 'Strong opening.' },
      { timestamp: '04:00', title: 'Pain', feedback: 'Pain discovered.' },
      { timestamp: '05:00', title: 'Offer', feedback: 'Offer unclear.' },
      { timestamp: '06:00', title: 'Objection', feedback: 'Objection weak.' },
      { timestamp: '07:00', title: 'Close', feedback: 'No next step.' },
    ],
    categories: legacyCategories,
    rubric_v2: {
      rubric_version: 'v2',
      overall_score: 62,
      rep_facing_summary: 'This was an average call. The rep built rapport but no clear next step was secured. This extra sentence should be removed. This fourth sentence should also be removed.',
      manager_summary: 'Manager summary',
      deal_outcome: { final_outcome: 'deposit_collected', outcome_confidence: 'high' },
      category_scores: v2Categories,
      best_moments: [
        { summary: 'Built rapport quickly', quote: 'Nice opening' },
        { what_happened: 'Found some pain' },
        { coaching_feedback: 'Kept tone calm' },
        { summary: 'Extra v2 win' },
      ],
      missed_opportunities: [
        { issue: 'No solution explanation / value building', coaching_feedback: 'Explain what they get.' },
        { issue: 'No clear close / next step', coaching_feedback: 'Secure a date.' },
        { issue: 'Limited urgency discovery', coaching_feedback: 'Ask why now.' },
        { issue: 'Extra missed opportunity' },
      ],
      top_3_coaching_actions: [
        { action: 'Explain the solution in plain English.' },
        { action: 'Ask for the payment or book a firm next step.' },
        { action: 'Isolate the real objection.' },
        { action: 'Extra v2 action' },
      ],
      timestamped_key_moments: [
        { timestamp: null, moment: 'Null timestamp hidden', coaching_feedback: '[Full transcript] Do not show label.' },
        { timestamp: '01:00', moment: 'Rapport built' },
        { timestamp: '02:00', moment: 'Pain found' },
        { timestamp: '03:00', moment: 'Offer unclear' },
        { timestamp: '04:00', moment: 'Objection weak' },
        { timestamp: '05:00', moment: 'No close' },
      ],
    },
    ...overrides,
  };
}

describe('score page display model', () => {
  it('shows a compact rubric_v2 score breakdown with scores, weights, weighted points, and one-line reasons', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });

    expect(model.compactScoreBreakdown.source).toBe('rubric_v2');
    expect(model.compactScoreBreakdown.categories).toHaveLength(11);
    expect(model.compactScoreBreakdown.categories[0]).toMatchObject({
      name: 'Opening and agenda setting',
      score: 6,
      maxScore: 10,
      weight: 5,
      weightedPoints: 3,
      reason: 'V2 reason 1.',
    });
    expect(model.compactScoreBreakdown.strongestAreas.map((area) => area.name)).toContain('Discovery and qualification');
    expect(model.compactScoreBreakdown.lowestAreas.map((area) => area.name)).toEqual([
      'Objection handling',
      'Closing skill',
      'Payment / commitment / next steps',
    ]);
  });

  it('keeps compact category scores visible to non-admins without exposing detailed category cards', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });

    expect(model.compactScoreBreakdown.categories).toHaveLength(11);
    expect(model.categoryDiagnostics.categories).toHaveLength(0);
    expect(JSON.stringify(model.compactScoreBreakdown)).not.toContain('V2 quote');
  });

  it('limits quick verdict to six useful sentences and keeps key moments out of the simple view', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });

    expect(model.quickVerdict).toContain('deposit-collected outcome');
    expect(model.quickVerdict).toContain('score stayed mid-range');
    expect(model.quickVerdict.split('.').filter(Boolean)).toHaveLength(5);
    expect(model.showKeyMomentsInSimpleView).toBe(false);
    expect(model.adminDiagnostics?.keyMomentsAvailable).toBeUndefined();
  });

  it('summarizes wins instead of showing long raw transcript chunks', () => {
    const model = buildScoreDisplayModel(baseScore({ rubric_v2: null }), { isAdmin: false });

    expect(model.wins).toContain('Connected the conversation to the prospect’s travel goals.');
    expect(model.wins).toContain('Explained card sequencing and points accumulation clearly.');
    expect(model.wins.join(' ')).not.toContain('what caught my attention');
  });

  it('turns rubric_v2 best moment quotes into coaching summaries for closers', () => {
    const model = buildScoreDisplayModel(baseScore({
      rubric_v2: {
        ...baseScore().rubric_v2,
        deal_outcome: { final_outcome: 'partial_access', outcome_confidence: 'high' },
        best_moments: [
          { quote: 'Have you got good or bad credit? Let’s start there.' },
          { quote: "Yeah, once you go business, it's hard to go back to economy, isn't It was." },
          { quote: "Okay, lovely. Perfect. So one thing I'm very honest and upfront with everyone, we can't get you unlimited flights." },
        ],
      },
    }), { isAdmin: false });

    expect(model.wins).toEqual([
      'Opened discovery by asking directly about the prospect’s credit position.',
      'Connected the programme to the prospect’s travel goals and desire for business-class flights.',
      'Built trust by setting realistic expectations instead of overpromising.',
    ]);
  });

  it('builds a structured v2 quick verdict instead of using stale chunk summaries', () => {
    const model = buildScoreDisplayModel(baseScore({
      score_total: 60,
      rubric_v2: {
        ...baseScore().rubric_v2,
        overall_score: 60,
        rep_facing_summary: 'No offer or closing attempts were observed in this transcript segment. This stale chunk summary should not drive the verdict.',
        deal_outcome: { final_outcome: 'partial_access', outcome_confidence: 'high' },
        category_scores: v2Categories.map((category) => category.category_name === 'Objection handling'
          ? { ...category, score: 3, why_this_score: 'Weak objection isolation.' }
          : category),
        missed_opportunities: [
          { issue: 'No explicit agenda setting or call structure introduction' },
          { issue: 'Limited probing on motivation, urgency, and affordability' },
        ],
        top_3_coaching_actions: [{ action: 'Set the agenda upfront and explain the next step clearly.' }],
      },
    }), { isAdmin: false });

    expect(model.quickVerdict).toContain('Partial Access close');
    expect(model.quickVerdict).toContain('score stayed mid-range');
    expect(model.quickVerdict).toContain('Next time');
    expect(model.quickVerdict.toLowerCase()).not.toContain('no offer or closing attempts');
    expect(model.quickVerdict.split('.').filter(Boolean).length).toBeGreaterThanOrEqual(4);
    expect(model.quickVerdict.split('.').filter(Boolean).length).toBeLessThanOrEqual(6);
  });

  it('labels better scripts and removes empty script boxes', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });

    expect(model.betterScripts.every((script) => script.text.trim().length > 0)).toBe(true);
    expect(model.betterScripts.map((script) => script.label)).toEqual([
      'Agenda script',
      'Discovery script',
      'Deposit close script',
    ]);
    expect(JSON.stringify(model.betterScripts)).not.toContain('""');
  });

  it('uses compact legacy score breakdown when rubric_v2 is null and does not mix sources', () => {
    const model = buildScoreDisplayModel(baseScore({ rubric_v2: null }), { isAdmin: false });

    expect(model.compactScoreBreakdown.source).toBe('legacy');
    expect(model.compactScoreBreakdown.categories.map((category) => category.name)).toEqual(['Call Control', 'Rapport & Tone']);
    expect(model.compactScoreBreakdown.categories[0]).toMatchObject({ score: 4, maxScore: 10, weight: null, weightedPoints: null });
  });

  it('hides admin diagnostics and full category cards from non-admin closers', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });

    expect(model.adminDiagnostics).toBeNull();
    expect(model.categoryDiagnostics.visibleToCloser).toBe(false);
    expect(model.categoryDiagnostics.categories).toHaveLength(0);
  });

  it('keeps detailed category diagnostics available but collapsed for admins', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: true });

    expect(model.adminDiagnostics).not.toBeNull();
    expect(model.categoryDiagnostics.collapsedByDefault).toBe(true);
    expect(model.categoryDiagnostics.source).toBe('rubric_v2');
    expect(model.categoryDiagnostics.label).toBe('Detailed Category Breakdown (11 v2 categories)');
    expect(model.categoryDiagnostics.categories).toHaveLength(11);
  });

  it('prefers rubric_v2 category data and does not mix legacy categories when v2 exists', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: true });

    expect(model.categoryDiagnostics.categories.map((category) => category.name)).toContain('Opening and agenda setting');
    expect(model.categoryDiagnostics.categories.map((category) => category.name)).not.toContain('Call Control');
  });

  it('falls back to legacy category data when rubric_v2 is null', () => {
    const model = buildScoreDisplayModel(baseScore({ rubric_v2: null }), { isAdmin: true });

    expect(model.categoryDiagnostics.source).toBe('legacy');
    expect(model.categoryDiagnostics.label).toBe('Detailed Category Breakdown (2 legacy categories)');
    expect(model.categoryDiagnostics.categories.map((category) => category.name)).toEqual(['Call Control', 'Rapport & Tone']);
  });

  it('deduplicates repeated advice across summary, weaknesses, missed opportunities, recommendations, and categories', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });
    const allCloserText = [
      ...model.wins,
      ...model.missedOpportunities,
      ...model.nextActions,
    ].join('\n').toLowerCase();

    expect((allCloserText.match(/solution explanation|explain the solution|offer clearly|value building/g) || []).length).toBeLessThanOrEqual(1);
    expect((allCloserText.match(/clear next step|firm next step|secure a date/g) || []).length).toBeLessThanOrEqual(1);
  });

  it('explains manager and AI outcome differences clearly, and collapses matching partial access outcomes', () => {
    const matching = buildScoreDisplayModel(baseScore({
      manual_outcome: 'closed',
      manual_close_type: 'partial_access',
      close_type: 'partial_access',
      rubric_v2: {
        ...baseScore().rubric_v2,
        deal_outcome: { final_outcome: 'partial_access', outcome_confidence: 'high' },
      },
    }), { isAdmin: false });
    expect(matching.outcome.primaryLabel).toBe('Partial Access Closed');
    expect(matching.outcome.secondaryLabel).toBeNull();

    const different = buildScoreDisplayModel(baseScore({
      manual_outcome: 'closed',
      manual_close_type: 'partial_access',
      close_type: null,
      rubric_v2: {
        ...baseScore().rubric_v2,
        deal_outcome: { final_outcome: 'no_sale', outcome_confidence: 'medium' },
      },
    }), { isAdmin: false });
    expect(different.outcome.primaryLabel).toBe('Manager Outcome: Partial Access Closed');
    expect(different.outcome.secondaryLabel).toBe('AI Detected Outcome: No Sale');
  });

  it('hides empty scripts, null timestamps, and Full transcript labels from rep-facing display', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });
    const serialized = JSON.stringify(model);

    expect(model.betterScripts.every((script) => script.text.trim().length > 0)).toBe(true);
    expect(serialized).not.toContain('[Full transcript]');
    expect(serialized).not.toContain('"timestamp":"null"');
    expect(serialized).not.toContain('null timestamp hidden');
  });

  it('enforces closer-facing list limits', () => {
    const model = buildScoreDisplayModel(baseScore(), { isAdmin: false });

    expect(model.wins.length).toBeLessThanOrEqual(3);
    expect(model.missedOpportunities.length).toBeLessThanOrEqual(3);
    expect(model.nextActions.length).toBeLessThanOrEqual(3);
    expect(model.betterScripts.length).toBeLessThanOrEqual(3);
    expect(model.keyMoments.length).toBeLessThanOrEqual(5);
  });

  it('does not show unexplained contradictory outcome badges', () => {
    const model = buildScoreDisplayModel(baseScore({ manual_outcome: 'no_sale', close_type: 'full_close' }), { isAdmin: false });

    expect(model.outcome.primaryLabel).toBe('Manager Outcome: No Sale');
    expect(model.outcome.secondaryLabel).toBe('AI Detected Outcome: Deposit Collected');
    expect(model.outcome.badges).not.toEqual(expect.arrayContaining(['Full Close', 'No Sale']));
  });
});
