// cherry-worker/scoring-processor.ts
// Main worker logic: poll → claim → score → write → complete/fail

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildScoringPrompt, SCORING_RUBRIC, ScoringResult, CloseType, Outcome, QualityLabel } from './reasoner-prompt';

const MODEL_VERSION = 'cherry-reasoner-v1';
const MIN_TRANSCRIPT_LENGTH = 500;
const POLL_LIMIT = 5; // max requests per poll cycle
const PROCESSING_TIMEOUT_MINUTES = 15; // reclaim stuck requests after this

export interface ScoringRequest {
  id: string;
  call_id: string;
  transcript: string;
  agent_name?: string;  // legacy column name
  rep_name?: string;    // current column name (used by API routes)
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessorConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  reasonerAgentId?: string; // defaults to "reasoner"
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Supabase client singleton
// ---------------------------------------------------------------------------

let _supabase: SupabaseClient | null = null;

export function getSupabase(config: ProcessorConfig): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
  return _supabase;
}

// ---------------------------------------------------------------------------
// Poll: fetch pending scoring requests (excluding deleted calls)
// ---------------------------------------------------------------------------

export async function pollSupabase(config: ProcessorConfig): Promise<ScoringRequest[]> {
  const sb = getSupabase(config);
  console.log(`[POLL] Starting poll for pending scoring requests`);

  // Also reclaim requests stuck in "processing" for too long
  const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60_000).toISOString();
  console.log(`[POLL] Reclaim cutoff: ${cutoff}`);

  // First, get pending/processing requests
  const { data: requests, error } = await sb
    .from('scoring_requests')
    .select('*')
    .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${cutoff})`)
    .order('created_at', { ascending: true })
    .limit(POLL_LIMIT);

  if (error) {
    console.error(`[POLL] ERROR: ${error.message}`);
    throw new Error(`pollSupabase failed: ${error.message}`);
  }
  
  console.log(`[POLL] Found ${requests?.length || 0} raw requests`);
  if (requests && requests.length > 0) {
    console.log(`[POLL] Request IDs: ${requests.map((r: any) => r.id).join(', ')}`);
    console.log(`[POLL] Request statuses: ${requests.map((r: any) => `${r.id}=${r.status}`).join(', ')}`);
  }
  
  // Filter out requests for deleted calls
  const scoringRequests = (requests ?? []) as ScoringRequest[];
  if (scoringRequests.length === 0) {
    console.log(`[POLL] No requests to process`);
    return [];
  }

  const callIds = scoringRequests.map(r => r.call_id);
  console.log(`[POLL] Checking call_ids for deletion: ${callIds.join(', ')}`);

  // Check which calls are deleted
  const { data: deletedCalls } = await sb
    .from('calls')
    .select('id')
    .in('id', callIds)
    .not('deleted_at', 'is', null);

  const deletedCallIds = new Set((deletedCalls || []).map((c: any) => c.id));
  console.log(`[POLL] Deleted call_ids: ${[...deletedCallIds].join(', ') || 'none'}`);

  // Filter out requests for deleted calls
  const filteredRequests = scoringRequests.filter(r => !deletedCallIds.has(r.call_id));

  if (filteredRequests.length < scoringRequests.length) {
    console.log(`[pollSupabase] Filtered out ${scoringRequests.length - filteredRequests.length} requests for deleted calls`);
  }

  console.log(`[POLL] Returning ${filteredRequests.length} requests to process`);
  return filteredRequests;
}

// ---------------------------------------------------------------------------
// Claim: atomically mark a request as processing
// ---------------------------------------------------------------------------

export async function claimRequest(config: ProcessorConfig, requestId: string): Promise<boolean> {
  const sb = getSupabase(config);
  console.log(`[CLAIM] Attempting to claim request: ${requestId}`);

  const { data, error } = await sb
    .from('scoring_requests')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', requestId)
    .in('status', ['pending', 'processing']) // allow reclaim of stuck
    .select('id')
    .single();

  if (error) {
    console.error(`[CLAIM] FAILED for ${requestId}: ${error.message}`);
    return false;
  }
  if (!data) {
    console.error(`[CLAIM] FAILED for ${requestId}: no data returned (row may be locked)`);
    return false;
  }
  
  console.log(`[CLAIM] SUCCESS for ${requestId}`);
  return true;
}

// ---------------------------------------------------------------------------
// Spawn reasoner: send transcript to reasoning agent, get back JSON score
// ---------------------------------------------------------------------------

export async function spawnReasoner(
  transcript: string,
  agentName?: string,
  agentId = 'reasoner',
): Promise<ScoringResult> {
  const prompt = buildScoringPrompt(transcript, agentName);

  // This function is designed to be called from an OpenClaw context where
  // sessions_spawn is available. In production, the index.ts orchestrator
  // calls the OpenClaw sessions_spawn tool. This is the pure-logic version
  // that can also be used in tests with a mock.
  //
  // The actual spawn call is in index.ts; this function parses + validates
  // the raw response from the reasoner.
  throw new Error('spawnReasoner must be called through the orchestrator — see index.ts');
}

// ---------------------------------------------------------------------------
// Validate + parse reasoner output
// ---------------------------------------------------------------------------

export function parseReasonerOutput(raw: string): ScoringResult {
  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Reasoner output is not valid JSON: ${cleaned.slice(0, 200)}...`);
  }

  // Validate overall_score
  if (typeof parsed.overall_score !== 'number' || parsed.overall_score < 0 || parsed.overall_score > 100) {
    throw new Error(`Invalid overall_score: ${parsed.overall_score}`);
  }

  // Validate quality_label
  if (!SCORING_RUBRIC.qualityLabels.includes(parsed.quality_label)) {
    throw new Error(`Invalid quality_label: ${parsed.quality_label}`);
  }

  // Validate outcome
  if (!SCORING_RUBRIC.outcomes.includes(parsed.outcome)) {
    throw new Error(`Invalid outcome: ${parsed.outcome}`);
  }

  // Validate close_type (null is valid)
  // Handle both actual null and string "null" from AI output
  if (parsed.close_type === 'null') {
    parsed.close_type = null;
  }
  if (parsed.close_type !== null && !SCORING_RUBRIC.closeTypes.includes(parsed.close_type)) {
    throw new Error(`Invalid close_type: ${parsed.close_type}`);
  }

  // Validate all 10 categories present
  for (const cat of SCORING_RUBRIC.categories) {
    const entry = parsed.categories?.[cat];
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

  // Validate low_signal (boolean, defaults to false if missing for backward compat)
  if (typeof parsed.low_signal !== 'boolean') {
    parsed.low_signal = false;
  }

  // Validate arrays exist
  for (const field of ['strengths', 'weaknesses', 'objections_detected', 'objections_handled_well', 'objections_missed', 'next_coaching_actions']) {
    if (!Array.isArray(parsed[field])) {
      throw new Error(`Missing or invalid array field: ${field}`);
    }
  }

  // Validate coaching_markers (optional — default to empty array if missing for backward compat)
  if (!Array.isArray(parsed.coaching_markers)) {
    parsed.coaching_markers = [];
  } else {
    // Validate each marker has required fields
    for (const marker of parsed.coaching_markers) {
      if (typeof marker.timestamp !== 'string') marker.timestamp = '00:00';
      if (typeof marker.seconds !== 'number') marker.seconds = 0;
      if (typeof marker.title !== 'string') marker.title = 'Untitled';
      if (typeof marker.category !== 'string') marker.category = 'unknown';
      if (!['positive', 'negative'].includes(marker.type)) marker.type = 'negative';
      if (!['high', 'medium', 'low'].includes(marker.severity)) marker.severity = 'medium';
      if (typeof marker.note !== 'string') marker.note = '';
    }
  }

  return parsed as ScoringResult;
}

