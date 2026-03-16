"use strict";
// cherry-worker/scoring-processor.ts
// Main worker logic: poll → claim → score → write → complete/fail
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabase = getSupabase;
exports.pollSupabase = pollSupabase;
exports.claimRequest = claimRequest;
exports.spawnReasoner = spawnReasoner;
exports.parseReasonerOutput = parseReasonerOutput;
exports.validateTranscript = validateTranscript;
exports.writeScore = writeScore;
exports.markCompleted = markCompleted;
exports.markFailed = markFailed;
const supabase_js_1 = require("@supabase/supabase-js");
const reasoner_prompt_1 = require("./reasoner-prompt");
const MODEL_VERSION = 'cherry-reasoner-v1';
const MIN_TRANSCRIPT_LENGTH = 500;
const POLL_LIMIT = 5; // max requests per poll cycle
const PROCESSING_TIMEOUT_MINUTES = 15; // reclaim stuck requests after this
// ---------------------------------------------------------------------------
// Supabase client singleton
// ---------------------------------------------------------------------------
let _supabase = null;
function getSupabase(config) {
    if (!_supabase) {
        _supabase = (0, supabase_js_1.createClient)(config.supabaseUrl, config.supabaseServiceKey, {
            auth: { persistSession: false },
        });
    }
    return _supabase;
}
// ---------------------------------------------------------------------------
// Poll: fetch pending scoring requests (excluding deleted calls)
// ---------------------------------------------------------------------------
async function pollSupabase(config) {
    const sb = getSupabase(config);
    console.log(`[POLL] Starting poll for pending scoring requests`);
    // Also reclaim requests stuck in "processing" for too long
    const cutoff = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60000).toISOString();
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
        console.log(`[POLL] Request IDs: ${requests.map((r) => r.id).join(', ')}`);
        console.log(`[POLL] Request statuses: ${requests.map((r) => `${r.id}=${r.status}`).join(', ')}`);
    }
    // Filter out requests for deleted calls
    const scoringRequests = (requests ?? []);
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
    const deletedCallIds = new Set((deletedCalls || []).map((c) => c.id));
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
async function claimRequest(config, requestId) {
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
async function spawnReasoner(transcript, agentName, agentId = 'reasoner') {
    const prompt = (0, reasoner_prompt_1.buildScoringPrompt)(transcript, agentName);
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
function parseReasonerOutput(raw) {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    }
    catch {
        throw new Error(`Reasoner output is not valid JSON: ${cleaned.slice(0, 200)}...`);
    }
    // Validate overall_score
    if (typeof parsed.overall_score !== 'number' || parsed.overall_score < 0 || parsed.overall_score > 100) {
        throw new Error(`Invalid overall_score: ${parsed.overall_score}`);
    }
    // Validate quality_label
    if (!reasoner_prompt_1.SCORING_RUBRIC.qualityLabels.includes(parsed.quality_label)) {
        throw new Error(`Invalid quality_label: ${parsed.quality_label}`);
    }
    // Validate outcome
    if (!reasoner_prompt_1.SCORING_RUBRIC.outcomes.includes(parsed.outcome)) {
        throw new Error(`Invalid outcome: ${parsed.outcome}`);
    }
    // Validate close_type (null is valid)
    // Handle both actual null and string "null" from AI output
    if (parsed.close_type === 'null') {
        parsed.close_type = null;
    }
    if (parsed.close_type !== null && !reasoner_prompt_1.SCORING_RUBRIC.closeTypes.includes(parsed.close_type)) {
        throw new Error(`Invalid close_type: ${parsed.close_type}`);
    }
    // Validate all 10 categories present
    for (const cat of reasoner_prompt_1.SCORING_RUBRIC.categories) {
        const entry = parsed.categories?.[cat];
        if (!entry)
            throw new Error(`Missing category: ${cat}`);
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
    // Validate coach_summary (default to empty if missing for backward compat)
    if (!parsed.coach_summary || typeof parsed.coach_summary !== 'object') {
        parsed.coach_summary = { did_well: [], needs_work: [], action_items: [] };
    }
    else {
        if (!Array.isArray(parsed.coach_summary.did_well))
            parsed.coach_summary.did_well = [];
        if (!Array.isArray(parsed.coach_summary.needs_work))
            parsed.coach_summary.needs_work = [];
        if (!Array.isArray(parsed.coach_summary.action_items))
            parsed.coach_summary.action_items = [];
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
    }
    else {
        // Validate each marker has required fields
        for (const marker of parsed.coaching_markers) {
            if (typeof marker.timestamp !== 'string')
                marker.timestamp = '00:00';
            if (typeof marker.seconds !== 'number')
                marker.seconds = 0;
            if (typeof marker.title !== 'string')
                marker.title = 'Untitled';
            if (typeof marker.category !== 'string')
                marker.category = 'unknown';
            if (!['positive', 'negative'].includes(marker.type))
                marker.type = 'negative';
            if (!['high', 'medium', 'low'].includes(marker.severity))
                marker.severity = 'medium';
            if (typeof marker.note !== 'string')
                marker.note = '';
        }
    }
    return parsed;
}
// ---------------------------------------------------------------------------
// Validate transcript before processing
// ---------------------------------------------------------------------------
function validateTranscript(transcript) {
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
async function writeScore(config, callId, requestId, result, repName, callTitle) {
    const sb = getSupabase(config);
    // Derive enhanced fields from scoring result
    const grade = result.overall_score >= 90 ? 'A+' : result.overall_score >= 80 ? 'A' : result.overall_score >= 70 ? 'B' : result.overall_score >= 60 ? 'C' : result.overall_score >= 50 ? 'D' : 'F';
    const cat = (name) => result.categories?.[name]?.score || 0;
    const scoreBreakdown = {
        close_quality: Math.round((cat('overall_close_quality') / 10) * 25),
        objection_handling: Math.round((cat('objection_handling') / 10) * 20),
        value_stacking: Math.round((cat('offer_explanation') / 10) * 20),
        urgency_usage: Math.round((cat('urgency_close_attempt') / 10) * 15),
        discovery_rapport: Math.round(((cat('discovery_quality') + cat('rapport_tone')) / 20) * 10),
        professionalism: Math.round(((cat('confidence_authority') + cat('call_control')) / 20) * 10),
    };
    const closeOutcome = result.outcome === 'closed' ? 'closed' : (result.outcome === 'follow_up' || result.close_type === 'deposit') ? 'follow_up' : 'no_sale';
    const valueStackingScore = cat('offer_explanation');
    const urgencyScore = cat('urgency_close_attempt');
    const objectionHandlingScore = cat('objection_handling');
    // Extract key quotes from high-scoring categories
    const keyQuotes = [];
    for (const [key, catData] of Object.entries(result.categories || {})) {
        if (catData.score >= 7 && catData.evidence) {
            keyQuotes.push({ quote: catData.evidence, context: key.replace(/_/g, ' '), type: 'positive' });
        }
    }
    const techniques = {
        value_stacking: { score: valueStackingScore, components_used: [], evidence: [] },
        urgency_creation: { score: urgencyScore, types_used: [], evidence: [] },
    };
    const row = {
        call_id: callId,
        scoring_request_id: requestId,
        org_id: '00000000-0000-0000-0000-000000000001',
        model_version: MODEL_VERSION,
        rep_name: repName || 'Unknown',
        call_title: callTitle || null,
        // Core scores
        overall_score: result.overall_score,
        score_total: result.overall_score,
        quality_label: result.quality_label,
        outcome: result.outcome,
        close_type: result.close_type,
        low_signal: result.low_signal,
        // Enhanced: grade
        grade,
        score_grade: grade,
        // Enhanced: score breakdown
        score_breakdown: scoreBreakdown,
        // Enhanced: close analysis
        close_outcome: closeOutcome,
        close_confidence: 70,
        // Enhanced: techniques
        techniques_detected: techniques,
        value_stacking_score: valueStackingScore,
        urgency_score: urgencyScore,
        objection_handling_score: objectionHandlingScore,
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
        coaching_markers: result.coaching_markers || [],
        // Enhanced: detailed data
        key_quotes: keyQuotes.slice(0, 5),
        missed_opportunities: [...(result.objections_missed || []), ...(result.weaknesses || [])],
        // Coach Summary
        coach_summary: result.coach_summary || { did_well: [], needs_work: [], action_items: [] },
        status: 'completed',
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
    console.log(`[WRITE_SCORE] SUCCESS: id=${data.id}`);
    return data.id;
}
// ---------------------------------------------------------------------------
// Mark completed / failed
// ---------------------------------------------------------------------------
async function markCompleted(config, requestId, scoreId) {
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
async function markFailed(config, requestId, errorMessage) {
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
    }
    else {
        console.log(`[MARK_FAILED] SUCCESS`);
    }
}
