/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const */
/**
 * Credit Club Scoring Worker — THE ONE WORKER (v3.4)
 * 
 * Self-contained scoring pipeline with:
 * - FIXED benchmark pattern extraction (not full transcripts)
 * - Reasoner agent integration via spawnFn
 * - Dynamic KB loading (only relevant files)
 * - Benchmark-based scoring comparison with actual quotes
 * 
 * @version 3.4.0 — Pattern-extracted benchmarks, reasoner agent support
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { buildRubricV2Prompt, buildRubricV2Result, mapRubricV2ToLegacy } from './rubric-v2';

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
  outcome: 'closed' | 'no_sale' | 'disqualified';
  close_type: 'full_close' | 'payment_plan' | 'deposit' | 'partial_access' | null;
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
const VALID_OUTCOMES = ['closed', 'no_sale', 'disqualified'] as const;
const VALID_CLOSE_TYPES = ['full_close', 'payment_plan', 'deposit', 'partial_access'] as const;

const MODEL_VERSION = 'worker-v4.0-rubric-v2';
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
const KB_ROOT = join(process.env.HOME || '/Users/papur', 'credit-club-kb');
const BENCHMARK_ROOT = join(KB_ROOT, 'benchmarks');

const CHARS_PER_TOKEN = 4;
const MAX_CHUNK_CHARS = 6000; // ~1500 tokens for transcript content

// FIXED 12-benchmark library
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
    model: process.env.SCORING_OPENAI_MODEL || 'gpt-4.1-mini',
    maxPerCycle: Number.parseInt(process.env.SCORING_MAX_PER_CYCLE || '1', 10) || 1,
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

async function supabaseQuery(config: WorkerConfig, table: string, params: string): Promise<any[]> {
  const url = `${config.supabaseUrl}/rest/v1/${table}?${params}`;
  const res = await fetch(url, { method: 'GET', headers: supabaseHeaders(config) });
  if (!res.ok) throw new Error(`Supabase GET ${table} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function supabaseInsert(config: WorkerConfig, table: string, row: Record<string, any>): Promise<any> {
  const url = `${config.supabaseUrl}/rest/v1/${table}`;
  const res = await fetch(url, { method: 'POST', headers: supabaseHeaders(config), body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`Supabase INSERT ${table} failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function supabaseUpdate(config: WorkerConfig, table: string, filters: string, updates: Record<string, any>): Promise<any[]> {
  const url = `${config.supabaseUrl}/rest/v1/${table}?${filters}`;
  const res = await fetch(url, { method: 'PATCH', headers: supabaseHeaders(config), body: JSON.stringify(updates) });
  if (!res.ok) throw new Error(`Supabase PATCH ${table} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// ── Step 1: Poll for pending requests ────────────────────────────────────────

async function pollPending(config: WorkerConfig): Promise<ScoringRequest[]> {
  const cutoff = new Date(Date.now() - config.processingTimeoutMinutes * 60_000).toISOString();
  // Fetch a wider candidate window before filtering out soft-deleted calls.
  // Otherwise one old pending request for a deleted call can permanently block the worker
  // when maxPerCycle is 1.
  const candidateLimit = Math.max(config.maxPerCycle * 10, config.maxPerCycle + 10);
  const params = new URLSearchParams({
    'or': `(status.eq.pending,and(status.eq.processing,updated_at.lt.${cutoff}))`,
    // Prioritise new calls so today's sales calls get coached quickly even if
    // there is a historical backlog from a previous outage.
    'order': 'created_at.desc',
    'limit': String(candidateLimit),
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
  return requests
    .filter((r: any) => !deletedIds.has(r.call_id))
    .slice(0, config.maxPerCycle);
}

// ── Step 2: Atomic claim ─────────────────────────────────────────────────────

async function claimRequest(config: WorkerConfig, requestId: string): Promise<boolean> {
  try {
    const rows = await supabaseUpdate(
      config,
      'scoring_requests',
      `id=eq.${requestId}&status=in.(pending,processing)`,
      { status: 'processing', started_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ── Transcript Chunking ──────────────────────────────────────────────────────

function chunkTranscript(transcript: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  if (transcript.length <= maxChars) return [transcript];

  const chunks: string[] = [];
  const lines = transcript.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxChars) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());

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

// ── PATTERN EXTRACTION: Extract only winning moments from benchmarks ────────

/**
 * Extract key winning patterns from a full benchmark transcript.
 * Instead of loading 600 lines, we extract ~80-120 lines of the most important moments:
 * - Opening rapport
 * - Key discovery questions
 * - Pain amplification
 * - Objection handling (with exact quotes)
 * - Close attempt and deposit collection
 * - Value stacking before price
 */
