/**
 * Credit Club Scoring Worker — THE ONE WORKER (v3.2)
 * 
 * Self-contained scoring pipeline with:
 * - FIXED 12-benchmark library (no auto-learning)
 * - Transcript chunking to prevent token overflow
 * - Dynamic KB loading (only relevant files)
 * - Benchmark-based scoring comparison
 * 
 * @version 3.2.0 — Fixed 12-benchmark library, benchmark comparison output
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

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

interface BenchmarkComparison {
  matched: string[];
  missed: string[];
  what_to_say_instead: string[];
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
  benchmark_comparison?: BenchmarkComparison;
}

interface WorkerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  model: string;
  maxPerCycle: number;
  minTranscriptLength: number;
  processingTimeoutMinutes: number;
  maxChunkTokens: number;
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
const VALID_CLOSE_TYPES = ['deposit', 'full_close', 'partial_access', 'payment_plan'] as const;

const MODEL_VERSION = 'worker-v3.2';
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
const KB_ROOT = join(process.env.HOME || '/Users/papur', 'credit-club-kb');
const BENCHMARK_ROOT = join(KB_ROOT, 'benchmarks');

// Approximate tokens: ~4 chars per token for English
const CHARS_PER_TOKEN = 4;
const MAX_CHUNK_CHARS = 8000; // ~2000 tokens for transcript content

// ── THE FIXED 12 BENCHMARK CALLS ─────────────────────────────────────────────

const BENCHMARK_LIBRARY = {
  full_close: [
    { name: 'Bina Patel', file: 'bina_patel.md' },
    { name: 'Luke Cockle', file: 'luke_cockle.md' },
    { name: 'Emma Foster', file: 'emma_foster.md' },
  ],
  deposit: [
    { name: 'Omar Pike', file: 'omar_pike.md' },
    { name: 'Fernando Cotrim', file: 'fernando_cotrim.md' },
    { name: 'Georgia Smith', file: 'georgia_smith.md' },
  ],
  partial_access: [
    { name: 'Mohit Garg', file: 'mohit_garg.md' },
    { name: 'Rachel', file: 'rachel.md' },
    { name: 'Andrika Das', file: 'andrika_das.md' },
  ],
  payment_plan: [
    { name: 'Shamil Morjaria', file: 'shamil_morjaria.md' },
    { name: 'Nirmohan Singh Grover', file: 'nirmohan_singh_grover.md' },
    { name: 'Prismek Wegroc', file: 'prismek_wegroc.md' },
  ],
} as const;

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
    maxChunkTokens: 6000,
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

  const params = new URLSearchParams({
    'or': `(status.eq.pending,and(status.eq.processing,updated_at.lt.${cutoff}))`,
    'order': 'created_at.asc',
    'limit': String(config.maxPerCycle),
    'select': 'id,call_id,transcript,rep_name,call_title,call_date,duration_seconds,status,created_at',
  });

  const requests = await supabaseQuery(config, 'scoring_requests', params.toString());

  if (requests.length === 0) return [];

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

// ── Transcript Chunking ──────────────────────────────────────────────────────

function chunkTranscript(transcript: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (transcript.length <= maxChars) {
    return [transcript];
  }

  const chunks: string[] = [];
  const lines = transcript.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length > 1) {
    const overlappingChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      let chunk = `[PART ${i + 1} OF ${chunks.length}]\n\n`;
      
      if (i > 0) {
        const prevLines = chunks[i - 1].split('\n').slice(-5);
        chunk += `--- CONTEXT FROM PREVIOUS SECTION ---\n${prevLines.join('\n')}\n--- NEW SECTION ---\n\n`;
      }
      
      chunk += chunks[i];
      overlappingChunks.push(chunk);
    }
    return overlappingChunks;
  }

  return chunks;
}

// ── FIXED BENCHMARK LIBRARY LOADING ───────────────────────────────────────────

/**
 * Load a specific benchmark call from the fixed 12-call library.
 * This is the ONLY source of winning call examples.
 */
