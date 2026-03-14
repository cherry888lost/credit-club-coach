/**
 * Post-Scoring Hook
 *
 * Called after a call is scored by the existing system.
 * Extracts candidate patterns → saves to learning_queue.
 * Does NOT modify the scoring pipeline itself.
 *
 * Integration point: call this from the scoring API route
 * after writeScore() succeeds.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  extractCandidatePatterns,
  saveCandidatePatterns,
  ScoreData,
} from './controlled-learning';

export interface PostScoringContext {
  supabase: SupabaseClient;
  orgId: string;
  scoreData: ScoreData;
  repName: string | null;
  callDate: string | null;
  transcript: string | null;
  durationSeconds: number | null;
}

/**
 * Run the post-scoring hook.
 *
 * This is fire-and-forget safe — errors here should NOT
 * fail the main scoring pipeline.
 */
export async function runPostScoringHook(ctx: PostScoringContext): Promise<{
  patternsFound: number;
  patternsSaved: number;
  errors: string[];
}> {
  const result = {
    patternsFound: 0,
    patternsSaved: 0,
    errors: [] as string[],
  };

  try {
    // 1. Extract candidate patterns (with tightened rules per extraction-rules.md)
    const patterns = extractCandidatePatterns(
      ctx.scoreData,
      ctx.repName,
      ctx.callDate,
      ctx.transcript || undefined
    );
    result.patternsFound = patterns.length;

    if (patterns.length === 0) return result;

    // 3. Save to learning_queue
    const { saved, errors } = await saveCandidatePatterns(
      ctx.supabase,
      ctx.orgId,
      patterns
    );
    result.patternsSaved = saved;
    result.errors = errors;

    // 4. Update objection frequency counts
    await updateObjectionFrequencies(ctx.supabase, ctx.orgId, ctx.scoreData);

  } catch (err: any) {
    result.errors.push(`Post-scoring hook error: ${err.message}`);
  }

  return result;
}

/**
 * Increment objection frequency in the objection_library
 * when we detect known objections in a scored call.
 */
async function updateObjectionFrequencies(
  supabase: SupabaseClient,
  orgId: string,
  scoreData: ScoreData
): Promise<void> {
  const allObjections = scoreData.objections_detected || [];
  if (allObjections.length === 0) return;

  // Fetch existing objection labels
  const { data: existingObjections } = await supabase
    .from('objection_library')
    .select('id, label, total_occurrences')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (!existingObjections) return;

  const labelMap = new Map(existingObjections.map(o => [o.label.toLowerCase(), o]));

  for (const objection of allObjections) {
    const key = objection.toLowerCase().trim().replace(/\s+/g, '_');

    // Try exact match or fuzzy match
    const match = labelMap.get(key) ||
      [...labelMap.values()].find(o =>
        key.includes(o.label) || o.label.includes(key)
      );

    if (match) {
      await supabase
        .from('objection_library')
        .update({
          total_occurrences: (match.total_occurrences || 0) + 1,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);
    }
  }
}