function extractBenchmarkPatterns(content: string, benchmarkName: string): string {
  // If it's a placeholder, return early
  if (content.includes('[PLACEHOLDER') || content.includes('[To be extracted')) {
    return `## ${benchmarkName}\n[Benchmark content pending]`;
  }

  const lines = content.split('\n');
  const extracted: string[] = [];
  let inTranscript = false;
  let section = '';

  // Key pattern markers we want to extract
  const keyMarkers = [
    // Discovery / Pain
    /what.*do for work/i, /how.*credit/i, /struggle/i, /problem/i, /issue/i,
    /worried/i, /stress/i, /frustrated/i, /annoying/i, /difficult/i,
    /why.*important/i, /what.*cost/i, /how much.*losing/i,
    
    // Value stacking
    /value/i, /worth/i, /package/i, /everything.*get/i, /included/i,
    /three thousand/i, /£3,000/i, /3000/i, /price/i, /cost.*programme/i,
    
    // Objection handling
    /need to think/i, /talk to.*wife/i, /talk to.*husband/i, /partner/i,
    /too expensive/i, /can't afford/i, /money/i, /price.*issue/i,
    /not right time/i, /not sure/i, /skeptical/i, /scam/i,
    /need to check/i, /discuss with/i, /ask.*accountant/i,
    
    // Urgency / Close
    /deposit/i, /£300/i, /£500/i, /secure.*place/i, /payment plan/i,
    /instalment/i, /today/i, /now/i, /this week/i, /limited/i,
    /only.*spot/i, /join/i, /get started/i, /move forward/i,
    
    // Authority / Confidence
    /guarantee/i, /refund/i, /done this before/i, /helped/i, /clients/i,
    /results/i, /success/i, /worked for/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Header info
    if (line.startsWith('# Benchmark Call:') || line.startsWith('**Close Type:**')) {
      extracted.push(line);
      continue;
    }

    // Detect transcript section
    if (line.includes('Full Transcript') || line.startsWith('```')) {
      inTranscript = true;
      extracted.push('\n## KEY MOMENTS FROM CALL:\n');
      continue;
    }

    if (!inTranscript) continue;

    // Skip timestamp-only lines and short responses
    if (/^\@\d+:\d+\s*-\s*\w+$/.test(line)) continue;
    if (line.trim().length < 10) continue;

    // Check if this line or nearby lines contain key patterns
    const contextWindow = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join(' ');
    const isKeyMoment = keyMarkers.some(marker => marker.test(contextWindow));

    if (isKeyMoment) {
      // Include context (2 lines before and 2 after)
      const startIdx = Math.max(0, i - 2);
      const endIdx = Math.min(lines.length, i + 3);
      for (let j = startIdx; j < endIdx; j++) {
        if (!extracted.includes(lines[j])) {
          extracted.push(lines[j]);
        }
      }
      extracted.push(''); // spacing
    }
  }

  // If we didn't extract enough, take the first 50 lines of transcript as fallback
  if (extracted.length < 20) {
    extracted.push('\n[Fallback: First portion of call]\n');
    let count = 0;
    for (const line of lines) {
      if (line.includes('@') && line.includes('-')) {
        extracted.push(line);
        count++;
        if (count > 50) break;
      }
    }
  }

  const result = extracted.join('\n');
  // Limit to ~4000 chars to keep per-benchmark size reasonable
  if (result.length > 4000) {
    return result.slice(0, 4000) + '\n\n[... additional patterns truncated ...]\n';
  }
  return result;
}

