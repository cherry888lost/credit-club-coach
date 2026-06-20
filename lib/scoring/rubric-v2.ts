/* eslint-disable @typescript-eslint/no-explicit-any */
export const RUBRIC_VERSION_V2 = 'v2' as const;

export type OutcomeConfidence = 'high' | 'medium' | 'low';
export type DealFinalOutcome =
  | 'payment_collected'
  | 'deposit_collected'
  | 'payment_plan_arranged'
  | 'follow_up_booked'
  | 'no_sale'
  | 'unclear';
export type ComplianceSeverity = 'low' | 'medium' | 'high';

export interface RubricV2CategoryDefinition {
  key: string;
  name: string;
  weight: number;
  legacyAliases: string[];
}

export const CATEGORY_WEIGHTS_V2: RubricV2CategoryDefinition[] = [
  { key: 'opening_agenda', name: 'Opening and agenda setting', weight: 5, legacyAliases: ['call_control'] },
  { key: 'discovery_qualification', name: 'Discovery and qualification', weight: 15, legacyAliases: ['discovery_quality'] },
  { key: 'pain_problem_awareness', name: 'Pain and problem awareness', weight: 10, legacyAliases: ['pain_amplification'] },
  { key: 'solution_explanation', name: 'Solution explanation', weight: 10, legacyAliases: ['offer_explanation'] },
  { key: 'value_building', name: 'Value building', weight: 10, legacyAliases: ['confidence_authority'] },
  { key: 'pitch_offer_clarity', name: 'Pitch and offer clarity', weight: 10, legacyAliases: ['offer_explanation'] },
  { key: 'objection_handling', name: 'Objection handling', weight: 15, legacyAliases: ['objection_handling'] },
  { key: 'closing_skill', name: 'Closing skill', weight: 10, legacyAliases: ['overall_close_quality'] },
  { key: 'payment_commitment_next_steps', name: 'Payment / commitment / next steps', weight: 5, legacyAliases: ['urgency_close_attempt', 'next_steps_clarity'] },
  { key: 'compliance_professionalism', name: 'Compliance and professionalism', weight: 5, legacyAliases: [] },
  { key: 'communication_call_control', name: 'Communication and call control', weight: 5, legacyAliases: ['rapport_tone', 'call_control', 'confidence_authority'] },
];

export interface RubricV2Evidence {
  timestamp?: string | null;
  speaker?: string | null;
  quote: string;
}

export interface RubricV2CategoryInput {
  category_key: string;
  category_name?: string;
  weight?: number;
  score: number;
  weighted_points?: number;
  what_happened?: string;
  why_this_score?: string;
  evidence?: RubricV2Evidence[];
  coaching_feedback?: string;
  improved_example_phrasing?: string;
}

export interface RubricV2CategoryScore extends Required<Omit<RubricV2CategoryInput, 'evidence'>> {
  evidence: RubricV2Evidence[];
}

export interface DealOutcomeEvidence extends RubricV2Evidence {
  why_it_matters?: string;
}

export interface RubricV2DealOutcome {
  final_outcome: DealFinalOutcome;
  outcome_confidence: OutcomeConfidence;
  offer_pitched: boolean;
  price_discussed: boolean;
  close_attempted: boolean;
  payment_collected: boolean;
  deposit_collected: boolean;
  payment_plan_arranged: boolean;
  follow_up_booked: boolean;
  onboarding_or_next_step_completed: boolean;
  evidence: DealOutcomeEvidence[];
}

export interface ComplianceFlag {
  severity: ComplianceSeverity;
  issue: string;
  evidence: string;
  timestamp?: string | null;
  safer_wording: string;
}

export interface ScoreCalculation {
  method: 'deterministic_weighted_average';
  max_score: 100;
  category_weight_total: 100;
  raw_score: number;
  score_cap_applied: boolean;
  score_cap_reason: string | null;
}

export interface RubricV2Result {
  rubric_version: typeof RUBRIC_VERSION_V2;
  analysis_status: 'complete' | 'partial' | 'incomplete';
  overall_score: number;
  score_calculation: ScoreCalculation;
  deal_outcome: RubricV2DealOutcome;
  category_scores: RubricV2CategoryScore[];
  best_moments: any[];
  missed_opportunities: any[];
  top_3_coaching_actions: any[];
  compliance_flags: ComplianceFlag[];
  manager_summary: string;
  rep_facing_summary: string;
  timestamped_key_moments: any[];
}

