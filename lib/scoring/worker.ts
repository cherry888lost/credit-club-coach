/**
 * Credit Club Scoring Worker — THE ONE WORKER
 * 
 * Self-contained scoring pipeline that:
 * 1. Polls Supabase for pending scoring_requests (zero AI cost)
 * 2. Claims requests atomically
 * 3. Calls OpenAI API directly (no subagent spawn)
 * 4. Validates ALL required fields strictly
 * 5. Writes call_scores with real UUID
 * 6. Marks scoring_requests completed
 * 7. Runs learning extraction on success
 * 
 * Uses fetch() for everything — zero external dependencies.
 * Works in Node.js 18+, OpenClaw heartbeat, or standalone.
 * 
 * @version 3.0.0 — Clean rebuild, single execution path
 */

// ── Types ────────────────────────────────────────────────────────────────────

interface ScoringRequest {
  id: string;
  call_id: string;
  transcript: string;
  rep_name: string | null;
  call_title: string | null;
  call_date: string | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
}

interface CategoryScore {
  score: number;
  reasoning: string;
  evidence: string;
}

interface CoachSummary {
  did_well: string[];
  needs_work: string[];
  action_items: string[];
}

interface ScoringResult {
  overall_score: number;
  quality_label: 'poor' | 'average' | 'strong' | 'elite';
  outcome: 'closed' | 'follow_up' | 'no_sale' | 'disqualified';
  close_type: 'deposit' | 'full_close' | 'partial_access' | 'payment_plan' | null;
  coach_summary: CoachSummary;
  categories: Record<string, CategoryScore>;
  strengths: string[];
  weaknesses: string[];
  objections_detected: string[];
  objections_handled_well: string[];
  objections_missed: string[];
  next_coaching_actions: string[];
  coaching_markers: any[];
}

interface WorkerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  model: string;
  maxPerCycle: number;
  minTranscriptLength: number;
  processingTimeoutMinutes: number;
}

interface CycleOptions {
  spawnFn?: (prompt: string, agentId: string) => Promise<string>;
  maxPerCycle?: number;
}