// ── Benchmark Library Loading ─────────────────────────────────────────────────

function loadBenchmarkCall(closeType: string, filename: string): string {
  try {
    const filepath = join(BENCHMARK_ROOT, closeType, filename);
    const full = readFileSync(filepath, 'utf-8');
    return extractBenchmarkPatterns(full, filename.replace('.md', ''));
  } catch (e) {
    console.warn(`[BENCHMARK] Could not load ${closeType}/${filename}`);
    return '';
  }
}

function loadBenchmarksForCloseType(closeType: keyof typeof BENCHMARK_LIBRARY): string {
  const benchmarks = BENCHMARK_LIBRARY[closeType];
  const parts: string[] = [];
  
  for (const bm of benchmarks) {
    const content = loadBenchmarkCall(closeType, bm.file);
    if (content && !content.includes('[PLACEHOLDER') && !content.includes('[Benchmark content pending')) {
      parts.push(`## ${bm.name}\n${content}`);
    } else {
      parts.push(`## ${bm.name}\n[Benchmark content pending - not yet extracted]`);
    }
  }
  
  return parts.join('\n\n---\n\n');
}

function detectLikelyCloseType(transcript: string): keyof typeof BENCHMARK_LIBRARY {
  const lower = transcript.toLowerCase();
  
  if (/\bpayment.?plan\b|instalment|split.?payment/i.test(lower)) return 'payment_plan';
  if (/\bpartial.?access\b|£500\s*(upfront|now)|after.?approval/i.test(lower)) return 'partial_access';
  if (/\bdeposit\b|£300|£500|secure.*place/i.test(lower)) return 'deposit';
  if (/\bpaid.?in.?full\b|£3,?000.*(today|now|paid)/i.test(lower)) return 'full_close';
  
  if (/\bcan.t.afford\b|too expensive|need.to.check|partner|wife|husband/i.test(lower)) return 'deposit';
  if (/\bneed.to.think\b|let.me.think/i.test(lower)) return 'partial_access';
  
  return 'deposit';
}

// ── Knowledge Base Loading ───────────────────────────────────────────────────

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

// ── Build Scoring Prompt ─────────────────────────────────────────────────────

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
  
  // Load only 3 relevant benchmarks (pattern-extracted, ~4KB each)
  const likelyCloseType = benchmarkCloseType || detectLikelyCloseType(transcript);
  const relevantBenchmarks = loadBenchmarksForCloseType(likelyCloseType);
  
  const kb = getDynamicKB(transcript);

  const kbSections: string[] = [];
  if (kb.closes) kbSections.push(`================================================================================
KNOWLEDGE BASE: CLOSE PATTERNS
================================================================================
${kb.closes}`);
  if (kb.objections) kbSections.push(`================================================================================
KNOWLEDGE BASE: OBJECTION HANDLING
================================================================================
${kb.objections}`);
  if (kb.techniques) kbSections.push(`================================================================================
KNOWLEDGE BASE: SALES TECHNIQUES
================================================================================
${kb.techniques}`);
  if (kb.pricing) kbSections.push(`================================================================================
KNOWLEDGE BASE: PRICING PSYCHOLOGY
================================================================================
${kb.pricing}`);

  const kbContent = kbSections.join('\n\n');

  return buildRubricV2Prompt({
    transcript,
    repName,
    benchmarkContext: `================================================================================
WINNING BENCHMARK CALLS — PATTERN EXTRACTS (Key Moments Only)
================================================================================

These are extracts from Credit Club's proven winning call library.
Each extract shows ONLY the most important moments: key discovery questions, pain amplification, objection handling, and close attempts.

### PRIMARY BENCHMARKS (${likelyCloseType.toUpperCase().replace('_', ' ')})

${relevantBenchmarks}`,
    knowledgeContext: kbContent,
  });
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
  const model = config.model || process.env.SCORING_OPENAI_MODEL || 'gpt-4.1-mini';
  
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are a sales call scoring expert. Return ONLY valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 8192,
          response_format: { type: 'json_object' },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429 || res.status >= 500) {
          const waitTime = attempt * 20000;
          console.log(`[RATE LIMIT] Waiting ${waitTime}ms`);
          await delay(waitTime);
          continue;
        }
        throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
      }

      const json = await res.json();
      return json.choices?.[0]?.message?.content || '';
    } catch (e: any) {
      if (attempt === 5) throw e;
      const waitTime = 5000 * attempt;
      console.log(`[AGENT] Attempt ${attempt} failed (${e?.message || e}); retrying in ${waitTime}ms`);
      await delay(waitTime);
    }
  }
  throw new Error('Failed after 5 attempts');
}

