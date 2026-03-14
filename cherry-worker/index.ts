// cherry-worker/index.ts
// Entry point: orchestrates the scoring pipeline

import {
  ProcessorConfig,
  ScoringRequest,
  pollSupabase,
  claimRequest,
  validateTranscript,
  parseReasonerOutput,
  writeScore,
  markCompleted,
  markFailed,
  getSupabase,
} from './scoring-processor';
import { buildScoringPrompt, ScoringResult } from './reasoner-prompt';

// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------

export function loadConfig(): ProcessorConfig {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  return {
    supabaseUrl,
    supabaseServiceKey,
    reasonerAgentId: process.env.REASONER_AGENT_ID ?? 'reasoner',
    dryRun: process.env.DRY_RUN === 'true',
  };
}

// ---------------------------------------------------------------------------
// Process a single scoring request
// ---------------------------------------------------------------------------

export async function processRequest(
  config: ProcessorConfig,
  request: ScoringRequest,
  spawnFn: (prompt: string, agentId: string) => Promise<string>,
): Promise<{ scoreId: string }> {
  console.log(`[PROCESS] Starting request ${request.id}, call ${request.call_id}, transcript length: ${request.transcript?.length}`);

  // 1. Validate transcript
  const transcript = validateTranscript(request.transcript);
  console.log(`[PROCESS] Transcript validated, length: ${transcript.length}`);

  // 2. Build prompt (rep_name is the current column, agent_name is legacy)
  const repName = request.rep_name || request.agent_name;
  const prompt = buildScoringPrompt(transcript, repName);

  // 3. Spawn reasoner and get raw output
  const agentId = config.reasonerAgentId ?? 'reasoner';
  const rawOutput = await spawnFn(prompt, agentId);
  console.log(`[PROCESS] Raw output received, length: ${rawOutput.length}`);

  // 4. Parse and validate the output
  let result: ScoringResult;
  try {
    result = parseReasonerOutput(rawOutput);
  } catch (parseErr: any) {
    console.error(`[PROCESS] Parse error: ${parseErr.message}`);
    throw parseErr;
  }
  console.log(`[PROCESS] Parsed successfully: overall_score=${result.overall_score}, quality_label=${result.quality_label}, outcome=${result.outcome}`);

  // 5. Write score to call_scores
  if (config.dryRun) {
    console.log('[DRY RUN] Would write score:', JSON.stringify(result, null, 2));
    return { scoreId: 'dry-run' };
  }

  const scoreId = await writeScore(config, request.call_id, request.id, result, repName);
  console.log(`[PROCESS] Score written: ${scoreId}`);

  // 6. Post-scoring hook: extract patterns for controlled learning
  try {
    const supabase = getSupabase(config);
    const orgId = '00000000-0000-0000-0000-000000000001';
    const { runPostScoringHook } = await import('./post-scoring-hook');
    
    const hookResult = await runPostScoringHook({
      supabase,
      orgId,
      scoreData: {
        id: scoreId,
        call_id: request.call_id,
        overall_score: result.overall_score,
        quality_label: result.quality_label,
        outcome: result.outcome,
        close_type: result.close_type,
        categories: result.categories,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        objections_detected: result.objections_detected,
        objections_handled_well: result.objections_handled_well,
        objections_missed: result.objections_missed,
      },
      repName: request.rep_name || request.agent_name || null,
      callDate: null,
      transcript: request.transcript,
      durationSeconds: null,
    });

    console.log(`[PROCESS] Post-scoring hook: patternsSaved=${hookResult.patternsSaved}`);
  } catch (hookErr: any) {
    console.warn(`[PROCESS] Post-scoring hook failed (non-fatal):`, hookErr.message);
  }

  console.log(`[PROCESS] Complete: scoreId=${scoreId}`);
  return { scoreId };
}

// ---------------------------------------------------------------------------
// Main run loop: poll → claim → process → complete/fail
// ---------------------------------------------------------------------------

export async function runScoringCycle(
  config: ProcessorConfig,
  spawnFn: (prompt: string, agentId: string) => Promise<string>,
): Promise<{ processed: number; failed: number; skipped: number }> {
  const stats = { processed: 0, failed: 0, skipped: 0 };

  // 1. Poll for pending requests
  let requests: ScoringRequest[];
  try {
    requests = await pollSupabase(config);
  } catch (err: any) {
    console.error('Poll failed:', err.message);
    return stats;
  }

  if (requests.length === 0) {
    return stats;
  }

  console.log(`[cherry-worker] Found ${requests.length} pending scoring request(s)`);

  // 2. Process each request sequentially (avoids rate-limit pressure on reasoner)
  for (const request of requests) {
    // Claim it
    const claimed = await claimRequest(config, request.id);
    if (!claimed) {
      stats.skipped++;
      continue;
    }

    try {
      const { scoreId } = await processRequest(config, request, spawnFn);
      await markCompleted(config, request.id, scoreId);
      stats.processed++;
      console.log(`[cherry-worker] ✅ Scored request ${request.id} → score ${scoreId}`);
    } catch (err: any) {
      stats.failed++;
      const msg = err?.message ?? String(err);
      console.error(`[cherry-worker] ❌ Failed request ${request.id}:`, msg);
      await markFailed(config, request.id, msg);
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Standalone entry point (can be run directly via tsx/ts-node)
// ---------------------------------------------------------------------------

if (require.main === module) {
  (async () => {
    const config = loadConfig();

    console.log('[cherry-worker] Starting standalone scoring cycle...');
    console.log('[cherry-worker] Note: standalone mode requires a spawnFn adapter.');
    console.log('[cherry-worker] Use the heartbeat hook (.openclaw/heartbeat/scoring-check.ts) for production.');

    // Placeholder spawn that throws — replace with your adapter
    const spawnFn = async (_prompt: string, _agentId: string): Promise<string> => {
      throw new Error('No spawnFn provided. Run via OpenClaw heartbeat for production use.');
    };

    const stats = await runScoringCycle(config, spawnFn);
    console.log('[cherry-worker] Cycle complete:', stats);
    process.exit(stats.failed > 0 ? 1 : 0);
  })();
}