function loadBenchmarkCall(closeType: string, filename: string): string {
  try {
    const filepath = join(BENCHMARK_ROOT, closeType, filename);
    return readFileSync(filepath, 'utf-8');
  } catch (e) {
    console.warn(`[BENCHMARK] Could not load ${closeType}/${filename}`);
    return '';
  }
}

/**
 * Load ALL benchmarks for a specific close type (3 calls each).
 */
function loadBenchmarksForCloseType(closeType: keyof typeof BENCHMARK_LIBRARY): string {
  const benchmarks = BENCHMARK_LIBRARY[closeType];
  const parts: string[] = [];
  
  for (const bm of benchmarks) {
    const content = loadBenchmarkCall(closeType, bm.file);
    if (content && !content.includes('[PLACEHOLDER')) {
      parts.push(`## ${bm.name}\n${content}`);
    } else {
      parts.push(`## ${bm.name}\n[Benchmark transcript pending - placeholder only]`);
    }
  }
  
  return parts.join('\n\n---\n\n');
}

/**
 * Load ALL 12 benchmarks (for maximum context mode).
 */
function loadAllBenchmarks(): string {
  const parts: string[] = [];
  
  for (const [closeType, benchmarks] of Object.entries(BENCHMARK_LIBRARY)) {
    parts.push(`\n=== ${closeType.toUpperCase().replace('_', ' ')} EXAMPLES ===\n`);
    for (const bm of benchmarks) {
      const content = loadBenchmarkCall(closeType, bm.file);
      if (content && !content.includes('[PLACEHOLDER')) {
        parts.push(`## ${bm.name}\n${content}`);
      }
    }
  }
  
  return parts.join('\n');
}

/**
 * Detect likely close type from transcript to select relevant benchmarks.
 */
function detectLikelyCloseType(transcript: string): keyof typeof BENCHMARK_LIBRARY {
  const lower = transcript.toLowerCase();
  
  // Check for explicit mentions
  if (/\bpayment.?plan\b|instalment|split.?payment/i.test(lower)) return 'payment_plan';
  if (/\bpartial.?access\b|£500\s*(upfront|now)|after.?approval/i.test(lower)) return 'partial_access';
  if (/\bdeposit\b|£300|£500|secure.*place/i.test(lower)) return 'deposit';
  if (/\bpaid.?in.?full\b|£3,?000.*(today|now|paid)/i.test(lower)) return 'full_close';
  
  // Check for price resistance patterns
  if (/\bcan.t.afford\b|too expensive|need.to.check|partner|wife|husband/i.test(lower)) return 'deposit';
  if (/\bneed.to.think\b|let.me.think/i.test(lower)) return 'partial_access';
  
  // Default to deposit (most common successful close type)
  return 'deposit';
}

// ── Knowledge Base Loading (non-benchmark) ───────────────────────────────────

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

function getDynamicKB(transcript: string) {
  const themes = {
    hasPricingObjection: /\b(price|pricing|expensive|cost|money|£\d|pounds?|afford|budget)\b/i.test(transcript) ||
      /too much|can't afford|not sure about the price/i.test(transcript),
    hasHesitation: /\b(think about it|let me think|discuss with|talk to my|partner|wife|husband)\b/i.test(transcript) ||
      /need to (talk|discuss|check|ask)/i.test(transcript),
  };
  
  const kb = getKB();
  return {
    closes: kb.closes,
    objections: themes.hasPricingObjection || themes.hasHesitation ? kb.objections : '',
    techniques: kb.techniques,
    pricing: themes.hasPricingObjection ? kb.pricing : '',
  };
}

// ── Step 3: Build scoring prompt with benchmarks ─────────────────────────────

function buildMinimalPrompt(transcript: string, repName?: string | null): string {
  const agentCtx = repName ? `The sales agent's name is "${repName}".` : '';
  
  return `You are an expert sales call analyst for Credit Club, a UK credit/points education program (£3,000 price). ${agentCtx}

Evaluate this sales call transcript on 10 categories (0-10 each):
1. rapport_tone - genuine rapport or robotic?
2. discovery_quality - probing questions asked?
3. call_control - guided conversation?
4. pain_amplification - emotional impact deepened?
5. offer_explanation - value stack used?
6. objection_handling - isolate→empathize→reframe?
7. urgency_close_attempt - asked for sale with urgency?
8. confidence_authority - sounded knowledgeable?
9. next_steps_clarity - specific next steps?
10. overall_close_quality - close attempted? deposit offered?

Return ONLY JSON with overall_score, quality_label, outcome, close_type, coach_summary, categories, strengths, weaknesses, objections_detected, objections_handled_well, objections_missed, next_coaching_actions, coaching_markers.

Transcript:
${transcript}`;
}