async function repairScoringJson(config: WorkerConfig, raw: string, validationError: string): Promise<string> {
  const repairPrompt = `The previous sales-call scoring response failed validation: ${validationError}

Repair it into valid JSON only. Preserve the meaning where possible, but ensure all required fields exist.

Required top-level fields:
overall_score number 0-100, quality_label poor|average|strong|elite, outcome closed|no_sale|disqualified, close_type null|full_close|payment_plan|deposit|partial_access, coach_summary {did_well,needs_work,action_items}, categories object, strengths array, weaknesses array, objections_detected array, objections_handled_well array, objections_missed array, next_coaching_actions array, coaching_markers array, benchmark_comparison {matched,missed,what_to_say_instead}.

Required categories, each with score number 0-10, reasoning string, evidence string:
${REQUIRED_CATEGORIES.join(', ')}

If evidence is missing, write "No specific evidence returned by model; requires manager review".
If outcome was "follow_up" or "No Close", convert to "no_sale".

Broken JSON/content:
${raw.slice(0, 24000)}`;

  console.log('[AGENT] Repairing invalid scoring JSON...');
  return callOpenAIDirect(config, repairPrompt);
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

  if (Array.isArray(parsed.category_scores) && parsed.deal_outcome) {
    const rubricV2 = buildRubricV2Result(parsed, { analysisCoveragePercentage: 100 });
    const legacy = mapRubricV2ToLegacy(rubricV2);
    return {
      ...legacy,
      rubric_v2: rubricV2,
      rubric_version: rubricV2.rubric_version,
      benchmark_comparison: parsed.benchmark_comparison || { matched: [], missed: [], what_to_say_instead: [] },
    } as ScoringResult;
  }

  if (typeof parsed.overall_score !== 'number' || parsed.overall_score < 0 || parsed.overall_score > 100) {
    throw new Error(`Invalid overall_score: ${parsed.overall_score}`);
  }

  if (typeof parsed.quality_label === 'string') parsed.quality_label = parsed.quality_label.toLowerCase();
  if (!VALID_QUALITY_LABELS.includes(parsed.quality_label)) {
    throw new Error(`Invalid quality_label: ${parsed.quality_label}`);
  }

  if (typeof parsed.outcome === 'string') parsed.outcome = parsed.outcome.toLowerCase().replace(/\s+/g, '_');
  if (!VALID_OUTCOMES.includes(parsed.outcome)) {
    if (parsed.outcome === 'follow_up' || parsed.outcome === 'no_close') {
      parsed.outcome = 'no_sale';
    } else {
      throw new Error(`Invalid outcome: ${parsed.outcome}`);
    }
  }

  if (parsed.close_type !== null && parsed.close_type !== undefined) {
    if (!VALID_CLOSE_TYPES.includes(parsed.close_type as any)) {
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
  
  const closeOutcome = result.outcome === 'closed' ? 'closed' : 'no_sale';
  
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
    rubric_version: (result as any).rubric_version || null,
    rubric_v2: (result as any).rubric_v2 || null,
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
    enhanced_weaknesses: (result as any).enhanced_weaknesses || null,
    objection_scripts: (result as any).objection_scripts || null,
    
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
      completed_at: new Date().toISOString(),
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

  // Detect likely close type for benchmark selection
  const likelyCloseType = detectLikelyCloseType(request.transcript);
  console.log(`[WORKER] Detected close type: ${likelyCloseType}`);
  
  const chunks = chunkTranscript(request.transcript, MAX_CHUNK_CHARS);
  console.log(`[WORKER] Transcript chunked into ${chunks.length} part(s)`);

  if (chunks.length === 1) {
    let prompt = buildPrompt(chunks[0], request.rep_name, false, likelyCloseType);
    let estimatedTokens = Math.round(prompt.length / CHARS_PER_TOKEN);
    
    // Safety guard: if prompt still exceeds 100k tokens, force minimal
    if (estimatedTokens > 100000) {
      console.log(`[WORKER] Prompt still too large (${estimatedTokens} tokens), forcing minimal prompt`);
      prompt = buildMinimalPrompt(chunks[0], request.rep_name);
      estimatedTokens = Math.round(prompt.length / CHARS_PER_TOKEN);
    }
    
    console.log(`[WORKER] Prompt size: ~${estimatedTokens} tokens`);
    
    let raw: string;
    if (spawnFn) {
      raw = await callCherryAgent(spawnFn, prompt);
    } else {
      raw = await callOpenAIDirect(config, prompt);
    }

    let result: ScoringResult;
    try {
      result = validateAndParse(raw);
    } catch (e: any) {
      raw = await repairScoringJson(config, raw, e?.message || String(e));
      result = validateAndParse(raw);
    }
    const scoreId = await writeScore(config, request.call_id, request.id, result, request.rep_name, request.call_title);

    return scoreId;
  }

  console.log(`[WORKER] Multi-chunk processing: ${chunks.length} chunks`);
  
  const chunkResults: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      console.log(`[WORKER] Rate limit delay: 15000ms before chunk ${i + 1}`);
      await delay(15000);
    }
    
    let chunkPrompt = buildPrompt(chunks[i], request.rep_name, false, likelyCloseType);
    let estimatedTokens = Math.round(chunkPrompt.length / CHARS_PER_TOKEN);
    
    // Safety guard for multi-chunk too
    if (estimatedTokens > 100000) {
      console.log(`[WORKER] Chunk prompt too large (${estimatedTokens} tokens), forcing minimal`);
      chunkPrompt = buildMinimalPrompt(chunks[i], request.rep_name);
      estimatedTokens = Math.round(chunkPrompt.length / CHARS_PER_TOKEN);
    }
    
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
  if (chunks.some(c => Array.isArray(c.category_scores) && c.deal_outcome)) {
    return combineRubricV2ChunkResults(chunks);
  }

  const scored = chunks.map(c => ({
    chunk: c,
    score: Object.keys(c.categories || {}).length + 
           (c.strengths?.length || 0) + 
           (c.weaknesses?.length || 0)
  }));
  
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].chunk;
  
  const avgOverall = Math.round(chunks.reduce((sum, c) => sum + (c.overall_score || 0), 0) / chunks.length);
  
  const allMatched: string[] = [];
  const allMissed: string[] = [];
  const allWhatToSay: string[] = [];
  
  for (const c of chunks) {
    if (c.benchmark_comparison?.matched) allMatched.push(...c.benchmark_comparison.matched);
    if (c.benchmark_comparison?.missed) allMissed.push(...c.benchmark_comparison.missed);
    if (c.benchmark_comparison?.what_to_say_instead) allWhatToSay.push(...c.benchmark_comparison.what_to_say_instead);
  }
  
  const uniqueMatched = Array.from(new Set(allMatched)).slice(0, 5);
  const uniqueMissed = Array.from(new Set(allMissed)).slice(0, 5);
  const uniqueWhatToSay = Array.from(new Set(allWhatToSay)).slice(0, 5);
  
  return {
    ...best,
    overall_score: avgOverall,
    quality_label: avgOverall >= 81 ? 'elite' : avgOverall >= 61 ? 'strong' : avgOverall >= 41 ? 'average' : 'poor',
    benchmark_comparison: {
      matched: uniqueMatched,
      missed: uniqueMissed,
      what_to_say_instead: uniqueWhatToSay,
    }
  };
}

