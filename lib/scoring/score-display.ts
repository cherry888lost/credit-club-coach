/* eslint-disable @typescript-eslint/no-explicit-any */

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  rapport_tone: 'Rapport & Tone',
  discovery_quality: 'Discovery Quality',
  call_control: 'Call Control',
  pain_amplification: 'Pain Amplification',
  offer_explanation: 'Offer Explanation',
  objection_handling: 'Objection Handling',
  urgency_close_attempt: 'Urgency & Close',
  confidence_authority: 'Confidence & Authority',
  next_steps_clarity: 'Next Steps Clarity',
  overall_close_quality: 'Close Quality',
};

export type CategoryDiagnosticsSource = 'rubric_v2' | 'legacy' | 'none';

export interface ScoreDisplayCategory {
  key: string;
  name: string;
  score: number | null;
  maxScore: number;
  weight?: number | null;
  reasoning?: string;
  evidence?: Array<{ timestamp?: string; speaker?: string; quote: string }>;
  coaching?: string;
  improvedScript?: string;
}

export interface ScoreDisplayModel {
  score: number | null;
  qualityLabel?: string | null;
  outcome: {
    primaryLabel: string | null;
    secondaryLabel: string | null;
    badges: string[];
  };
  quickVerdict: string;
  wins: string[];
  missedOpportunities: string[];
  nextActions: string[];
  betterScripts: string[];
  keyMoments: Array<{ timestamp?: string; label: string; note?: string }>;
  categoryDiagnostics: {
    source: CategoryDiagnosticsSource;
    label: string;
    visibleToCloser: boolean;
    collapsedByDefault: boolean;
    categories: ScoreDisplayCategory[];
  };
  adminDiagnostics: { source: CategoryDiagnosticsSource; rawScoreId?: string | null } | null;
}

export function buildScoreDisplayModel(scoreRow: any, options: { isAdmin: boolean }): ScoreDisplayModel {
  const rubricV2 = scoreRow?.rubric_v2 && typeof scoreRow.rubric_v2 === 'object' ? scoreRow.rubric_v2 : null;
  const diagnostics = buildCategoryDiagnostics(scoreRow, options.isAdmin);
  const usedTopics = new Set<string>();
  const categoryAdvice = diagnostics.categories.flatMap((category) => [category.reasoning, category.coaching, category.improvedScript]);

  const quickVerdict = firstClean([
    rubricV2?.rep_facing_summary,
    typeof scoreRow?.coach_summary === 'string' ? scoreRow.coach_summary : null,
    scoreRow?.summary,
    scoreRow?.call_summary,
    rubricV2?.manager_summary,
  ]) || buildFallbackVerdict(scoreRow);

  const wins = takeUniqueAdvice([
    ...asArray(rubricV2?.best_moments).map(momentText),
    ...asArray(scoreRow?.coach_summary?.did_well),
    ...asArray(scoreRow?.strengths),
  ], 3, usedTopics, categoryAdvice);

  const nextActions = takeUniqueAdvice([
    ...asArray(rubricV2?.top_3_coaching_actions).map(actionText),
    ...asArray(scoreRow?.coach_summary?.action_items),
    ...asArray(scoreRow?.next_coaching_actions).map(actionText),
  ], 3, usedTopics, categoryAdvice);

  const missedOpportunities = takeUniqueAdvice([
    ...asArray(rubricV2?.missed_opportunities).map(missedText),
    ...asArray(scoreRow?.coach_summary?.needs_work),
    ...asArray(scoreRow?.weaknesses),
    ...asArray(scoreRow?.missed_opportunities).map(missedText),
  ], 3, usedTopics, categoryAdvice);

  const betterScripts = takeUniqueAdvice([
    ...asArray(scoreRow?.objection_scripts).map(scriptText),
    ...diagnostics.categories.map((category) => category.improvedScript),
  ], 3, new Set<string>(), []);

  const keyMoments = asArray(rubricV2?.timestamped_key_moments).length > 0
    ? buildMoments(asArray(rubricV2?.timestamped_key_moments), 5)
    : buildMoments(asArray(scoreRow?.coaching_markers), 5);

  return {
    score: numericOrNull(scoreRow?.score_total ?? scoreRow?.overall_score ?? rubricV2?.overall_score),
    qualityLabel: cleanText(scoreRow?.quality_label),
    outcome: buildOutcomeDisplay(scoreRow, rubricV2),
    quickVerdict,
    wins,
    missedOpportunities,
    nextActions,
    betterScripts,
    keyMoments,
    categoryDiagnostics: diagnostics,
    adminDiagnostics: options.isAdmin ? { source: diagnostics.source, rawScoreId: scoreRow?.id || null } : null,
  };
}