function buildPrompt(
  transcript: string, 
  repName?: string | null, 
  useMinimal: boolean = false,
  benchmarkCloseType?: keyof typeof BENCHMARK_LIBRARY
): string {
  if (useMinimal) {
    return buildMinimalPrompt(transcript, repName);
  }
  
  const agentCtx = repName ? `The sales agent's name is "${repName}".` : '';
  
  // Load relevant benchmarks based on detected close type
  const likelyCloseType = benchmarkCloseType || detectLikelyCloseType(transcript);
  const relevantBenchmarks = loadBenchmarksForCloseType(likelyCloseType);
  const allBenchmarks = loadAllBenchmarks();
  
  const kb = getDynamicKB(transcript);

  const kbSections: string[] = [];
  
  if (kb.closes) {
    kbSections.push(`================================================================================
KNOWLEDGE BASE: CLOSE PATTERNS
================================================================================
${kb.closes}`);
  }
  
  if (kb.objections) {
    kbSections.push(`================================================================================
KNOWLEDGE BASE: OBJECTION HANDLING
================================================================================
${kb.objections}`);
  }
  
  if (kb.techniques) {
    kbSections.push(`================================================================================
KNOWLEDGE BASE: SALES TECHNIQUES
================================================================================
${kb.techniques}`);
  }
  
  if (kb.pricing) {
    kbSections.push(`================================================================================
KNOWLEDGE BASE: PRICING PSYCHOLOGY
================================================================================
${kb.pricing}`);
  }

  const kbContent = kbSections.join('\n\n');

  return `You are an expert sales call analyst and coach for Credit Club, a UK-focused credit, business-card, points-and-travel education programme. ${agentCtx}

## Product Context — Credit Club

Credit Club helps UK clients:
- Improve/rebuild credit profiles and remove negative items
- Get approved for American Express, business cards, and premium credit products
- Master points, miles, Avios, hotel redemptions, business/first-class travel
- Full implementation programme: Skool community + training + 1-on-1 Telegram support
- Price: £3,000 standard | Deposits: £300-500 | Payment plans available

## Close Types
- full_close: Full £3,000 paid on call
- deposit: Partial payment (£300-500) to secure place
- payment_plan: Installment arrangement
- partial_access: £500 upfront, £2,500 after card approval
- null: No close occurred

================================================================================
FIXED BENCHMARK LIBRARY — THE 12 WINNING CALLS
================================================================================

You are comparing this call against Credit Club's proven winning call library.
These are the ONLY benchmark examples — no auto-learning, no dynamic replacement.

### PRIMARY BENCHMARKS (${likelyCloseType.toUpperCase().replace('_', ' ')})
These 3 calls are the closest match to this call's likely close type:

${relevantBenchmarks}

### ALL 12 BENCHMARK CALLS (Reference)
${allBenchmarks}

${kbContent}

================================================================================
YOUR TASK — BENCHMARK-BASED SCORING
================================================================================

Compare the transcript below against the winning benchmark calls above.
Score based on how closely the rep follows the proven winning patterns.

## CRITICAL EVALUATION CRITERIA

✓ **AMPLIFIED PAIN** — Did they deepen emotional impact like the benchmarks?
✓ **ISOLATED OBJECTIONS** — Did they isolate before answering? (Benchmark pattern)
✓ **USED VALUE STACKING** — Did they stack value before price? (Benchmark pattern)
✓ **ATTEMPTED DEPOSIT/COMMITMENT CLOSE** — Did they ask for the sale like winners?
✓ **CREATED URGENCY PROPERLY** — Was urgency based on real scarcity?
✓ **HANDLED PRICING OBJECTIONS CORRECTLY** — Did they isolate→empathize→reframe→close?

## PENALTY RULES — DEDUCT POINTS IF:

❌ **NO CLOSE ATTEMPT** (-20 points)
❌ **FAILED TO AMPLIFY PAIN** (-15 points)
❌ **GENERIC RAPPORT** (-10 points)
❌ **FAILED TO ISOLATE OBJECTIONS** (-15 points)
❌ **ALLOWED DELAY WITHOUT BRIDGE CLOSE** (-15 points)
❌ **NO DEPOSIT ATTEMPT** (-10 points)

## Scoring Rubric — 10 Categories (0–10 each)

For each category, assign score 0–10, explain reasoning, and quote evidence.

1. **rapport_tone** — Genuine rapport or robotic?
2. **discovery_quality** — Probing questions to understand situation?
3. **call_control** — Guided conversation or let prospect ramble?
4. **pain_amplification** — Deepened emotional impact of credit problems?
5. **offer_explanation** — Clear offer? Value stack used?
6. **objection_handling** — Isolate→empathize→reframe→close?
7. **urgency_close_attempt** — Created urgency? Asked for sale?
8. **confidence_authority** — Sounded confident and knowledgeable?
9. **next_steps_clarity** — Clear next steps with dates?
10. **overall_close_quality** — Close attempted? Alternatives offered?

## BENCHMARK COMPARISON SECTION (Required)

After scoring, generate a benchmark_comparison section with:

- **matched**: Specific things the rep did that matched the winning benchmark calls (quote the benchmark)
- **missed**: Specific winning patterns the rep failed to use (reference the benchmark they should have used)
- **what_to_say_instead**: Exact quotes from benchmark calls they should have said

This must reference the actual 12 benchmark calls, not generic advice.

## Output Format

Return ONLY valid JSON (no markdown fences):

{
  "overall_score": 0-100,
  "quality_label": "poor|average|strong|elite",
  "outcome": "closed|follow_up|no_sale|disqualified",
  "close_type": null | "deposit|full_close|partial_access|payment_plan",
  "coach_summary": {
    "did_well": ["specific with evidence"],
    "needs_work": ["specific weakness with evidence"],
    "action_items": ["specific action referencing benchmark"]
  },
  "categories": {
    "rapport_tone": { "score": 0-10, "reasoning": "...", "evidence": "..." },
    ... (all 10 categories)
  },
  "strengths": [],
  "weaknesses": [],
  "objections_detected": [],
  "objections_handled_well": [],
  "objections_missed": [],
  "next_coaching_actions": [],
  "coaching_markers": [],
  "benchmark_comparison": {
    "matched": ["Rep did X — this matched Omar Pike's technique of..."],
    "missed": ["Rep failed to Y — Fernando Kotrim handled this by..."],
    "what_to_say_instead": ["Instead of '...', say what Georgia Smith said: '...'"]
  }
}

IMPORTANT:
- Return ONLY JSON
- Be honest — most calls score 40-70
- Use actual transcript quotes as evidence
- Compare against the 12 benchmark calls
- benchmark_comparison MUST reference specific benchmark names and quotes

## Transcript

${transcript}`;
}