export interface RubricV2BuildOptions {
  analysisCoveragePercentage?: number | null;
}

const BENCHMARK_SOURCE_NAMES = [
  'Bina Patel',
  'Luke Cockle',
  'Emma Foster',
  'Omar Pike',
  'Fernando Cotrim',
  'Georgia Smith',
  'Mohit Garg',
  'Rachel',
  'Andrika Das',
  'Shamil Morjaria',
  'Nirmohan Singh Grover',
  'Prismek Wegroc',
  'Example Rep',
  'Previous Customer',
];

const BENCHMARK_SOURCE_NAME_PATTERN = BENCHMARK_SOURCE_NAMES
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');
const BENCHMARK_SOURCE_NAME_REGEX = new RegExp(`\\b(?:${BENCHMARK_SOURCE_NAME_PATTERN})\\b`, 'gi');
const ATTRIBUTION_NAME_REGEX = `[A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+){0,4}`;

export function sanitizeBenchmarkContext(text: string): string {
  return sanitizeSourceAttributionText(text);
}

function sanitizeSourceAttributionText(value: string): string {
  return value
    .replace(new RegExp(`\\bUse\\s+benchmark\\s+${ATTRIBUTION_NAME_REGEX}(?:'s)?\\s+approach\\s+to\\s+`, 'g'), '')
    .replace(new RegExp(`\\buse\\s+benchmark\\s+${ATTRIBUTION_NAME_REGEX}(?:'s)?\\s+approach\\s+to\\s+`, 'gi'), '')
    .replace(new RegExp(`\\bbenchmark\\s+${ATTRIBUTION_NAME_REGEX}(?:'s)?\\s+approach\\s+to\\s+`, 'gi'), '')
    .replace(new RegExp(`\\bas\\s+${ATTRIBUTION_NAME_REGEX}\\s+did\\b`, 'g'), '')
    .replace(new RegExp(`\\bas\\s+in\\s+${ATTRIBUTION_NAME_REGEX}(?:'s)?\\s+call\\b`, 'gi'), '')
    .replace(new RegExp(`\\bin\\s+${ATTRIBUTION_NAME_REGEX}(?:'s)?\\s+call\\b`, 'g'), '')
    .replace(new RegExp(`\\bcopy\\s+${ATTRIBUTION_NAME_REGEX}\\b`, 'gi'), 'use this structure')
    .replace(new RegExp(`\\blike\\s+${ATTRIBUTION_NAME_REGEX}\\b`, 'gi'), 'using this structure')
    .replace(new RegExp(`\\bbenchmark\\s+${ATTRIBUTION_NAME_REGEX}\\b`, 'gi'), 'benchmark example')
    .replace(BENCHMARK_SOURCE_NAME_REGEX, 'a strong example')
    .replace(/\bbenchmark example\b/gi, 'internal example')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .trim();
}

function sanitizeAdviceValue<T>(value: T): T {
  if (typeof value === 'string') return sanitizeSourceAttributionText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeAdviceValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeAdviceValue(entry)])
    ) as T;
  }
  return value;
}

function sanitizeMomentAdviceArray(value: unknown): any[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return sanitizeAdviceValue(item);
    const record = item as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record).map(([key, entry]) => {
        if (key === 'quote' || key === 'timestamp' || key === 'speaker') return [key, entry];
        return [key, sanitizeAdviceValue(entry)];
      })
    );
  });
}

export function clampCategoryScore(score: unknown): number {
  const numeric = typeof score === 'number' && Number.isFinite(score) ? score : 1;
  return Math.max(1, Math.min(10, Math.round(numeric)));
}

export function normalizeCategoryEvidence(evidence: unknown, analysisCoveragePercentage?: number | null): RubricV2Evidence[] {
  if (Array.isArray(evidence) && evidence.length > 0) {
    return evidence.map((entry) => {
      const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      return {
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : null,
        speaker: typeof item.speaker === 'string' ? item.speaker : null,
        quote: typeof item.quote === 'string' && item.quote.trim()
          ? item.quote.trim()
          : missingEvidenceQuote(analysisCoveragePercentage),
      };
    });
  }

  return [{ timestamp: null, speaker: null, quote: missingEvidenceQuote(analysisCoveragePercentage) }];
}