function combineRubricV2ChunkResults(chunks: any[]): any {
  const v2Chunks = chunks.filter(c => Array.isArray(c.category_scores) && c.deal_outcome);
  const best = v2Chunks[0] || chunks[0];
  const categoryKeys = Array.from(new Set(v2Chunks.flatMap(c => c.category_scores.map((cat: any) => cat.category_key))));

  const category_scores = categoryKeys.map((key) => {
    const entries = v2Chunks
      .flatMap(c => c.category_scores)
      .filter((cat: any) => cat.category_key === key);
    const bestEvidenceEntry = entries
      .slice()
      .sort((a: any, b: any) => ((b.evidence?.length || 0) - (a.evidence?.length || 0)))[0] || entries[0];
    const avgScore = Math.round(entries.reduce((sum: number, cat: any) => sum + (Number(cat.score) || 1), 0) / Math.max(entries.length, 1));

    return {
      ...bestEvidenceEntry,
      score: avgScore,
      evidence: entries.flatMap((cat: any) => Array.isArray(cat.evidence) ? cat.evidence : []).slice(0, 4),
      what_happened: entries.map((cat: any) => cat.what_happened).filter(Boolean).slice(0, 3).join(' | '),
      why_this_score: entries.map((cat: any) => cat.why_this_score).filter(Boolean).slice(0, 3).join(' | '),
      coaching_feedback: entries.map((cat: any) => cat.coaching_feedback).filter(Boolean).slice(0, 3).join(' | '),
    };
  });

  const outcomePriority = ['payment_collected', 'deposit_collected', 'payment_plan_arranged', 'follow_up_booked', 'no_sale', 'unclear'];
  const dealOutcome = v2Chunks
    .map(c => c.deal_outcome)
    .sort((a, b) => outcomePriority.indexOf(a.final_outcome) - outcomePriority.indexOf(b.final_outcome))[0] || best.deal_outcome;

  return {
    ...best,
    deal_outcome: {
      ...dealOutcome,
      offer_pitched: v2Chunks.some(c => c.deal_outcome?.offer_pitched),
      price_discussed: v2Chunks.some(c => c.deal_outcome?.price_discussed),
      close_attempted: v2Chunks.some(c => c.deal_outcome?.close_attempted),
      payment_collected: v2Chunks.some(c => c.deal_outcome?.payment_collected),
      deposit_collected: v2Chunks.some(c => c.deal_outcome?.deposit_collected),
      payment_plan_arranged: v2Chunks.some(c => c.deal_outcome?.payment_plan_arranged),
      follow_up_booked: v2Chunks.some(c => c.deal_outcome?.follow_up_booked),
      onboarding_or_next_step_completed: v2Chunks.some(c => c.deal_outcome?.onboarding_or_next_step_completed),
      evidence: v2Chunks.flatMap(c => Array.isArray(c.deal_outcome?.evidence) ? c.deal_outcome.evidence : []).slice(0, 5),
    },
    category_scores,
    best_moments: v2Chunks.flatMap(c => Array.isArray(c.best_moments) ? c.best_moments : []).slice(0, 5),
    missed_opportunities: v2Chunks.flatMap(c => Array.isArray(c.missed_opportunities) ? c.missed_opportunities : []).slice(0, 5),
    top_3_coaching_actions: v2Chunks.flatMap(c => Array.isArray(c.top_3_coaching_actions) ? c.top_3_coaching_actions : []).slice(0, 3),
    compliance_flags: v2Chunks.flatMap(c => Array.isArray(c.compliance_flags) ? c.compliance_flags : []).slice(0, 5),
    timestamped_key_moments: v2Chunks.flatMap(c => Array.isArray(c.timestamped_key_moments) ? c.timestamped_key_moments : []).slice(0, 10),
    manager_summary: v2Chunks.map(c => c.manager_summary).filter(Boolean).slice(0, 3).join('\n\n'),
    rep_facing_summary: v2Chunks.map(c => c.rep_facing_summary).filter(Boolean).slice(0, 3).join('\n\n'),
  };
}

// ── Main cycle ───────────────────────────────────────────────────────────────

export async function runWorkerCycle(options?: CycleOptions): Promise<CycleStats> {
  const cfg = loadConfig();
  const spawnFn = options?.spawnFn;
  const maxPerCycle = options?.maxPerCycle ?? cfg.maxPerCycle;
  cfg.maxPerCycle = maxPerCycle;
  
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