// ── Rate limiting helper ─────────────────────────────────────────────────────

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Step 4: Call Cherry reasoning agent ──────────────────────────────────────

async function callCherryAgent(
  spawnFn: (prompt: string, agentId: string) => Promise<string>,
  prompt: string,
): Promise<string> {
  console.log('[AGENT] Invoking Cherry reasoning agent...');
  const result = await spawnFn(prompt, 'reasoner');
  console.log('[AGENT] Response length:', result.length);
  return result;
}

// ── Step 4b: Direct OpenAI fallback ──────────────────────────────────────────

async function callOpenAIDirect(config: WorkerConfig, prompt: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('No spawnFn and OPENAI_API_KEY not set');
  }
  
  console.log('[AGENT] Using direct OpenAI API');
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a sales call scoring expert. Return ONLY valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429) {
          const waitTime = attempt * 8000;
          console.log(`[RATE LIMIT] Waiting ${waitTime}ms`);
          await delay(waitTime);
          continue;
        }
        throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
      }

      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    } catch (e: any) {
      if (attempt === 3) throw e;
      await delay(2000 * attempt);
    }
  }
  throw new Error('Failed after 3 attempts');
}

// ── Step 5: Validate scoring output ──────────────────────────────────────────

function validateAndParse(raw: string): ScoringResult {
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

  if (typeof parsed.overall_score !== 'number' || parsed.overall_score < 0 || parsed.overall_score > 100) {
    throw new Error(`Invalid overall_score: ${parsed.overall_score}`);
  }

  if (!VALID_QUALITY_LABELS.includes(parsed.quality_label)) {
    throw new Error(`Invalid quality_label: ${parsed.quality_label}`);
  }

  if (!VALID_OUTCOMES.includes(parsed.outcome)) {
    throw new Error(`Invalid outcome: ${parsed.outcome}`);
  }

  if (parsed.close_type !== null && parsed.close_type !== undefined) {
    if (parsed.close_type === 'full_close') {
      parsed.close_type = null;
    } else if (typeof parsed.close_type === 'string' && !VALID_CLOSE_TYPES.includes(parsed.close_type as any)) {
      throw new Error(`Invalid close_type: ${parsed.close_type}`);
    }
  }

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

  for (const field of ['strengths', 'weaknesses', 'objections_detected', 'objections_handled_well']) {
    if (!Array.isArray(parsed[field])) {
      throw new Error(`Missing or invalid array: ${field}`);
    }
  }

  if (!Array.isArray(parsed.objections_missed)) parsed.objections_missed = [];
  if (!Array.isArray(parsed.next_coaching_actions)) parsed.next_coaching_actions = [];
  if (!Array.isArray(parsed.coaching_markers)) parsed.coaching_markers = [];

  if (!parsed.coach_summary || typeof parsed.coach_summary !== 'object') {
    parsed.coach_summary = { did_well: [], needs_work: [], action_items: [] };
  } else {
    if (!Array.isArray(parsed.coach_summary.did_well)) parsed.coach_summary.did_well = [];
    if (!Array.isArray(parsed.coach_summary.needs_work)) parsed.coach_summary.needs_work = [];
    if (!Array.isArray(parsed.coach_summary.action_items)) parsed.coach_summary.action_items = [];
  }

  // Ensure benchmark_comparison exists with proper structure
  if (!parsed.benchmark_comparison || typeof parsed.benchmark_comparison !== 'object') {
    parsed.benchmark_comparison = { matched: [], missed: [], what_to_say_instead: [] };
  } else {
    if (!Array.isArray(parsed.benchmark_comparison.matched)) parsed.benchmark_comparison.matched = [];
    if (!Array.isArray(parsed.benchmark_comparison.missed)) parsed.benchmark_comparison.missed = [];
    if (!Array.isArray(parsed.benchmark_comparison.what_to_say_instead)) parsed.benchmark_comparison.what_to_say_instead = [];
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
    
    overall_score: result.overall_score,
    score_total: result.overall_score,
    quality_label: result.quality_label,
    outcome: result.outcome,
    close_type: result.close_type,
    
    grade,
    score_grade: grade,
    score_breakdown: scoreBreakdown,
    
    close_outcome: closeOutcome,
    close_confidence: 70,
    
    techniques_detected: {
      value_stacking: { score: catScore('offer_explanation'), components_used: [] as string[], evidence: [] as string[] },
      urgency_creation: { score: catScore('urgency_close_attempt'), types_used: [] as string[], evidence: [] as string[] },
    },
    value_stacking_score: catScore('offer_explanation'),
    urgency_score: catScore('urgency_close_attempt'),
    objection_handling_score: catScore('objection_handling'),
    
    categories: result.categories,
    
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    objections_detected: result.objections_detected,
    objections_handled_well: result.objections_handled_well,
    objections_missed: result.objections_missed,
    next_coaching_actions: result.next_coaching_actions,
    coaching_feedback: result.next_coaching_actions,
    coaching_markers: result.coaching_markers,
    
    key_quotes: keyQuotes.slice(0, 5),
    missed_opportunities: [...(result.objections_missed || []), ...(result.weaknesses || [])],
    
    coach_summary: result.coach_summary || { did_well: [], needs_work: [], action_items: [] },
    
    // NEW: Benchmark comparison stored in metadata
    metadata: {
      benchmark_comparison: result.benchmark_comparison || { matched: [], missed: [], what_to_say_instead: [] },
    },
    
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

// ── Process a single request ─────────────────────────────────────────────────

async function processOne(
  config: WorkerConfig,
  request: ScoringRequest,
  spawnFn?: (prompt: string, agentId: string) => Promise<string>,
): Promise<string> {
  if (!request.transcript || request.transcript.trim().length < config.minTranscriptLength) {
    throw new Error(`Transcript too short (${request.transcript?.trim().length || 0} chars, minimum ${config.minTranscriptLength})`);
  }

  const estimatedTranscriptTokens = Math.round(request.transcript.length / CHARS_PER_TOKEN);
  const useMinimalPrompt = estimatedTranscriptTokens > 15000;
  
  if (useMinimalPrompt) {
    console.log(`[WORKER] Large transcript (${estimatedTranscriptTokens} tokens), using minimal prompt`);
  }
  
  // Detect likely close type for benchmark selection
  const likelyCloseType = detectLikelyCloseType(request.transcript);
  console.log(`[WORKER] Detected close type: ${likelyCloseType}`);
  
  const chunks = chunkTranscript(request.transcript, MAX_CHUNK_CHARS);
  console.log(`[WORKER] Transcript chunked into ${chunks.length} part(s)`);

  if (chunks.length === 1) {
    const prompt = buildPrompt(chunks[0], request.rep_name, useMinimalPrompt, likelyCloseType);
    const estimatedTokens = Math.round(prompt.length / CHARS_PER_TOKEN);
    console.log(`[WORKER] Prompt size: ~${estimatedTokens} tokens`);
    
    let raw: string;
    if (spawnFn) {
      raw = await callCherryAgent(spawnFn, prompt);
    } else {
      raw = await callOpenAIDirect(config, prompt);
    }

    const result = validateAndParse(raw);
    const scoreId = await writeScore(config, request.call_id, request.id, result, request.rep_name, request.call_title);

    return scoreId;
  }

  console.log(`[WORKER] Multi-chunk processing: ${chunks.length} chunks`);
  
  const chunkResults: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      console.log(`[WORKER] Rate limit delay: 5000ms before chunk ${i + 1}`);
      await delay(5000);
    }
    
    const chunkPrompt = buildPrompt(chunks[i], request.rep_name, useMinimalPrompt, likelyCloseType);
    const estimatedTokens = Math.round(chunkPrompt.length / CHARS_PER_TOKEN);
    console.log(`[WORKER] Processing chunk ${i + 1}/${chunks.length}: ~${estimatedTokens} tokens`);
    
    let raw: string;
    if (spawnFn) {
      raw = await callCherryAgent(spawnFn, chunkPrompt);
    } else {
      raw = await callOpenAIDirect(config, chunkPrompt);
    }
    
    try {
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim());
      chunkResults.push(parsed);
    } catch {
      console.warn(`[WORKER] Chunk ${i + 1} parse failed, skipping`);
    }
  }

  if (chunkResults.length === 0) {
    throw new Error('All chunks failed to parse');
  }

  const combined = combineChunkResults(chunkResults);
  const result = validateAndParse(JSON.stringify(combined));
  
  const scoreId = await writeScore(config, request.call_id, request.id, result, request.rep_name, request.call_title);

  return scoreId;
}