function missingEvidenceQuote(analysisCoveragePercentage?: number | null): string {
  return analysisCoveragePercentage === 100
    ? 'Not observed in the full analyzed transcript.'
    : 'Not observed in the analyzed transcript segment. Do not conclude this was absent from the full call.';
}

export function calculateWeightedScore(
  categoryInputs: RubricV2CategoryInput[],
  complianceFlags: ComplianceFlag[] = [],
  options: RubricV2BuildOptions = {}
): { overallScore: number; categoryScores: RubricV2CategoryScore[]; scoreCalculation: ScoreCalculation } {
  const categoryScores = CATEGORY_WEIGHTS_V2.map((definition) => {
    const input = categoryInputs.find((category) => category.category_key === definition.key);
    const score = clampCategoryScore(input?.score);
    const weightedPoints = roundScore((score / 10) * definition.weight);

    return {
      category_key: definition.key,
      category_name: definition.name,
      weight: definition.weight,
      score,
      weighted_points: weightedPoints,
      what_happened: input?.what_happened || missingEvidenceQuote(options.analysisCoveragePercentage),
      why_this_score: input?.why_this_score || 'Score based on the rubric evidence available in the analyzed transcript.',
      evidence: normalizeCategoryEvidence(input?.evidence, options.analysisCoveragePercentage),
      coaching_feedback: sanitizeAdviceValue(input?.coaching_feedback || 'No specific coaching feedback returned; manager review recommended.'),
      improved_example_phrasing: sanitizeAdviceValue(input?.improved_example_phrasing || ''),
    };
  });

  const rawScore = roundScore(categoryScores.reduce((sum, category) => sum + category.weighted_points, 0));
  const cap = getComplianceScoreCap(complianceFlags);
  const cappedScore = cap.cap == null ? rawScore : Math.min(rawScore, cap.cap);
  const overallScore = Math.round(cappedScore);

  return {
    overallScore,
    categoryScores,
    scoreCalculation: {
      method: 'deterministic_weighted_average',
      max_score: 100,
      category_weight_total: 100,
      raw_score: rawScore,
      score_cap_applied: cap.cap != null && rawScore > cap.cap,
      score_cap_reason: cap.reason,
    },
  };
}

export function buildRubricV2Result(raw: any, options: RubricV2BuildOptions = {}): RubricV2Result {
  const complianceFlags = normalizeComplianceFlags(raw?.compliance_flags);
  const calculated = calculateWeightedScore(raw?.category_scores || [], complianceFlags, options);
  const sanitizedMissedOpportunities = sanitizeMomentAdviceArray(raw?.missed_opportunities);
  const sanitizedCoachingActions = sanitizeAdviceValue(
    Array.isArray(raw?.top_3_coaching_actions) ? raw.top_3_coaching_actions.slice(0, 3) : []
  );

  return {
    rubric_version: RUBRIC_VERSION_V2,
    analysis_status: raw?.analysis_status === 'partial' || raw?.analysis_status === 'incomplete' ? raw.analysis_status : 'complete',
    overall_score: calculated.overallScore,
    score_calculation: calculated.scoreCalculation,
    deal_outcome: normalizeDealOutcome(raw?.deal_outcome),
    category_scores: calculated.categoryScores,
    best_moments: sanitizeMomentAdviceArray(raw?.best_moments),
    missed_opportunities: sanitizedMissedOpportunities,
    top_3_coaching_actions: sanitizedCoachingActions,
    compliance_flags: complianceFlags,
    manager_summary: sanitizeAdviceValue(typeof raw?.manager_summary === 'string' ? raw.manager_summary : ''),
    rep_facing_summary: sanitizeAdviceValue(typeof raw?.rep_facing_summary === 'string' ? raw.rep_facing_summary : ''),
    timestamped_key_moments: sanitizeMomentAdviceArray(raw?.timestamped_key_moments),
  };
}

function normalizeComplianceFlags(flags: unknown): ComplianceFlag[] {
  if (!Array.isArray(flags)) return [];

  return flags
    .map((flag) => flag && typeof flag === 'object' ? flag as Record<string, unknown> : null)
    .filter((flag): flag is Record<string, unknown> => Boolean(flag))
    .map((flag): ComplianceFlag => ({
      severity: flag.severity === 'high' || flag.severity === 'medium' || flag.severity === 'low' ? flag.severity : 'low',
      issue: typeof flag.issue === 'string' ? flag.issue : 'Compliance coaching issue',
      evidence: typeof flag.evidence === 'string' ? flag.evidence : '',
      timestamp: typeof flag.timestamp === 'string' ? flag.timestamp : null,
      safer_wording: typeof flag.safer_wording === 'string' ? flag.safer_wording : '',
    }))
    .filter((flag) => flag.evidence.trim().length > 0);
}

