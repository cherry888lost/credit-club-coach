/**
 * Post-Scoring Hook (cherry-worker version)
 *
 * Calls the controlled learning engine after each call is scored.
 * Uses tightened extraction rules per credit-club-extraction-rules.md.
 * Fire-and-forget safe.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { extractCandidatePatterns, saveCandidatePatterns } from '../lib/scoring/controlled-learning';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreData {
  id: string;
  call_id: string;
  overall_score: number;
  quality_label: string;
  outcome: string;
  close_type: string | null;
  low_signal?: boolean;
  categories: Record<string, { score: number; reasoning: string; evidence: string }>;
  strengths: string[];
  weaknesses: string[];
  objections_detected: string[];
  objections_handled_well: string[];
  objections_missed: string[];
}

export interface PostScoringContext {
  supabase: SupabaseClient;
  orgId: string;
  scoreData: ScoreData;
  repName: string | null;
  callDate: string | null;
  transcript: string | null;
  durationSeconds: number | null;
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------

export async function runPostScoringHook(ctx: PostScoringContext): Promise<{
  patternsFound: number;
  patternsSaved: number;
  errors: string[];
}> {
  const result = { patternsFound: 0, patternsSaved: 0, errors: [] as string[] };

  console.log(`[POST_HOOK] callId=${ctx.scoreData.call_id}, overall_score=${ctx.scoreData.overall_score}, low_signal=${ctx.scoreData.low_signal}`);

  try {
    // Extract patterns using tightened rules per credit-club-extraction-rules.md
    const patterns = extractCandidatePatterns(
      ctx.scoreData, 
      ctx.repName, 
      ctx.callDate,
      ctx.transcript || undefined
    );
    
    result.patternsFound = patterns.length;
    console.log(`[POST_HOOK] patterns found: ${patterns.length}`);

    if (patterns.length === 0) {
      console.log(`[POST_HOOK] no patterns met quality threshold for queueing`);
      return result;
    }

    // Save to learning_queue using controlled-learning.ts
    const saveResult = await saveCandidatePatterns(ctx.supabase, ctx.orgId, patterns);
    result.patternsSaved = saveResult.saved;
    result.errors = saveResult.errors;

    console.log(`[POST_HOOK] patterns saved: ${result.patternsSaved}, errors: ${result.errors.length}`);

    // Update objection frequencies (legacy behavior preserved)
    const allObjections = ctx.scoreData.objections_detected || [];
    if (allObjections.length > 0) {
      const { data: existingObj } = await ctx.supabase
        .from('objection_library')
        .select('id, label, total_occurrences')
        .eq('org_id', ctx.orgId)
        .eq('is_active', true);

      if (existingObj) {
        const labelMap = new Map(existingObj.map(o => [o.label.toLowerCase(), o]));
        for (const objection of allObjections) {
          const key = objection.toLowerCase().trim().replace(/\s+/g, '_');
          const match = labelMap.get(key) ||
            [...labelMap.values()].find(o => key.includes(o.label) || o.label.includes(key));
          if (match) {
            await ctx.supabase
              .from('objection_library')
              .update({
                total_occurrences: (match.total_occurrences || 0) + 1,
                last_seen_at: new Date().toISOString(),
              })
              .eq('id', match.id);
          }
        }
      }
    }

  } catch (err: any) {
    result.errors.push(`Hook error: ${err.message}`);
    console.log(`[POST_HOOK] ERROR: ${err.message}`);
  }

  console.log(`[POST_HOOK] COMPLETE: saved=${result.patternsSaved}`);
  return result;
}