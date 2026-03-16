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
import {
  buildScoringPrompt,
  ScoringResult,
  needsChunking,
  chunkTranscript,
  buildChunkAnalysisPrompt,
  buildMergedScoringPrompt,
  mergeChunkAnalyses,
} from './reasoner-prompt';

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

  const repName = request.rep_name || request.agent_name;
  const agentId = config.reasonerAgentId ?? 'reasoner';
  let result: ScoringResult;

  // 2. Check if chunking needed
  if (needsChunking(transcript)) {
    console.log(`[PROCESS] LONG TRANSCRIPT DETECTED (${transcript.length} chars) - Using chunking strategy`);

    // Chunk the transcript
    const chunks = chunkTranscript(transcript);
    console.log(`[PROCESS] Split into ${chunks.length} chunks`);

    // Analyze each chunk
    const chunkAnalyses: any[] = [];
    for (let i = 0; i < chunks.length; i++) {
      console.log(`[PROCESS] Analyzing chunk ${i + 1}/${chunks.length}...`);
      const chunkPrompt = buildChunkAnalysisPrompt(chunks[i], i, chunks.length, repName);

      let chunkOutput: string;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          chunkOutput = await spawnFn(chunkPrompt, agentId);
          const chunkResult = JSON.parse(chunkOutput.trim().replace(/^```json\s*|\s*```$/g, ''));
          chunkAnalyses.push(chunkResult);
          console.log(`[PROCESS] Chunk ${i + 1} analyzed successfully`);
          break;
        } catch (err: any) {
          retries++;
          console.warn(`[PROCESS] Chunk ${i + 1} analysis failed (attempt ${retries}/${maxRetries}): ${err.message}`);
          if (retries >= maxRetries) {
            // Push empty analysis on final retry failure
            chunkAnalyses.push({
              chunk_summary: `Chunk ${i + 1} analysis failed`,
              key_moments: [],
              techniques_used: [],
              techniques_missed: [],
              close_attempts: [],
              critical_quotes: [],
              objections: [],
              sentiment: 'neutral'
            });
          }
          // Exponential backoff
          await new Promise(r => setTimeout(r, 1000 * retries));
        }
      }
    }

    // Merge analyses
    const mergedSummary = mergeChunkAnalyses(chunkAnalyses);
    const criticalQuotes = chunkAnalyses.flatMap(a => a.critical_quotes || []);
    console.log(`[PROCESS] Merged ${chunkAnalyses.length} chunk analyses, ${criticalQuotes.length} critical quotes`);

    // Build final scoring prompt from merged summary
    const finalPrompt = buildMergedScoringPrompt(mergedSummary, criticalQuotes, repName);
    console.log(`[PROCESS] Final scoring prompt built from merged summary`);

    // Final scoring pass
    const rawOutput = await spawnFn(finalPrompt, agentId);
    console.log(`[PROCESS] Final scoring output received, length: ${rawOutput.length}`);

    result = parseReasonerOutput(rawOutput);

  } else {
    // Standard single-pass scoring for short transcripts
    console.log(`[PROCESS] Standard scoring (no chunking needed)`);
    const prompt = buildScoringPrompt(transcript, repName);
    const rawOutput = await spawnFn(prompt, agentId);
    console.log(`[PROCESS] Raw output received, length: ${rawOutput.length}`);
    result = parseReasonerOutput(rawOutput);
  }

  console.log(`[PROCESS] Parsed successfully: overall_score=${result.overall_score}, quality_label=${result.quality_label}, outcome=${result.outcome}, close_type=${result.close_type}`);

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