function getComplianceScoreCap(flags: ComplianceFlag[]): { cap: number | null; reason: string | null } {
  const highFlagsWithEvidence = flags.filter((flag) => flag.severity === 'high' && flag.evidence.trim().length > 0).length;
  if (highFlagsWithEvidence >= 2) {
    return { cap: 65, reason: 'Multiple high-severity compliance flags with transcript evidence.' };
  }
  if (highFlagsWithEvidence === 1) {
    return { cap: 75, reason: 'High-severity compliance flag with transcript evidence.' };
  }
  return { cap: null, reason: null };
}

function normalizeDealOutcome(outcome: any): RubricV2DealOutcome {
  const finalOutcome: DealFinalOutcome = isDealFinalOutcome(outcome?.final_outcome) ? outcome.final_outcome : inferFinalOutcome(outcome);

  return {
    final_outcome: finalOutcome,
    outcome_confidence: outcome?.outcome_confidence === 'high' || outcome?.outcome_confidence === 'medium' || outcome?.outcome_confidence === 'low'
      ? outcome.outcome_confidence
      : 'low',
    offer_pitched: Boolean(outcome?.offer_pitched),
    price_discussed: Boolean(outcome?.price_discussed),
    close_attempted: Boolean(outcome?.close_attempted),
    payment_collected: Boolean(outcome?.payment_collected) || finalOutcome === 'payment_collected',
    deposit_collected: Boolean(outcome?.deposit_collected) || finalOutcome === 'deposit_collected',
    payment_plan_arranged: Boolean(outcome?.payment_plan_arranged) || finalOutcome === 'payment_plan_arranged',
    follow_up_booked: Boolean(outcome?.follow_up_booked) || finalOutcome === 'follow_up_booked',
    onboarding_or_next_step_completed: Boolean(outcome?.onboarding_or_next_step_completed),
    evidence: normalizeOutcomeEvidence(outcome?.evidence),
  };
}

function isDealFinalOutcome(value: unknown): value is DealFinalOutcome {
  return value === 'payment_collected'
    || value === 'deposit_collected'
    || value === 'payment_plan_arranged'
    || value === 'follow_up_booked'
    || value === 'no_sale'
    || value === 'unclear';
}

function inferFinalOutcome(outcome: any): DealFinalOutcome {
  if (outcome?.payment_collected) return 'payment_collected';
  if (outcome?.deposit_collected) return 'deposit_collected';
  if (outcome?.payment_plan_arranged) return 'payment_plan_arranged';
  if (outcome?.follow_up_booked) return 'follow_up_booked';
  return 'unclear';
}

function normalizeOutcomeEvidence(evidence: unknown): DealOutcomeEvidence[] {
  if (!Array.isArray(evidence)) return [];
  return evidence.map((entry) => {
    const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
    return {
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : null,
      speaker: typeof item.speaker === 'string' ? item.speaker : null,
      quote: typeof item.quote === 'string' ? item.quote : '',
      why_it_matters: typeof item.why_it_matters === 'string' ? item.why_it_matters : undefined,
    };
  }).filter((entry) => entry.quote.trim().length > 0);
}

