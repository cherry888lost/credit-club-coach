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
  weightedPoints?: number | null;
  reason?: string;
  evidence?: Array<{ timestamp?: string; speaker?: string; quote: string }>;
  coaching?: string;
  improvedScript?: string;
}

export interface BetterScriptDisplay {
  label: string;
  text: string;
}

export interface CompactScoreBreakdown {
  source: CategoryDiagnosticsSource;
  overallScore: number | null;
  label: string;
  strongestAreas: ScoreDisplayCategory[];
  lowestAreas: ScoreDisplayCategory[];
  categories: ScoreDisplayCategory[];
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
  compactScoreBreakdown: CompactScoreBreakdown;
  wins: string[];
  missedOpportunities: string[];
  nextActions: string[];
  betterScripts: BetterScriptDisplay[];
  keyMoments: Array<{ timestamp?: string; label: string; note?: string }>;
  showKeyMomentsInSimpleView: boolean;
  categoryDiagnostics: {
    source: CategoryDiagnosticsSource;
    label: string;
    visibleToCloser: boolean;
    collapsedByDefault: boolean;
    categories: ScoreDisplayCategory[];
  };
  adminDiagnostics: { source: CategoryDiagnosticsSource; rawScoreId?: string | null; keyMomentsAvailable?: boolean } | null;
}

export function buildScoreDisplayModel(scoreRow: any, options: { isAdmin: boolean }): ScoreDisplayModel {
  const rubricV2 = scoreRow?.rubric_v2 && typeof scoreRow.rubric_v2 === 'object' ? scoreRow.rubric_v2 : null;
  const diagnostics = buildCategoryDiagnostics(scoreRow, options.isAdmin);
  const compactScoreBreakdown = buildCompactScoreBreakdown(scoreRow);
  const usedTopics = new Set<string>();
  const categoryAdvice = compactScoreBreakdown.categories.flatMap((category) => [category.reason, category.coaching, category.improvedScript]);

  const quickVerdict = buildQuickVerdict(firstClean([
    rubricV2?.rep_facing_summary,
    typeof scoreRow?.coach_summary === 'string' ? scoreRow.coach_summary : null,
    scoreRow?.summary,
    scoreRow?.call_summary,
    rubricV2?.manager_summary,
  ]) || buildFallbackVerdict(scoreRow), scoreRow, rubricV2);

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

  const betterScripts = buildBetterScripts([
    ...asArray(scoreRow?.objection_scripts),
    ...compactScoreBreakdown.categories.map((category) => ({ improved_example_phrasing: category.improvedScript })),
  ], 3);

  const keyMoments = asArray(rubricV2?.timestamped_key_moments).length > 0
    ? buildMoments(asArray(rubricV2?.timestamped_key_moments), 5)
    : buildMoments(asArray(scoreRow?.coaching_markers), 5);

  return {
    score: numericOrNull(scoreRow?.score_total ?? scoreRow?.overall_score ?? rubricV2?.overall_score),
    qualityLabel: cleanText(scoreRow?.quality_label),
    outcome: buildOutcomeDisplay(scoreRow, rubricV2),
    quickVerdict,
    compactScoreBreakdown,
    wins,
    missedOpportunities,
    nextActions,
    betterScripts,
    keyMoments,
    showKeyMomentsInSimpleView: false,
    categoryDiagnostics: diagnostics,
    adminDiagnostics: options.isAdmin ? { source: diagnostics.source, rawScoreId: scoreRow?.id || null, keyMomentsAvailable: keyMoments.length > 0 } : null,
  };
}

function buildCompactScoreBreakdown(scoreRow: any): CompactScoreBreakdown {
  const rubricV2 = scoreRow?.rubric_v2 && typeof scoreRow.rubric_v2 === 'object' ? scoreRow.rubric_v2 : null;
  const v2Categories = asArray(rubricV2?.category_scores);

  if (v2Categories.length > 0) {
    const categories = v2Categories.map((category: any) => ({
      key: cleanText(category?.category_key) || cleanText(category?.key) || 'unknown',
      name: cleanText(category?.category_name) || cleanText(category?.name) || cleanText(category?.category_key) || 'Unknown category',
      score: numericOrNull(category?.score),
      maxScore: 10,
      weight: numericOrNull(category?.weight),
      weightedPoints: numericOrNull(category?.weighted_points),
      reason: oneLineReason(category?.why_this_score || category?.what_happened || category?.coaching_feedback),
      coaching: cleanText(category?.coaching_feedback),
      improvedScript: cleanText(category?.improved_example_phrasing),
    }));

    return buildCompactBreakdown('rubric_v2', `Score Breakdown (${categories.length} v2 categories)`, scoreRow?.score_total ?? scoreRow?.overall_score ?? rubricV2?.overall_score, categories);
  }

  const legacyEntries = Object.entries(scoreRow?.categories || {});
  if (legacyEntries.length > 0) {
    const categories = legacyEntries.map(([key, value]: [string, any]) => ({
      key,
      name: LEGACY_CATEGORY_LABELS[key] || key,
      score: numericOrNull(value?.score),
      maxScore: 10,
      weight: null,
      weightedPoints: null,
      reason: oneLineReason(value?.reasoning || value?.improvement_tip),
      coaching: cleanText(value?.improvement_tip),
      improvedScript: '',
    }));

    return buildCompactBreakdown('legacy', `Score Breakdown (${categories.length} legacy categories)`, scoreRow?.score_total ?? scoreRow?.overall_score, categories);
  }

  return buildCompactBreakdown('none', 'Score Breakdown', scoreRow?.score_total ?? scoreRow?.overall_score, []);
}