function combineChunkResults(chunks: any[]): any {
  const scored = chunks.map(c => ({
    chunk: c,
    score: Object.keys(c.categories || {}).length + 
           (c.strengths?.length || 0) + 
           (c.weaknesses?.length || 0)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].chunk;
  
  const avgOverall = Math.round(chunks.reduce((sum, c) => sum + (c.overall_score || 0), 0) / chunks.length);
  
  // Merge benchmark_comparisons from all chunks
  const allMatched: string[] = [];
  const allMissed: string[] = [];
  const allWhatToSay: string[] = [];
  
  for (const c of chunks) {
    if (c.benchmark_comparison?.matched) allMatched.push(...c.benchmark_comparison.matched);
    if (c.benchmark_comparison?.missed) allMissed.push(...c.benchmark_comparison.missed);
    if (c.benchmark_comparison?.what_to_say_instead) allWhatToSay.push(...c.benchmark_comparison.what_to_say_instead);
  }
  
  return {
    ...best,
    overall_score: avgOverall,
    quality_label: avgOverall >= 81 ? 'elite' : avgOverall >= 61 ? 'strong' : avgOverall >= 41 ? 'average' : 'poor',
    benchmark_comparison: {
      matched: [...new Set(allMatched)].slice(0, 5),
      missed: [...new Set(allMissed)].slice(0, 5),
      what_to_say_instead: [...new Set(allWhatToSay)].slice(0, 5),
    }
  };
}

// ── Main cycle ───────────────────────────────────────────────────────────────

export async function runWorkerCycle(options?: CycleOptions): Promise<CycleStats> {
  const cfg = loadConfig();
  const spawnFn = options?.spawnFn;
  const maxPerCycle = options?.maxPerCycle ?? cfg.maxPerCycle;
  
  const stats: CycleStats = { processed: 0, failed: 0, skipped: 0 };

  let requests: ScoringRequest[];
  try {
    requests = await pollPending(cfg);
  } catch (e: any) {
    console.error(`[WORKER] Poll failed: ${e.message}`);
    return stats;
  }

  if (requests.length === 0) {
    console.log('[WORKER] No pending requests');
    return stats;
  }

  console.log(`[WORKER] Found ${requests.length} pending request(s)`);
  requests = requests.slice(0, maxPerCycle);

  for (const request of requests) {
    const claimed = await claimRequest(cfg, request.id);
    if (!claimed) {
      console.log(`[WORKER] Request ${request.id} already claimed`);
      stats.skipped++;
      continue;
    }
    
    console.log(`[WORKER] Processing ${request.id} for call ${request.call_id}`);

    try {
      const scoreId = await processOne(cfg, request, spawnFn);
      await markCompleted(cfg, request.id, scoreId);
      stats.processed++;
      console.log(`[WORKER] ✅ Score ${scoreId} created`);
    } catch (e: any) {
      stats.failed++;
      const msg = e?.message || String(e);
      console.error(`[WORKER] ❌ ${request.id}: ${msg}`);
      await markFailed(cfg, request.id, msg);
    }
  }

  return stats;
}

// ── Retry failed requests ────────────────────────────────────────────────────

export async function retryFailedRequests(config?: WorkerConfig): Promise<{retried: number; succeeded: number; failed: number}> {
  const cfg = config || loadConfig();
  
  const params = new URLSearchParams({
    'status': 'eq.failed',
    'order': 'created_at.asc',
    'select': 'id,call_id,transcript,rep_name,call_title,call_date,duration_seconds,status,created_at,error_message',
  });

  const failedRequests = await supabaseQuery(cfg, 'scoring_requests', params.toString());
  
  const retryable = failedRequests.filter((r: any) => 
    !r.error_message?.includes('Superseded') &&
    !r.error_message?.includes('transcript too short')
  );
  
  console.log(`[RETRY] Found ${retryable.length} retryable failed requests`);
  
  for (const request of retryable) {
    await supabaseUpdate(cfg, 'scoring_requests', `id=eq.${request.id}`, {
      status: 'pending',
      error_message: null,
      updated_at: new Date().toISOString(),
    });
    console.log(`[RETRY] Reset ${request.id} to pending`);
  }
  
  return { retried: retryable.length, succeeded: 0, failed: 0 };
}

// ── Deprecated ───────────────────────────────────────────────────────────────

export async function runScoringCycle(config?: WorkerConfig): Promise<CycleStats> {
  console.warn('[WORKER] runScoringCycle deprecated, use runWorkerCycle');
  return runWorkerCycle();
}