export function mapRubricV2ToLegacy(result: RubricV2Result): any {
  const categoryByKey = new Map(result.category_scores.map((category) => [category.category_key, category]));
  const legacyCategory = (legacyKey: string, sourceKeys: string[]) => {
    const matched = sourceKeys
      .map((key) => categoryByKey.get(key))
      .filter((category): category is RubricV2CategoryScore => Boolean(category));
    const source = matched[0] || result.category_scores[0];
    const avgScore = matched.length > 1
      ? Math.round(matched.reduce((sum, category) => sum + category.score, 0) / matched.length)
      : source.score;

    return {
      score: avgScore,
      reasoning: source.why_this_score,
      evidence: source.evidence.map((entry) => entry.quote).join(' | '),
      improvement_tip: source.coaching_feedback,
      source_v2_categories: matched.map((category) => category.category_key),
      legacy_alias: legacyKey,
    };
  };

  const outcome = mapOutcome(result.deal_outcome.final_outcome);
  const closeType = mapCloseType(result.deal_outcome.final_outcome);
  const bestMoments = result.best_moments.map(momentToText).filter(Boolean);
  const missed = result.missed_opportunities.map(momentToText).filter(Boolean);
  const actions = result.top_3_coaching_actions.map(momentToText).filter(Boolean);
  const objectionCategory = categoryByKey.get('objection_handling');
  const objectionScripts = objectionCategory
    ? [{
      objection: objectionCategory.evidence[0]?.quote || 'Objection handling coaching',
      prospect_said: objectionCategory.evidence[0]?.quote || '',
      rep_said: objectionCategory.what_happened,
      better_response: objectionCategory.improved_example_phrasing || objectionCategory.coaching_feedback,
      technique: 'Acknowledge, clarify, isolate, respond, and confirm next step',
    }]
    : [];

  return {
    overall_score: result.overall_score,
    score_total: result.overall_score,
    quality_label: getQualityLabel(result.overall_score),
    outcome,
    close_type: closeType,
    close_outcome: outcome === 'closed' ? 'closed' : 'no_sale',
    close_confidence: result.deal_outcome.outcome_confidence === 'high' ? 90 : result.deal_outcome.outcome_confidence === 'medium' ? 70 : 40,
    score_breakdown: {
      close_quality: Math.round(((categoryByKey.get('closing_skill')?.score || 1) / 10) * 25),
      objection_handling: Math.round(((categoryByKey.get('objection_handling')?.score || 1) / 10) * 20),
      value_stacking: Math.round((((categoryByKey.get('value_building')?.score || 1) + (categoryByKey.get('pitch_offer_clarity')?.score || 1)) / 20) * 20),
      urgency_usage: Math.round(((categoryByKey.get('payment_commitment_next_steps')?.score || 1) / 10) * 15),
      discovery_rapport: Math.round((((categoryByKey.get('discovery_qualification')?.score || 1) + (categoryByKey.get('communication_call_control')?.score || 1)) / 20) * 10),
      professionalism: Math.round((((categoryByKey.get('compliance_professionalism')?.score || 1) + (categoryByKey.get('opening_agenda')?.score || 1)) / 20) * 10),
    },
    categories: {
      rapport_tone: legacyCategory('rapport_tone', ['communication_call_control']),
      discovery_quality: legacyCategory('discovery_quality', ['discovery_qualification']),
      call_control: legacyCategory('call_control', ['opening_agenda', 'communication_call_control']),
      pain_amplification: legacyCategory('pain_amplification', ['pain_problem_awareness']),
      offer_explanation: legacyCategory('offer_explanation', ['solution_explanation', 'pitch_offer_clarity']),
      objection_handling: legacyCategory('objection_handling', ['objection_handling']),
      urgency_close_attempt: legacyCategory('urgency_close_attempt', ['payment_commitment_next_steps']),
      confidence_authority: legacyCategory('confidence_authority', ['value_building', 'communication_call_control']),
      next_steps_clarity: legacyCategory('next_steps_clarity', ['payment_commitment_next_steps']),
      overall_close_quality: legacyCategory('overall_close_quality', ['closing_skill']),
    },
    strengths: bestMoments.length ? bestMoments : result.category_scores.filter((category) => category.score >= 8).slice(0, 3).map((category) => `${category.category_name}: ${category.what_happened}`),
    weaknesses: missed.length ? missed : result.category_scores.filter((category) => category.score <= 4).slice(0, 3).map((category) => `${category.category_name}: ${category.coaching_feedback}`),
    objections_detected: extractObjectionStrings(result, 'detected'),
    objections_handled_well: extractObjectionStrings(result, 'handled_well'),
    objections_missed: extractObjectionStrings(result, 'missed'),
    next_coaching_actions: actions,
    coaching_feedback: actions,
    coaching_markers: result.timestamped_key_moments,
    key_quotes: result.category_scores
      .flatMap((category) => category.evidence.map((evidence) => ({ quote: evidence.quote, context: category.category_name, type: category.score >= 7 ? 'positive' : 'coaching' })))
      .slice(0, 5),
    missed_opportunities: result.missed_opportunities,
    coach_summary: {
      did_well: bestMoments.slice(0, 3),
      needs_work: missed.slice(0, 3),
      action_items: actions.slice(0, 3),
      manager_summary: result.manager_summary,
      rep_facing_summary: result.rep_facing_summary,
    },
    value_stacking_score: Math.round(((categoryByKey.get('value_building')?.score || 1) + (categoryByKey.get('pitch_offer_clarity')?.score || 1)) / 2),
    urgency_score: categoryByKey.get('payment_commitment_next_steps')?.score || 1,
    objection_handling_score: categoryByKey.get('objection_handling')?.score || 1,
    enhanced_weaknesses: result.missed_opportunities,
    objection_scripts: objectionScripts,
    rubric_version: RUBRIC_VERSION_V2,
    rubric_v2: result,
  };
}