function buildCategoryDiagnostics(scoreRow: any, isAdmin: boolean): ScoreDisplayModel['categoryDiagnostics'] {
  const rubricV2 = scoreRow?.rubric_v2 && typeof scoreRow.rubric_v2 === 'object' ? scoreRow.rubric_v2 : null;
  const v2Categories = asArray(rubricV2?.category_scores);

  if (v2Categories.length > 0) {
    const categories = isAdmin ? v2Categories.map((category: any) => ({
      key: cleanText(category?.category_key) || cleanText(category?.key) || 'unknown',
      name: cleanText(category?.category_name) || cleanText(category?.name) || cleanText(category?.category_key) || 'Unknown category',
      score: numericOrNull(category?.score),
      maxScore: 10,
      weight: numericOrNull(category?.weight),
      reasoning: cleanText(category?.why_this_score || category?.what_happened),
      evidence: normalizeEvidence(category?.evidence),
      coaching: cleanText(category?.coaching_feedback),
      improvedScript: cleanText(category?.improved_example_phrasing),
    })) : [];

    return {
      source: 'rubric_v2',
      label: `Detailed Category Breakdown (${v2Categories.length} v2 categories)`,
      visibleToCloser: false,
      collapsedByDefault: true,
      categories,
    };
  }

  const legacyEntries = Object.entries(scoreRow?.categories || {});
  if (legacyEntries.length > 0) {
    const categories = isAdmin ? legacyEntries.map(([key, value]: [string, any]) => ({
      key,
      name: LEGACY_CATEGORY_LABELS[key] || key,
      score: numericOrNull(value?.score),
      maxScore: 10,
      weight: null,
      reasoning: cleanText(value?.reasoning),
      evidence: cleanText(value?.evidence) ? [{ quote: cleanText(value.evidence) as string }] : [],
      coaching: cleanText(value?.improvement_tip),
      improvedScript: '',
    })) : [];

    return {
      source: 'legacy',
      label: `Detailed Category Breakdown (${legacyEntries.length} legacy categories)`,
      visibleToCloser: false,
      collapsedByDefault: true,
      categories,
    };
  }

  return {
    source: 'none',
    label: 'Detailed Category Breakdown',
    visibleToCloser: false,
    collapsedByDefault: true,
    categories: [],
  };
}

function buildOutcomeDisplay(scoreRow: any, rubricV2: any): ScoreDisplayModel['outcome'] {
  const managerOutcome = cleanText(scoreRow?.manual_outcome);
  const managerCloseType = cleanText(scoreRow?.manual_close_type);
  const aiOutcome = cleanText(rubricV2?.deal_outcome?.final_outcome || scoreRow?.outcome || scoreRow?.close_outcome);
  const aiCloseType = cleanText(scoreRow?.close_type);

  if (managerOutcome) {
    const managerLabel = `Manager Outcome: ${formatOutcome(managerOutcome, managerCloseType)}`;
    const aiLabel = aiOutcome ? `AI Outcome: ${formatOutcome(aiOutcome, aiCloseType)}` : null;
    return { primaryLabel: managerLabel, secondaryLabel: aiLabel, badges: [managerLabel, ...(aiLabel ? [aiLabel] : [])] };
  }

  const primary = aiOutcome ? `AI Outcome: ${formatOutcome(aiOutcome, aiCloseType)}` : null;
  return { primaryLabel: primary, secondaryLabel: null, badges: primary ? [primary] : [] };
}

function formatOutcome(outcome: string, closeType?: string | null): string {
  if (outcome === 'no_sale') return 'No Sale';
  if (outcome === 'deposit_collected') return 'Deposit Collected';
  if (outcome === 'payment_collected') return 'Payment Collected';
  if (outcome === 'payment_plan_arranged') return 'Payment Plan Arranged';
  if (outcome === 'follow_up_booked') return 'Follow Up Booked';
  if (outcome === 'closed' && closeType) return formatTitle(closeType);
  return formatTitle(outcome);
}