// ---------------------------------------------------------------------------
// Validate transcript before processing
// ---------------------------------------------------------------------------

export function validateTranscript(transcript: string | null | undefined): string {
  if (!transcript || typeof transcript !== 'string') {
    throw new Error('Transcript is empty or missing');
  }
  const trimmed = transcript.trim();
  if (trimmed.length < MIN_TRANSCRIPT_LENGTH) {
    throw new Error(`Transcript too short (${trimmed.length} chars, minimum ${MIN_TRANSCRIPT_LENGTH})`);
  }
  return trimmed;
}

// ---------------------------------------------------------------------------
// Write score: insert into call_scores table
// ---------------------------------------------------------------------------

export async function writeScore(
  config: ProcessorConfig,
  callId: string,
  requestId: string,
  result: ScoringResult,
): Promise<string> {
  const sb = getSupabase(config);

  const row = {
    call_id: callId,
    scoring_request_id: requestId,
    model_version: MODEL_VERSION,
    overall_score: result.overall_score,
    quality_label: result.quality_label,
    outcome: result.outcome,
    close_type: result.close_type,
    low_signal: result.low_signal,
    categories: result.categories,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    objections_detected: result.objections_detected,
    objections_handled_well: result.objections_handled_well,
    objections_missed: result.objections_missed,
    next_coaching_actions: result.next_coaching_actions,
    coaching_markers: result.coaching_markers || [],
    created_at: new Date().toISOString(),
  };

  console.log(`[WRITE_SCORE] callId=${callId}, overall_score=${row.overall_score}, quality_label=${row.quality_label}`);

  const { data, error } = await sb
    .from('call_scores')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error(`[WRITE_SCORE] FAILED: ${error.message}`);
    throw new Error(`writeScore failed: ${error.message}`);
  }

  console.log(`[WRITE_SCORE] SUCCESS: id=${data!.id}`);
  return data!.id;
}

// ---------------------------------------------------------------------------
// Mark completed / failed
// ---------------------------------------------------------------------------

export async function markCompleted(config: ProcessorConfig, requestId: string, scoreId: string): Promise<void> {
  const sb = getSupabase(config);

  console.log(`[MARK_COMPLETED] requestId=${requestId}, scoreId=${scoreId}`);

  const { error } = await sb
    .from('scoring_requests')
    .update({
      status: 'completed',
      score_id: scoreId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) {
    console.error(`[MARK_COMPLETED] FAILED: ${error.message}`);
    throw new Error(`markCompleted failed: ${error.message}`);
  }

  console.log(`[MARK_COMPLETED] SUCCESS`);
}

export async function markFailed(config: ProcessorConfig, requestId: string, errorMessage: string): Promise<void> {
  const sb = getSupabase(config);

  console.log(`[MARK_FAILED] requestId=${requestId}, error=${errorMessage.slice(0, 100)}`);

  const { error } = await sb
    .from('scoring_requests')
    .update({
      status: 'failed',
      error_message: errorMessage.slice(0, 2000), // truncate long errors
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (error) {
    console.error(`[MARK_FAILED] FAILED to update: ${error.message}`);
  } else {
    console.log(`[MARK_FAILED] SUCCESS`);
  }
}