function mapOutcome(finalOutcome: DealFinalOutcome): 'closed' | 'no_sale' | 'disqualified' {
  return finalOutcome === 'payment_collected' || finalOutcome === 'deposit_collected' || finalOutcome === 'payment_plan_arranged'
    ? 'closed'
    : 'no_sale';
}

function mapCloseType(finalOutcome: DealFinalOutcome): 'full_close' | 'payment_plan' | 'deposit' | 'partial_access' | null {
  if (finalOutcome === 'payment_collected') return 'full_close';
  if (finalOutcome === 'deposit_collected') return 'deposit';
  if (finalOutcome === 'payment_plan_arranged') return 'payment_plan';
  return null;
}

function getQualityLabel(score: number): 'poor' | 'average' | 'strong' | 'elite' {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'average';
  return 'poor';
}

function momentToText(moment: any): string {
  if (typeof moment === 'string') return moment;
  if (!moment || typeof moment !== 'object') return '';
  const timestamp = typeof moment.timestamp === 'string' ? `[${moment.timestamp}] ` : '';
  const title = moment.title || moment.issue || moment.moment || moment.skill || '';
  const detail = moment.quote || moment.coaching_feedback || moment.action || moment.why_it_was_strong || moment.what_to_do_instead || '';
  return `${timestamp}${title}${detail ? ` — ${detail}` : ''}`.trim();
}