function buildCompactBreakdown(source: CategoryDiagnosticsSource, label: string, overallScore: unknown, categories: ScoreDisplayCategory[]): CompactScoreBreakdown {
  const scored = [...categories].filter((category) => category.score != null);
  const strongestAreas = [...scored]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 3);
  const lowestAreas = [...scored]
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 3);

  return {
    source,
    overallScore: numericOrNull(overallScore),
    label,
    strongestAreas,
    lowestAreas,
    categories,
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
      reason: oneLineReason(category?.why_this_score || category?.what_happened || category?.coaching_feedback),
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
      reason: oneLineReason(value?.reasoning || value?.improvement_tip),
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
  const managerLabelRaw = managerOutcome ? formatOutcome(managerOutcome, managerCloseType) : null;
  const aiLabelRaw = aiOutcome ? formatOutcome(aiOutcome, aiCloseType) : null;

  if (managerLabelRaw) {
    if (aiLabelRaw && normalizeOutcomeLabel(managerLabelRaw) === normalizeOutcomeLabel(aiLabelRaw)) {
      return { primaryLabel: managerLabelRaw, secondaryLabel: null, badges: [managerLabelRaw] };
    }
    const primary = `Manager Outcome: ${managerLabelRaw}`;
    const secondary = aiLabelRaw ? `AI Detected Outcome: ${aiLabelRaw}` : null;
    return { primaryLabel: primary, secondaryLabel: secondary, badges: [primary, ...(secondary ? [secondary] : [])] };
  }

  const primary = aiLabelRaw ? `AI Outcome: ${aiLabelRaw}` : null;
  return { primaryLabel: primary, secondaryLabel: null, badges: primary ? [primary] : [] };
}

function formatOutcome(outcome: string, closeType?: string | null): string {
  if (closeType === 'partial_access' || outcome === 'partial_access') return 'Partial Access Closed';
  if (outcome === 'closed' && closeType) return formatOutcome(closeType);
  if (outcome === 'no_sale') return 'No Sale';
  if (outcome === 'deposit_collected') return 'Deposit Collected';
  if (outcome === 'payment_collected') return 'Payment Collected';
  if (outcome === 'payment_plan_arranged') return 'Payment Plan Arranged';
  if (outcome === 'follow_up_booked') return 'Follow Up Booked';
  return formatTitle(outcome);
}

function normalizeOutcomeLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatTitle(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanText(value: unknown): string {
  if (value == null) return '';
  if (typeof value !== 'string') return '';
  const cleaned = summarizeRawTranscriptSnippet(value)
    .replace(/\[\s*full\s+transcript\s*\]/gi, '')
    .replace(/no\s+solution\s+explanation\s*\/\s*value\s+building/gi, 'solution/value clarity gap')
    .replace(/no\s+solution\s+explanation\s+or\s+value\s+building/gi, 'solution/value clarity gap')
    .replace(/\bno evidence of payment or commitment activity\b/gi, '')
    .replace(/\boffer and pric(?:e|ing) (?:was |were )?not (?:yet )?discussed(?: or clarified)?(?: yet)?\b/gi, '')
    .replace(/\bno offer or pric(?:e|ing) (?:was )?discussed(?: yet)?\b/gi, '')
    .replace(/\bthe rep has not yet explained the solution or how it connects to the prospect'?s situation\b/gi, '')
    .replace(/\bno close attempt(?: made)?\b/gi, '')
    .replace(/\bclosing not attempted(?: yet)?\b/gi, '')
    .replace(/\bno closing behavior (?:present|observed)\b/gi, '')
    .replace(/\bno closing skill demonstrated(?: yet)?\b/gi, '')
    .replace(/\bno payment or commitment (?:observed|behavior present|activity observed)\b/gi, '')
    .replace(/\bclosing skill was not demonstrated in the analyzed transcript\b/gi, '')
    .replace(/\bpitch and offer clarity was not present in the analyzed transcript\b/gi, '')
    .replace(/^null$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

function limitSentences(text: string, maxSentences: number): string {
  const cleaned = cleanText(text);
  if (!cleaned) return '';
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
  return sentences.slice(0, maxSentences).join(' ').replace(/\s+/g, ' ').trim();
}

function oneLineReason(value: unknown): string {
  return limitSentences(cleanText(value), 1);
}

function summarizeRawTranscriptSnippet(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('travel') && lower.includes('caught my attention')) {
    return 'Connected the conversation to the prospect’s travel goals.';
  }
  if (lower.includes('opening your cards') || lower.includes('cards in that order')) {
    return 'Explained card sequencing and points accumulation clearly.';
  }
  if (lower.includes('wasting') && (lower.includes('£125') || lower.includes('125') || lower.includes('interest'))) {
    return 'Quantified the monthly interest cost to make the problem feel concrete.';
  }
  if (lower.includes("what you already know") || lower.includes("don't bore you")) {
    return 'Personalized discovery by asking what the prospect already knew.';
  }
  if (lower.includes('start with £300') || lower.includes('another 700') || lower.includes('thousand pounds')) {
    return 'Offered a flexible staged payment path tied to credit readiness.';
  }
  if (lower.includes('£6,000') || lower.includes('6000') || lower.includes('high mortgage')) {
    return 'Showed empathy for the prospect’s financial pressure.';
  }
  return value;
}

function buildQuickVerdict(base: string, scoreRow: any, rubricV2: any): string {
  const outcome = buildOutcomeDisplay(scoreRow, rubricV2).primaryLabel;
  const sentences: string[] = [];
  if (outcome) sentences.push(outcome.replace(/^AI Outcome: /, '').replace(/^Manager Outcome: /, '') + '.');
  sentences.push(...splitSentences(base));
  if (sentences.length < 4) {
    const score = numericOrNull(scoreRow?.score_total ?? scoreRow?.overall_score ?? rubricV2?.overall_score);
    sentences.push(score != null && score < 70
      ? 'The score is not higher because there are still process gaps in structure, discovery, value build, objection handling, or payment confirmation.'
      : 'The score reflects the balance between the outcome achieved and the quality of the sales process.'
    );
  }
  sentences.push('The main improvement is to make the next call more structured and easier for the prospect to commit to.');
  const unique = takeUniqueSentences(sentences);
  return unique.slice(0, 6).join(' ').replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  return (cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .map((sentence) => /[.!?]$/.test(sentence) ? sentence : `${sentence}.`);
}

function takeUniqueSentences(sentences: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const sentence of sentences) {
    const key = normalizeKey(sentence);
    if (!key || seen.has(key)) continue;
    output.push(sentence);
    seen.add(key);
  }
  return output;
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

function buildBetterScripts(items: unknown[], limit: number): BetterScriptDisplay[] {
  const used = new Set<string>();
  const scripts: BetterScriptDisplay[] = [];

  for (const item of items) {
    const text = scriptText(item);
    if (!text) continue;
    const key = normalizeKey(text);
    if (!key || used.has(key) || hasSimilarKey(used, key)) continue;
    scripts.push({ label: scriptLabel(item, text), text });
    used.add(key);
    if (scripts.length >= limit) break;
  }

  return scripts;
}

function scriptLabel(item: unknown, text: string): string {
  const combined = `${typeof item === 'object' && item ? JSON.stringify(item) : ''} ${text}`.toLowerCase();
  if (/agenda|before we get into|this call will take/.test(combined)) return 'Agenda script';
  if (/objection|holding you back|think|expensive|money|confidence|timing|reason you prefer/.test(combined)) return 'Objection isolation script';
  if (/deposit|secure your place|£500|500/.test(combined)) return 'Deposit close script';
  if (/next step|book|follow.?up|commitment/.test(combined)) return 'Next-step script';
  if (/main goals|credit score|how soon|comfortable with the investment|discovery/.test(combined)) return 'Discovery script';
  if (/value|programme|program|benefit|offer|card sequencing|points/.test(combined)) return 'Value explanation script';
  return 'Better script';
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
  if (/quantified|monthly interest|wasting|concrete|pain|problem/.test(normalized)) return 'pain-discovery';
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