interface CycleStats {
  processed: number;
  failed: number;
  skipped: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const REQUIRED_CATEGORIES = [
  'rapport_tone',
  'discovery_quality',
  'call_control',
  'pain_amplification',
  'offer_explanation',
  'objection_handling',
  'urgency_close_attempt',
  'confidence_authority',
  'next_steps_clarity',
  'overall_close_quality',
] as const;

const VALID_QUALITY_LABELS = ['poor', 'average', 'strong', 'elite'] as const;
const VALID_OUTCOMES = ['closed', 'follow_up', 'no_sale', 'disqualified'] as const;
const VALID_CLOSE_TYPES = ['deposit', 'full_close', 'partial_access', 'payment_plan', null] as const;

const MODEL_VERSION = 'worker-v3.0';
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

// ── Configuration ────────────────────────────────────────────────────────────

export function loadConfig(): WorkerConfig {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
  if (!supabaseKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    supabaseKey,
    model: 'cherry-reasoner',
    maxPerCycle: 3,
    minTranscriptLength: 500,
    processingTimeoutMinutes: 15,
  };
}

// ── Supabase REST helpers ────────────────────────────────────────────────────

function supabaseHeaders(config: WorkerConfig) {
  return {
    'apikey': config.supabaseKey,
    'Authorization': `Bearer ${config.supabaseKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

async function supabaseQuery(
  config: WorkerConfig,
  table: string,
  params: string,
): Promise<any[]> {
  const url = `${config.supabaseUrl}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: supabaseHeaders(config),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase GET ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function supabaseInsert(
  config: WorkerConfig,
  table: string,
  row: Record<string, any>,
): Promise<any> {
  const url = `${config.supabaseUrl}/rest/v1/${table}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders(config),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase INSERT ${table} failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function supabaseUpdate(
  config: WorkerConfig,
  table: string,
  filters: string,
  updates: Record<string, any>,
): Promise<any[]> {
  const url = `${config.supabaseUrl}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: supabaseHeaders(config),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase PATCH ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ── Step 1: Poll for pending requests ────────────────────────────────────────

async function pollPending(config: WorkerConfig): Promise<ScoringRequest[]> {
  const cutoff = new Date(Date.now() - config.processingTimeoutMinutes * 60_000).toISOString();

  // Get pending requests + stuck processing requests
  const params = new URLSearchParams({
    'or': `(status.eq.pending,and(status.eq.processing,updated_at.lt.${cutoff}))`,
    'order': 'created_at.asc',
    'limit': String(config.maxPerCycle),
    'select': 'id,call_id,transcript,rep_name,call_title,call_date,duration_seconds,status,created_at',
  });

  const requests = await supabaseQuery(config, 'scoring_requests', params.toString());

  if (requests.length === 0) return [];

  // Filter out requests for deleted calls
  const callIds = requests.map((r: any) => r.call_id);
  const deletedParams = new URLSearchParams({
    'id': `in.(${callIds.join(',')})`,
    'deleted_at': 'not.is.null',
    'select': 'id',
  });

  const deletedCalls = await supabaseQuery(config, 'calls', deletedParams.toString());
  const deletedIds = new Set(deletedCalls.map((c: any) => c.id));

  return requests.filter((r: any) => !deletedIds.has(r.call_id));
}

// ── Step 2: Atomic claim ─────────────────────────────────────────────────────

async function claimRequest(config: WorkerConfig, requestId: string): Promise<boolean> {
  try {
    const rows = await supabaseUpdate(
      config,
      'scoring_requests',
      `id=eq.${requestId}&status=in.(pending,processing)`,
      { status: 'processing', updated_at: new Date().toISOString() },
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ── Knowledge Base Loading ────────────────────────────────────────────────────

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const KB_ROOT = join(process.env.HOME || '/Users/papur', 'credit-club-kb');

function loadKBDir(subdir: string): string {
  try {
    const dir = join(KB_ROOT, subdir);
    const files = readdirSync(dir).filter(f => f.endsWith('.md')).sort();
    return files.map(f => {
      const content = readFileSync(join(dir, f), 'utf-8');
      return `### ${f.replace('.md', '').replace(/_/g, ' ').toUpperCase()}\n${content}`;
    }).join('\n\n---\n\n');
  } catch {
    return '';
  }
}

let _kbCache: { closes: string; objections: string; techniques: string; pricing: string } | null = null;

function getKB() {
  if (!_kbCache) {
    _kbCache = {
      closes: loadKBDir('closes'),
      objections: loadKBDir('objections'),
      techniques: loadKBDir('techniques'),
      pricing: loadKBDir('pricing'),
    };
  }
  return _kbCache;
}

// ── Step 3: Build scoring prompt ─────────────────────────────────────────────

function buildPrompt(transcript: string, repName?: string | null): string {
  const agentCtx = repName ? `The sales agent's name is "${repName}".` : '';
  const kb = getKB();

  return `You are an expert sales call analyst and coach for Credit Club, a UK-focused credit, business-card, points-and-travel education and implementation programme. ${agentCtx}

## Product Context — Credit Club

Credit Club helps UK clients:
- Improve/rebuild credit profiles and remove negative items
- Get approved for American Express, business cards, and premium credit products
- Master points, miles, Avios, hotel redemptions, business/first-class travel
- Full implementation programme (not just content): Skool community + training + 1-on-1 Telegram support
- Price: £3,000 standard | Deposits: £300-500 | Payment plans available

The ideal call follows: rapport → discovery → pain amplification → offer presentation → objection handling → close attempt → next steps.

## Close Types
- full_close: Full £3,000 paid on call
- deposit: Partial payment (£300-500) to secure place, remainder later
- payment_plan: Installment arrangement (e.g. £2,000 + £1,000)
- partial_access: £500 upfront, £2,500 after card approval (with refund guarantee)
- null: No close occurred

================================================================================
KNOWLEDGE BASE: CLOSE PATTERNS (Benchmark Examples)
================================================================================
Compare the transcript against these real close examples:

${kb.closes}

================================================================================
KNOWLEDGE BASE: OBJECTION HANDLING PATTERNS
================================================================================
Score the rep's objection handling against these benchmarks:

${kb.objections}

================================================================================
KNOWLEDGE BASE: SALES TECHNIQUES (Value Stacking & Urgency)
================================================================================
Did the rep use these techniques effectively?

${kb.techniques}

================================================================================
KNOWLEDGE BASE: PRICING PSYCHOLOGY
================================================================================
How did the rep handle pricing? Compare against these patterns:

${kb.pricing}

================================================================================
YOUR TASK
================================================================================

Analyze the transcript below. Compare the rep's performance against the knowledge base patterns above.

## Scoring Rubric — 10 Categories (0–10 each)

For each category, assign an integer score 0–10, explain your reasoning in 1–2 sentences, and quote a short verbatim excerpt from the transcript as evidence.

1. **rapport_tone** — Did the agent build genuine rapport? Warm, conversational, empathetic? Or robotic/scripted?
2. **discovery_quality** — Did the agent ask probing questions to understand the client's situation, goals, and timeline?
3. **call_control** — Did the agent guide the conversation or let the prospect ramble?
4. **pain_amplification** — Did the agent deepen the emotional impact of the prospect's credit problems?
5. **offer_explanation** — Was the Credit Club offer clearly explained? Benefits tied to specific pain points? Value stack used?
6. **objection_handling** — How well did the agent address concerns? Compare against KB objection patterns (price, timing, trust, spouse, need-to-think).
7. **urgency_close_attempt** — Did the agent create legitimate urgency? Did they actually ask for the sale?
8. **confidence_authority** — Did the agent sound confident, knowledgeable, and authoritative?
9. **next_steps_clarity** — Were clear next steps established with specific dates/actions?
10. **overall_close_quality** — Holistic assessment: did they close, attempt to close, offer alternatives (deposit/plan)?

## SCORING BEHAVIOR

**REWARD:** strong discovery, pain amplification, clear value stack, precise objection handling (isolate→empathize→reframe), clear close ask, deposit/commitment attempt, specific next steps, confidence
**PENALIZE:** generic rapport, weak discovery, no pain amplification, no close ask, no commitment attempt, vague next steps, soft objection handling, fake urgency, missing deposit attempt

## OUTPUT QUALITY REQUIREMENTS

Your output MUST include:
1. What the rep did well — cite specific transcript moments
2. What the rep did poorly — cite specific transcript moments
3. Exact moments that reduced close chance
4. Every objection that came up with verbatim quotes
5. Whether each objection was handled or missed
6. Whether the close was asked clearly
7. Whether deposit/commitment/payment plan was attempted
8. What the rep should have said/done differently (reference KB patterns)

## Coach Summary

Generate a coach_summary with:
1. did_well: 2-4 specific things with transcript evidence
2. needs_work: 2-4 specific weaknesses with transcript evidence
3. action_items: 2-4 specific actions for next time (reference KB techniques)

## Classification

- **outcome**: closed | follow_up | no_sale | disqualified
- **close_type**: deposit | full_close | partial_access | payment_plan | null
- **quality_label**: 0–40=poor, 41–60=average, 61–80=strong, 81–100=elite

## Output Format

Return ONLY valid JSON (no markdown fences, no commentary):

{
  "overall_score": <0-100>,
  "quality_label": "<poor|average|strong|elite>",
  "outcome": "<closed|follow_up|no_sale|disqualified>",
  "close_type": "<deposit|full_close|partial_access|payment_plan>" or null,
  "coach_summary": {
    "did_well": ["<specific with evidence>", ...],
    "needs_work": ["<specific weakness with evidence>", ...],
    "action_items": ["<specific action referencing KB>", ...]
  },
  "categories": {
    "rapport_tone": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "discovery_quality": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "call_control": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "pain_amplification": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "offer_explanation": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "objection_handling": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "urgency_close_attempt": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "confidence_authority": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "next_steps_clarity": { "score": <0-10>, "reasoning": "...", "evidence": "..." },
    "overall_close_quality": { "score": <0-10>, "reasoning": "...", "evidence": "..." }
  },
  "strengths": ["<specific with transcript evidence>"],
  "weaknesses": ["<specific with transcript evidence>"],
  "objections_detected": ["<objection with verbatim quote>"],
  "objections_handled_well": ["<what rep said that worked>"],
  "objections_missed": ["<what they should have done per KB>"],
  "next_coaching_actions": ["<specific actionable tip referencing KB>"],
  "coaching_markers": [
    {
      "timestamp": "MM:SS",
      "seconds": <number>,
      "title": "...",
      "category": "<scoring_category>",
      "type": "<positive|negative>",
      "severity": "<high|medium|low>",
      "note": "..."
    }
  ]
}

IMPORTANT:
- Return ONLY the JSON object, no other text
- Be honest and critical — most calls score 40–70
- Use actual transcript quotes as evidence — no generic filler
- Compare against KB patterns for scoring
- If no close occurred, set close_type to null (not the string "null")

## Transcript

${transcript}`;
}

// ── Step 4: Call Cherry reasoning agent via spawnFn ───────────────────────────

async function callCherryAgent(
  spawnFn: (prompt: string, agentId: string) => Promise<string>,
  prompt: string,
): Promise<string> {
  console.log('[AGENT] Invoking Cherry reasoning agent for scoring analysis...');
  
  // Use the reasoner agent (GPT-4o) for scoring analysis
  const result = await spawnFn(prompt, 'reasoner');
  
  console.log('[AGENT] Cherry agent returned response, length:', result.length);
  return result;
}

// ── Step 4b: Direct OpenAI fallback (only if spawnFn not provided) ───────────

async function callOpenAIDirect(config: WorkerConfig, prompt: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('No spawnFn provided and OPENAI_API_KEY not set. Run via OpenClaw heartbeat for production use.');
  }
  
  console.log('[AGENT] Falling back to direct OpenAI API (development mode only)');
  
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a sales call scoring expert. Return ONLY valid JSON. No markdown fences, no commentary.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return content;
}

// ── Step 5: Validate scoring output ──────────────────────────────────────────

function validateAndParse(raw: string): ScoringResult {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Not valid JSON: ${cleaned.slice(0, 200)}...`);
  }

  // overall_score
  if (typeof parsed.overall_score !== 'number' || parsed.overall_score < 0 || parsed.overall_score > 100) {
    throw new Error(`Invalid overall_score: ${parsed.overall_score}`);
  }

  // quality_label
  if (!VALID_QUALITY_LABELS.includes(parsed.quality_label)) {
    throw new Error(`Invalid quality_label: ${parsed.quality_label}`);
  }

  // outcome
  if (!VALID_OUTCOMES.includes(parsed.outcome)) {
    throw new Error(`Invalid outcome: ${parsed.outcome}`);
  }

  // close_type (null is valid)
  if (parsed.close_type !== null && !['deposit', 'full_close', 'partial_access', 'payment_plan'].includes(parsed.close_type)) {
    throw new Error(`Invalid close_type: ${parsed.close_type}`);
  }

  // All 10 categories
  if (!parsed.categories || typeof parsed.categories !== 'object') {
    throw new Error('Missing categories object');
  }
  for (const cat of REQUIRED_CATEGORIES) {
    const entry = parsed.categories[cat];
    if (!entry) throw new Error(`Missing category: ${cat}`);
    if (typeof entry.score !== 'number' || entry.score < 0 || entry.score > 10) {
      throw new Error(`Invalid score for ${cat}: ${entry.score}`);
    }
    if (typeof entry.reasoning !== 'string' || !entry.reasoning) {
      throw new Error(`Missing reasoning for ${cat}`);
    }
    if (typeof entry.evidence !== 'string' || !entry.evidence) {
      throw new Error(`Missing evidence for ${cat}`);
    }
  }

  // Required arrays
  for (const field of ['strengths', 'weaknesses', 'objections_detected', 'objections_handled_well']) {
    if (!Array.isArray(parsed[field])) {
      throw new Error(`Missing or invalid array: ${field}`);
    }
  }

  // Optional arrays — default to empty
  if (!Array.isArray(parsed.objections_missed)) parsed.objections_missed = [];
  if (!Array.isArray(parsed.next_coaching_actions)) parsed.next_coaching_actions = [];
  if (!Array.isArray(parsed.coaching_markers)) parsed.coaching_markers = [];

  // Coach summary — default to empty if missing
  if (!parsed.coach_summary || typeof parsed.coach_summary !== 'object') {
    parsed.coach_summary = { did_well: [], needs_work: [], action_items: [] };
  } else {
    if (!Array.isArray(parsed.coach_summary.did_well)) parsed.coach_summary.did_well = [];
    if (!Array.isArray(parsed.coach_summary.needs_work)) parsed.coach_summary.needs_work = [];
    if (!Array.isArray(parsed.coach_summary.action_items)) parsed.coach_summary.action_items = [];
  }

  return parsed as ScoringResult;
}

// ── Step 6: Write score to call_scores ───────────────────────────────────────

async function writeScore(
  config: WorkerConfig,
  callId: string,
  requestId: string,
  result: ScoringResult,
  repName?: string | null,
  callTitle?: string | null,
): Promise<string> {
  // Derive enhanced fields
  const grade = result.overall_score >= 90 ? 'A+' : result.overall_score >= 80 ? 'A' : result.overall_score >= 70 ? 'B' : result.overall_score >= 60 ? 'C' : result.overall_score >= 50 ? 'D' : 'F';
  
  const catScore = (name: string) => (result.categories as any)?.[name]?.score || 0;
  const scoreBreakdown = {
    close_quality: Math.round((catScore('overall_close_quality') / 10) * 25),
    objection_handling: Math.round((catScore('objection_handling') / 10) * 20),
    value_stacking: Math.round((catScore('offer_explanation') / 10) * 20),
    urgency_usage: Math.round((catScore('urgency_close_attempt') / 10) * 15),
    discovery_rapport: Math.round(((catScore('discovery_quality') + catScore('rapport_tone')) / 20) * 10),
    professionalism: Math.round(((catScore('confidence_authority') + catScore('call_control')) / 20) * 10),
  };
  
  const closeOutcome = result.outcome === 'closed' ? 'closed' : (result.outcome === 'follow_up' || result.close_type === 'deposit') ? 'follow_up' : 'no_sale';
  
  const keyQuotes: Array<{quote: string; context: string; type: string}> = [];
  for (const [key, catData] of Object.entries(result.categories || {})) {
    if ((catData as any).score >= 7 && (catData as any).evidence) {
      keyQuotes.push({ quote: (catData as any).evidence, context: key.replace(/_/g, ' '), type: 'positive' });
    }
  }

  const row = {
    call_id: callId,
    scoring_request_id: requestId,
    org_id: DEFAULT_ORG_ID,
    model_version: MODEL_VERSION,
    rep_name: repName || 'Unknown',
    call_title: callTitle || 'Untitled',
    
    // Core scores
    overall_score: result.overall_score,
    score_total: result.overall_score,
    quality_label: result.quality_label,
    outcome: result.outcome,
    close_type: result.close_type,
    
    // Enhanced: grade
    grade,
    score_grade: grade,
    
    // Enhanced: score breakdown
    score_breakdown: scoreBreakdown,
    
    // Enhanced: close analysis
    close_outcome: closeOutcome,
    close_confidence: 70,
    
    // Enhanced: techniques
    techniques_detected: {
      value_stacking: { score: catScore('offer_explanation'), components_used: [] as string[], evidence: [] as string[] },
      urgency_creation: { score: catScore('urgency_close_attempt'), types_used: [] as string[], evidence: [] as string[] },
    },
    value_stacking_score: catScore('offer_explanation'),
    urgency_score: catScore('urgency_close_attempt'),
    objection_handling_score: catScore('objection_handling'),
    
    // Categories
    categories: result.categories,
    
    // Arrays
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    objections_detected: result.objections_detected,
    objections_handled_well: result.objections_handled_well,
    objections_missed: result.objections_missed,
    next_coaching_actions: result.next_coaching_actions,
    coaching_feedback: result.next_coaching_actions,
    coaching_markers: result.coaching_markers,
    
    // Enhanced: detailed data
    key_quotes: keyQuotes.slice(0, 5),
    missed_opportunities: [...(result.objections_missed || []), ...(result.weaknesses || [])],
    
    // Coach Summary
    coach_summary: result.coach_summary || { did_well: [], needs_work: [], action_items: [] },
    
    status: 'completed',
    created_at: new Date().toISOString(),
  };

  const inserted = await supabaseInsert(config, 'call_scores', row);

  if (!inserted?.id) {
    throw new Error('call_scores insert returned no id');
  }

  return inserted.id;
}

// ── Step 7: Mark completed/failed ────────────────────────────────────────────

async function markCompleted(config: WorkerConfig, requestId: string, scoreId: string): Promise<void> {
  await supabaseUpdate(
    config,
    'scoring_requests',
    `id=eq.${requestId}`,
    {
      status: 'completed',
      score_id: scoreId,
      updated_at: new Date().toISOString(),
    },
  );
}

async function markFailed(config: WorkerConfig, requestId: string, error: string): Promise<void> {
  try {
    await supabaseUpdate(
      config,
      'scoring_requests',
      `id=eq.${requestId}`,
      {
        status: 'failed',
        error_message: error.slice(0, 2000),
        updated_at: new Date().toISOString(),
      },
    );
  } catch (e: any) {
    console.error(`[WORKER] Failed to mark request ${requestId} as failed:`, e.message);
  }
}

// ── Step 8: Post-scoring learning extraction ─────────────────────────────────

async function runLearningExtraction(
  config: WorkerConfig,
  request: ScoringRequest,
  result: ScoringResult,
  scoreId: string,
): Promise<void> {
  const patterns: any[] = [];
  const base = {
    org_id: DEFAULT_ORG_ID,
    source_call_id: request.call_id,
    source_score_id: scoreId,
    source_rep_name: request.rep_name || null,
    source_call_date: request.call_date || null,
    status: 'pending_review',
  };

  // High-scoring categories → benchmark material
  for (const [catName, catData] of Object.entries(result.categories)) {
    if (catData.score >= 8 && catData.evidence) {
      patterns.push({
        ...base,
        pattern_category: catName,
        exact_quote: catData.evidence,
        explanation: `Scored ${catData.score}/10: ${catData.reasoning}`,
        suggested_action: 'Consider for benchmark library',
        ai_confidence: Math.min(catData.score / 10, 0.95),
      });
    }
  }

  // Well-handled objections
  for (const obj of result.objections_handled_well) {
    patterns.push({
      ...base,
      pattern_category: 'objection_handling',
      exact_quote: obj,
      explanation: 'Objection handled well — potential training example.',
      suggested_action: 'Review for objection library',
      ai_confidence: 0.7,
    });
  }

  // Elite calls
  if (result.overall_score >= 85) {
    patterns.push({
      ...base,
      pattern_category: 'other',
      exact_quote: `Overall: ${result.overall_score}/100 (${result.quality_label})`,
      explanation: `Elite call. Strengths: ${result.strengths.join(', ')}`,
      suggested_action: 'Promote to benchmark library',
      ai_confidence: 0.9,
    });
  }

  // Save patterns
  for (const pattern of patterns) {
    try {
      await supabaseInsert(config, 'learning_queue', pattern);
    } catch {
      // Non-fatal — learning extraction failure shouldn't break scoring
    }
  }
}

// ── Process a single request ─────────────────────────────────────────────────

async function processOne(
  config: WorkerConfig,
  request: ScoringRequest,
  spawnFn?: (prompt: string, agentId: string) => Promise<string>,
): Promise<string> {
  // Validate transcript
  if (!request.transcript || request.transcript.trim().length < config.minTranscriptLength) {
    throw new Error(`Transcript too short (${request.transcript?.trim().length || 0} chars, minimum ${config.minTranscriptLength})`);
  }

  // Build prompt
  const prompt = buildPrompt(request.transcript, request.rep_name);

  // Call reasoning agent
  let raw: string;
  if (spawnFn) {
    // Production: Use Cherry reasoning agent via spawnFn
    raw = await callCherryAgent(spawnFn, prompt);
  } else {
    // Development fallback: Direct OpenAI API
    raw = await callOpenAIDirect(config, prompt);
  }

  // Validate output strictly
  const result = validateAndParse(raw);

  // Write score — this creates the real UUID
  const scoreId = await writeScore(config, request.call_id, request.id, result, request.rep_name, request.call_title);

  // Learning extraction (non-fatal)
  try {
    await runLearningExtraction(config, request, result, scoreId);
  } catch (e: any) {
    console.warn(`[WORKER] Learning extraction failed (non-fatal): ${e.message}`);
  }

  return scoreId;
}

// ── Main cycle ───────────────────────────────────────────────────────────────

export async function runWorkerCycle(options?: CycleOptions): Promise<CycleStats> {
  const cfg = loadConfig();
  const spawnFn = options?.spawnFn;
  const maxPerCycle = options?.maxPerCycle ?? cfg.maxPerCycle;
  
  const stats: CycleStats = { processed: 0, failed: 0, skipped: 0 };

  // Poll — zero AI cost
  let requests: ScoringRequest[];
  try {
    requests = await pollPending(cfg);
  } catch (e: any) {
    console.error(`[WORKER] Poll failed: ${e.message}`);
    return stats;
  }

  if (requests.length === 0) {
    console.log('[WORKER] No pending requests, exiting (zero AI cost)');
    return stats; // Nothing to do — zero cost
  }

  console.log(`[WORKER] Found ${requests.length} pending request(s)`);
  
  // Limit to maxPerCycle
  requests = requests.slice(0, maxPerCycle);

  // Process each sequentially
  for (const request of requests) {
    // Claim atomically
    const claimed = await claimRequest(cfg, request.id);
    if (!claimed) {
      console.log(`[WORKER] Request ${request.id} already claimed by another worker`);
      stats.skipped++;
      continue;
    }
    
    console.log(`[WORKER] Claimed request ${request.id} for call ${request.call_id}`);

    try {
      const scoreId = await processOne(cfg, request, spawnFn);
      await markCompleted(cfg, request.id, scoreId);
      stats.processed++;
      console.log(`[WORKER] ✅ ${request.id} → score ${scoreId} (call ${request.call_id})`);
    } catch (e: any) {
      stats.failed++;
      const msg = e?.message || String(e);
      console.error(`[WORKER] ❌ ${request.id}: ${msg}`);
      await markFailed(cfg, request.id, msg);
    }
  }

  return stats;
}

// ── Deprecated: Use runWorkerCycle instead ───────────────────────────────────

export async function runScoringCycle(config?: WorkerConfig): Promise<CycleStats> {
  console.warn('[WORKER] runScoringCycle is deprecated, use runWorkerCycle with spawnFn');
  return runWorkerCycle();
}