function formatTitle(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanText(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/\[\s*full\s+transcript\s*\]/gi, '')
    .replace(/no\s+solution\s+explanation\s*\/\s*value\s+building/gi, 'solution/value clarity gap')
    .replace(/no\s+solution\s+explanation\s+or\s+value\s+building/gi, 'solution/value clarity gap')
    .replace(/^null$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function numericOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstClean(values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }
  return '';
}

function buildFallbackVerdict(scoreRow: any): string {
  const score = numericOrNull(scoreRow?.score_total ?? scoreRow?.overall_score);
  if (score == null) return 'This call has coaching feedback available. Review the key wins and next actions below.';
  if (score >= 80) return 'This was a strong call. The rep showed good control and should focus on repeating the strongest moments consistently.';
  if (score >= 60) return 'This was an average call. The rep had some useful moments, but the call needs clearer value building and a firmer next step.';
  return 'This call needs improvement. Focus on clearer discovery, stronger value explanation, and a direct close or next step.';
}

function momentText(item: unknown): string {
  if (typeof item === 'string') return cleanText(item);
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  return firstClean([record.summary, record.what_happened, record.moment, record.coaching_feedback, record.quote]);
}

function missedText(item: unknown): string {
  if (typeof item === 'string') return cleanText(item);
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  return firstClean([record.issue, record.missed_opportunity, record.summary, record.coaching_feedback, record.what_happened]);
}

function actionText(item: unknown): string {
  if (typeof item === 'string') return cleanText(item);
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  return firstClean([record.action, record.coaching_action, record.next_action, record.recommendation, record.coaching_feedback]);
}

function scriptText(item: unknown): string {
  if (typeof item === 'string') return cleanText(item);
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  return firstClean([record.better_response, record.better_script, record.improved_example_phrasing]);
}

function buildMoments(items: unknown[], limit: number): ScoreDisplayModel['keyMoments'] {
  const moments: ScoreDisplayModel['keyMoments'] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const label = firstClean([record.title, record.moment, record.summary, record.issue, record.what_happened]);
    if (!label) continue;
    const timestamp = cleanText(record.timestamp);
    const note = firstClean([record.feedback, record.coaching_feedback, record.note]);
    moments.push({ ...(timestamp ? { timestamp } : {}), label, ...(note ? { note } : {}) });
    if (moments.length >= limit) break;
  }
  return moments;
}

function normalizeEvidence(value: unknown): ScoreDisplayCategory['evidence'] {
  return asArray(value)
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Record<string, unknown>;
      const quote = cleanText(record.quote);
      if (!quote) return null;
      const timestamp = cleanText(record.timestamp);
      const speaker = cleanText(record.speaker);
      return { ...(timestamp ? { timestamp } : {}), ...(speaker ? { speaker } : {}), quote };
    })
    .filter(Boolean) as ScoreDisplayCategory['evidence'];
}

function takeUniqueAdvice(values: unknown[], limit: number, usedTopics: Set<string>, lowerPriorityValues: unknown[]): string[] {
  const results: string[] = [];
  const localKeys = new Set<string>();

  for (const value of values) {
    const text = cleanText(value);
    if (!text) continue;
    const topic = adviceTopic(text);
    const key = normalizeKey(text);
    if (usedTopics.has(topic) || localKeys.has(key) || hasSimilarKey(localKeys, key)) continue;
    if (isDuplicatedByLowerPriority(text, lowerPriorityValues) && results.length > 0) continue;
    results.push(text);
    localKeys.add(key);
    usedTopics.add(topic);
    if (results.length >= limit) break;
  }

  return results;
}

function isDuplicatedByLowerPriority(text: string, values: unknown[]): boolean {
  const topic = adviceTopic(text);
  return values.some((value) => cleanText(value) && adviceTopic(cleanText(value)) === topic);
}

function hasSimilarKey(existingKeys: Set<string>, key: string): boolean {
  if (!key) return false;
  for (const existing of existingKeys) {
    if (existing.length < 12 || key.length < 12) continue;
    if (existing.includes(key) || key.includes(existing)) return true;
  }
  return false;
}

function adviceTopic(text: string): string {
  const normalized = normalizeKey(text);
  if (/solution|offer|value|pitch|explain/.test(normalized)) return 'solution-value-explanation';
  if (/next step|close|closing|payment|book|secure/.test(normalized)) return 'clear-close-next-step';
  if (/urgency|why now|motivation/.test(normalized)) return 'urgency-motivation-discovery';
  if (/objection|isolate|think about|expensive|price/.test(normalized)) return 'objection-isolation';
  if (/rapport|tone|opening/.test(normalized)) return 'rapport-tone';
  if (/pain|problem/.test(normalized)) return 'pain-discovery';
  return normalized;
}

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(the|a|an|and|or|to|of|in|on|for|with|rep|call|clearly|clear)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