function extractObjectionStrings(result: RubricV2Result, type: 'detected' | 'handled_well' | 'missed'): string[] {
  const objectionCategory = result.category_scores.find((category) => category.category_key === 'objection_handling');
  if (!objectionCategory) return [];
  if (type === 'detected') return objectionCategory.evidence.map((entry) => entry.quote).filter(Boolean).slice(0, 5);
  if (type === 'handled_well' && objectionCategory.score >= 7) return [objectionCategory.what_happened];
  if (type === 'missed' && objectionCategory.score <= 5) return [objectionCategory.coaching_feedback];
  return [];
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildRubricV2Prompt(params: {
  transcript: string;
  repName?: string | null;
  benchmarkContext?: string;
  knowledgeContext?: string;
}): string {
  const agentCtx = params.repName ? `The sales agent's name is "${params.repName}".` : '';
  const categoryLines = CATEGORY_WEIGHTS_V2.map((category) => `- ${category.key} (${category.name}) — weight ${category.weight}%`).join('\n');

  return `You are an expert Credit Club sales call analyst. ${agentCtx}

Analyze the FULL transcript for Credit Club, a UK credit/points education programme (£3,000 standard price, deposits/payment plans possible).

IMPORTANT SCORING RULES:
- Score each category from 1 to 10 only.
- DO NOT calculate or guess the final overall score. Code will calculate deterministic weighted scoring.
- Score sales process quality separately from deal outcome.
- A closed/payment call can still have a low or mid process score if discovery/value/compliance were weak.
- A no-sale call can still score well if the sales process was strong and next step was clear.
- For every category, include transcript evidence. Include timestamp when available.
- If something was not observed and the full transcript was analyzed, write exactly: "Not observed in the full analyzed transcript."
- Compliance feedback is coaching guidance, not legal advice.

CATEGORY WEIGHTS:
${categoryLines}

CATEGORY DETAILS:
A. Opening and agenda setting: control, expectations, professionalism, call purpose.
B. Discovery and qualification: meaningful questions, credit situation, goals, motivation, urgency, affordability/payment ability, qualification.
C. Pain and problem awareness: cost of credit issue, real-life consequences, importance, emotional/logical urgency.
D. Solution explanation: service/process clarity, after-signup steps, no vague claims, connection to prospect situation.
E. Value building: value before price, outcomes/benefits/transformation, trust/credibility, worth the price.
F. Pitch and offer clarity: offer, pricing, inclusions, natural transition, prospect understood what they were buying.
G. Objection handling: objections, isolate real objection, answer directly, loop back to value, calm control, no arguing/desperate discounting.
H. Closing skill: asks for sale, moves toward payment, handles hesitation, maintains control, clear decision point.
I. Payment / commitment / next steps: payment/deposit/plan/follow-up/onboarding/clear specific next step.
J. Compliance and professionalism: avoids guarantees, overpromising, misleading claims, inappropriate pressure; respectful and compliant language.
K. Communication and call control: confidence, tonality, listening, personalization, structure, control, clarity.

DEAL OUTCOME DETECTION:
Return a separate deal_outcome object with booleans for offer_pitched, price_discussed, close_attempted, payment_collected, deposit_collected, payment_plan_arranged, follow_up_booked, onboarding_or_next_step_completed.
final_outcome must be one of: payment_collected, deposit_collected, payment_plan_arranged, follow_up_booked, no_sale, unclear.
Only mark payment/deposit/plan as true with clear transcript evidence. If unclear, use final_outcome="unclear" and outcome_confidence="low".

COMPLIANCE FLAGS:
Flag clear evidence of guaranteed approval, guaranteed score increase, unrealistic timeline promises, misleading claims, or inappropriate pressure tactics. Include safer wording. High severity flags require exact evidence.

PRIVACY AND COACHING OUTPUT RULES:
- Benchmark and pattern-library examples are internal guidance only. Do not mention benchmark names, rep names, customer names, or previous call names in final coaching output. Convert benchmark lessons into anonymized coaching instructions and example phrasing.
- User-facing coaching must be instruction-based: "Isolate the objection before responding", "Try saying...", "Use this structure...".
- Never write phrases like "as [person] did", "in [person]'s call", "benchmark [person]", "copy [person]", or "like [person]".
- Suggested phrasing and coaching advice may use generic examples, but no other reps, old customers, benchmark calls, or previous call names.
- Verbatim transcript evidence from the current call may include names only when they appear in direct quotes.

${sanitizeBenchmarkContext(params.benchmarkContext || '')}

${sanitizeBenchmarkContext(params.knowledgeContext || '')}

Return ONLY valid JSON matching this shape:
{
  "analysis_status": "complete|partial|incomplete",
  "deal_outcome": {
    "final_outcome": "payment_collected|deposit_collected|payment_plan_arranged|follow_up_booked|no_sale|unclear",
    "outcome_confidence": "high|medium|low",
    "offer_pitched": false,
    "price_discussed": false,
    "close_attempted": false,
    "payment_collected": false,
    "deposit_collected": false,
    "payment_plan_arranged": false,
    "follow_up_booked": false,
    "onboarding_or_next_step_completed": false,
    "evidence": [{ "timestamp": "MM:SS or null", "speaker": "Rep/Prospect or null", "quote": "verbatim quote", "why_it_matters": "why this proves the outcome" }]
  },
  "category_scores": [
    {
      "category_key": "opening_agenda",
      "category_name": "Opening and agenda setting",
      "score": 1,
      "what_happened": "what happened in the call",
      "why_this_score": "why this score was given",
      "evidence": [{ "timestamp": "MM:SS or null", "speaker": "Rep/Prospect or null", "quote": "verbatim quote" }],
      "coaching_feedback": "specific coaching feedback",
      "improved_example_phrasing": "better wording where useful"
    }
  ],
  "best_moments": [{ "timestamp": "MM:SS or null", "title": "", "quote": "", "why_it_was_strong": "" }],
  "missed_opportunities": [{ "timestamp": "MM:SS or null", "issue": "", "coaching_feedback": "", "what_to_do_instead": "" }],
  "top_3_coaching_actions": [{ "priority": 1, "skill": "", "action": "", "practice_drill": "", "example_phrase": "" }],
  "compliance_flags": [{ "severity": "low|medium|high", "issue": "", "evidence": "", "timestamp": "MM:SS or null", "safer_wording": "" }],
  "manager_summary": "manager-facing summary",
  "rep_facing_summary": "rep-facing summary",
  "timestamped_key_moments": [{ "timestamp": "MM:SS or null", "title": "", "quote": "", "coach_note": "", "severity": "low|medium|high", "type": "positive|coaching|compliance|outcome" }]
}

You must include all 11 category_scores exactly once, using these category_key values:
${CATEGORY_WEIGHTS_V2.map((category) => category.key).join(', ')}

Transcript:
${params.transcript}`;
}
