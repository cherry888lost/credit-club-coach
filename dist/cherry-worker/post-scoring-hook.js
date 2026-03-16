"use strict";
/**
 * Post-Scoring Hook (cherry-worker version)
 *
 * Calls the controlled learning engine after each call is scored.
 * Uses tightened extraction rules per credit-club-extraction-rules.md.
 * Fire-and-forget safe.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPostScoringHook = runPostScoringHook;
const controlled_learning_1 = require("../lib/scoring/controlled-learning");
// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------
async function runPostScoringHook(ctx) {
    const result = { patternsFound: 0, patternsSaved: 0, errors: [] };
    console.log(`[POST_HOOK] callId=${ctx.scoreData.call_id}, overall_score=${ctx.scoreData.overall_score}, low_signal=${ctx.scoreData.low_signal}`);
    try {
        // Extract patterns using tightened rules per credit-club-extraction-rules.md
        const patterns = (0, controlled_learning_1.extractCandidatePatterns)(ctx.scoreData, ctx.repName, ctx.callDate, ctx.transcript || undefined);
        result.patternsFound = patterns.length;
        console.log(`[POST_HOOK] patterns found: ${patterns.length}`);
        if (patterns.length === 0) {
            console.log(`[POST_HOOK] no patterns met quality threshold for queueing`);
            return result;
        }
        // Save to learning_queue using controlled-learning.ts
        const saveResult = await (0, controlled_learning_1.saveCandidatePatterns)(ctx.supabase, ctx.orgId, patterns);
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
    }
    catch (err) {
        result.errors.push(`Hook error: ${err.message}`);
        console.log(`[POST_HOOK] ERROR: ${err.message}`);
    }
    console.log(`[POST_HOOK] COMPLETE: saved=${result.patternsSaved}`);
    return result;
}
