// cherry-worker/index.ts
// Entry point: orchestrates the scoring pipeline
//
// Designed to run inside an OpenClaw heartbeat or as a standalone invocation.
// Uses sessions_spawn (agentId="reasoner") for the actual LLM analysis.

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
} from './scoring-processor';
import { buildScoringPrompt } from './reasoner-prompt';

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
  // 1. Validate transcript
  const transcript = validateTranscript(request.transcript);

  // 2. Build prompt
  const prompt = buildScoringPrompt(transcript, request.agent_name);

  // 3. Spawn reasoner and get raw output
  const agentId = config.reasonerAgentId ?? 'reasoner';
  const rawOutput = await spawnFn(prompt, agentId);

  // 4. Parse and validate the output
  const result = parseReasonerOutput(rawOutput);

  // 5. Write score to call_scores
  if (config.dryRun) {
    console.log('[DRY RUN] Would write score:', JSON.stringify(result, null, 2));
    return { scoreId: 'dry-run' };
  }

  const scoreId = await writeScore(config, request.call_id, request.id, result);
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

    // In standalone mode, we don't have OpenClaw's sessions_spawn available.
    // This is primarily for testing. In production, the heartbeat hook or
    // OpenClaw orchestrator provides the real spawnFn.
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
