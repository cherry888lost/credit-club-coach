"use strict";
/**
 * Post-Scoring Hook (cherry-worker version)
 *
 * Lightweight wrapper that calls the controlled learning engine
 * after each call is scored. Fire-and-forget safe.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPostScoringHook = runPostScoringHook;
// ---------------------------------------------------------------------------
// Pattern extraction
// ---------------------------------------------------------------------------
function mapCategory(scoringCategory) {
    const map = {
        'rapport_tone': 'rapport_tone',
        'discovery_quality': 'discovery',
        'call_control': 'authority_confidence',
        'pain_amplification': 'pain_amplification',
        'offer_explanation': 'offer_explanation',
        'objection_handling': 'objection_handling',
        'urgency_close_attempt': 'urgency',
        'confidence_authority': 'authority_confidence',
        'next_steps_clarity': 'follow_up_quality',
        'overall_close_quality': 'close_attempt',
    };
    return map[scoringCategory] || 'other';
}
function extractCandidatePatterns(score, repName, callDate) {
    const patterns = [];
    const base = {
        source_call_id: score.call_id,
        source_score_id: score.id,
        source_rep_name: repName,
        source_call_date: callDate,
    };
    // High-scoring categories (8+) → potential benchmark material
    for (const [catName, catData] of Object.entries(score.categories)) {
        if (catData.score >= 8 && catData.evidence) {
            patterns.push({
                ...base,
                pattern_category: mapCategory(catName),
                exact_quote: catData.evidence,
                explanation: `Scored ${catData.score}/10 in ${catName}: ${catData.reasoning}`,
                suggested_action: 'Consider adding to benchmark library',
                ai_confidence: Math.min(catData.score / 10, 0.95),
            });
        }
    }
    // Well-handled objections
    for (const obj of score.objections_handled_well || []) {
        patterns.push({
            ...base,
            pattern_category: 'objection_handling',
            exact_quote: obj,
            explanation: 'Objection handled well — potential training example.',
            suggested_action: 'Review for objection library',
            ai_confidence: 0.7,
        });
    }
    // Missed objections
    for (const obj of score.objections_detected || []) {
        if (!(score.objections_handled_well || []).includes(obj)) {
            patterns.push({
                ...base,
                pattern_category: 'new_objection',
                exact_quote: obj,
                explanation: 'Objection detected but not handled well.',
                suggested_action: 'Check if objection exists in library. If not, create entry.',
                ai_confidence: 0.6,
            });
        }
    }
    // Elite calls
    if (score.overall_score >= 85) {
        patterns.push({
            ...base,
            pattern_category: 'other',
            exact_quote: `Overall: ${score.overall_score}/100 (${score.quality_label})`,
            explanation: `Elite call. Strengths: ${(score.strengths || []).join(', ')}`,
            suggested_action: 'Promote entire call to benchmark library',
            ai_confidence: 0.9,
        });
    }
    return patterns;
}
// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------
async function runPostScoringHook(ctx) {
    const result = { patternsFound: 0, patternsSaved: 0, errors: [] };
    console.log(`[POST_HOOK] callId=${ctx.scoreData.call_id}, overall_score=${ctx.scoreData.overall_score}`);
    try {
        const patterns = extractCandidatePatterns(ctx.scoreData, ctx.repName, ctx.callDate);
        result.patternsFound = patterns.length;
        console.log(`[POST_HOOK] patterns found: ${patterns.length}`);
        if (patterns.length === 0) {
            console.log(`[POST_HOOK] no patterns to save`);
            return result;
        }
        // Save to learning_queue
        for (const pattern of patterns) {
            const { error } = await ctx.supabase
                .from('learning_queue')
                .insert({
                org_id: ctx.orgId,
                ...pattern,
                status: 'pending_review',
            });
            if (error) {
                result.errors.push(`${pattern.pattern_category}: ${error.message}`);
            }
            else {
                result.patternsSaved++;
            }
        }
        console.log(`[POST_HOOK] patterns saved: ${result.patternsSaved}, errors: ${result.errors.length}`);
        // Update objection frequencies
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
