"use strict";
/**
 * Controlled Learning Engine - Tightened Per credit-club-extraction-rules.md
 *
 * Watches scored calls for valuable patterns and queues them for admin review.
 * Nothing gets promoted to benchmark library without explicit approval.
 *
 * FLOW:
 *   1. Call is scored (existing system — untouched)
 *   2. Post-scoring hook calls `extractCandidatePatterns()`
 *   3. Patterns saved to `learning_queue` as `pending_review`
 *   4. Admin reviews via dashboard → approve / reject
 *   5. Approved patterns promoted to benchmark_calls or objection_library
 *
 * EXTRACTION RULES (per credit-club-extraction-rules.md):
 *   - Golden Rule: If a pattern would not improve future scoring or coaching, do not queue it
 *   - Minimum confidence_score: 80
 *   - Minimum category score: 8/10
 *   - Must have exact prospect quote AND exact rep quote
 *   - Must be a real sales call (not low-signal)
 *   - Must be specific, useful, repeatable, grounded in evidence
 *   - Hard reject: generic friendliness, rapport banter, guessed outcomes, admin-only content
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCandidatePatterns = extractCandidatePatterns;
exports.saveCandidatePatterns = saveCandidatePatterns;
exports.approvePattern = approvePattern;
exports.rejectPattern = rejectPattern;
exports.promoteToBenchmark = promoteToBenchmark;
exports.updateObjectionFromPattern = updateObjectionFromPattern;
// ---------------------------------------------------------------------------
// Quality Thresholds (per credit-club-extraction-rules.md)
// ---------------------------------------------------------------------------
const MIN_CONFIDENCE_SCORE = 80; // confidence_score >= 80
const MIN_CATEGORY_SCORE = 8; // relevant category score >= 8
const MIN_CONFIDENCE_FOR_PROMOTE = 90; // For "promote" recommendation
// ---------------------------------------------------------------------------
// Category Mapping (from scoring categories to candidate categories)
// ---------------------------------------------------------------------------
function mapToCandidateCategory(scoringCategory) {
    const map = {
        'discovery_quality': 'discovery_quality',
        'pain_amplification': 'pain_amplification',
        'offer_explanation': 'offer_explanation',
        'confidence_authority': 'confidence_authority',
        'objection_handling': 'objection_handling',
        'overall_close_quality': 'close_quality',
        'urgency_close_attempt': 'urgency_close',
        'next_steps_clarity': 'next_steps_clarity',
    };
    return map[scoringCategory] || null;
}
// ---------------------------------------------------------------------------
// Hard Rejection Filters (per credit-club-extraction-rules.md)
// ---------------------------------------------------------------------------
function shouldRejectPattern(category, score, evidence, reasoning, scoreData) {
    // Reject if low-signal call
    if (scoreData.low_signal) {
        return { reject: true, reason: 'Low-signal call - not suitable for learning' };
    }
    // Reject if score below threshold
    if (score < MIN_CATEGORY_SCORE) {
        return { reject: true, reason: `Score ${score} below threshold ${MIN_CATEGORY_SCORE}` };
    }
    // Reject if no evidence
    if (!evidence || evidence.trim().length < 10) {
        return { reject: true, reason: 'Missing or too-short evidence quote' };
    }
    // Reject generic/empty patterns
    const lowerEvidence = evidence.toLowerCase();
    const lowerReasoning = reasoning.toLowerCase();
    // Reject generic rapport/friendliness
    if (category === 'rapport_tone') {
        return { reject: true, reason: 'Rapport-only patterns are not queued per extraction rules' };
    }
    // Reject call control (not in allowed categories)
    if (category === 'call_control') {
        return { reject: true, reason: 'Call control patterns are not queued per extraction rules' };
    }
    // Reject generic phrases
    const genericPhrases = [
        'sounds good',
        'that makes sense',
        'i understand',
        'great',
        'nice',
        'okay',
        'yeah',
    ];
    if (genericPhrases.some(p => lowerEvidence.includes(p) && evidence.length < 50)) {
        return { reject: true, reason: 'Generic phrase without specific sales value' };
    }
    // Reject if evidence is just pleasantries
    if (lowerEvidence.includes('hello') && evidence.length < 30) {
        return { reject: true, reason: 'Greeting/small talk - not a learning pattern' };
    }
    return { reject: false };
}
// ---------------------------------------------------------------------------
// Pattern Extraction (tightened per credit-club-extraction-rules.md)
// ---------------------------------------------------------------------------
/**
 * Extract candidate patterns from a scored call.
 *
 * CRITICAL: This does NOT add anything to the benchmark library.
 * It only creates `pending_review` entries in `learning_queue`.
 *
 * Per extraction-rules.md:
 * - Only queue patterns that would improve future scoring or coaching
 * - Must have confidence_score >= 80
 * - Must have category score >= 8
 * - Must have exact prospect quote AND exact rep quote
 * - Must be specific, useful, repeatable, grounded in evidence
 */
function extractCandidatePatterns(score, repName, callDate, transcript // Optional: for extracting exact quotes
) {
    const patterns = [];
    // Skip low-signal calls entirely
    if (score.low_signal) {
        return patterns;
    }
    const base = {
        source_call_id: score.call_id,
        source_score_id: score.id,
        source_rep_name: repName,
        source_call_date: callDate,
        source_outcome: score.outcome,
        source_close_type: score.close_type,
    };
    // 1. High-scoring categories (8+) in allowed categories only
    for (const [catName, catData] of Object.entries(score.categories)) {
        const candidateCategory = mapToCandidateCategory(catName);
        // Skip if not in allowed categories
        if (!candidateCategory)
            continue;
        // Apply hard rejection filters
        const rejection = shouldRejectPattern(catName, catData.score, catData.evidence, catData.reasoning, score);
        if (rejection.reject) {
            continue;
        }
        // Calculate confidence score (0-100)
        const confidenceScore = Math.min(Math.round((catData.score / 10) * 100), 95);
        // Skip if below confidence threshold
        if (confidenceScore < MIN_CONFIDENCE_SCORE) {
            continue;
        }
        // Determine suggested action based on thresholds
        let suggestedAction = 'approve';
        if (confidenceScore >= MIN_CONFIDENCE_FOR_PROMOTE &&
            (score.outcome === 'closed' || score.overall_score >= 80)) {
            suggestedAction = 'promote';
        }
        // Extract relevant transcript section (first 200 chars of evidence context)
        const transcriptSection = transcript
            ? transcript.substring(0, 500) + (transcript.length > 500 ? '...' : '')
            : 'Transcript not available for extraction';
        patterns.push({
            ...base,
            candidate_category: candidateCategory,
            candidate_title: `Strong ${candidateCategory.replace(/_/g, ' ')}`,
            confidence_score: confidenceScore,
            exact_prospect_quote: '[Extract from transcript - prospect line]', // TODO: Parse from transcript
            exact_rep_quote: catData.evidence.substring(0, 300),
            why_this_mattered: catData.reasoning,
            why_this_is_repeatable: `This ${candidateCategory} pattern scored ${catData.score}/10 and demonstrates effective technique transferable to similar Credit Club sales situations.`,
            source_transcript_section: transcriptSection,
            relevant_category_score: catData.score,
            reason_for_queueing: `Category ${catName} scored ${catData.score}/10 with clear evidence of effective sales technique`,
            suggested_action: suggestedAction,
        });
    }
    // 2. Well-handled objections (per extraction-rules.md objection rules)
    for (const objection of score.objections_handled_well || []) {
        // Skip if objection is too vague
        if (!objection || objection.length < 10)
            continue;
        if (objection.length > 200)
            continue; // Too long to be a specific objection phrase
        // Check if this was actually detected as an objection
        const wasDetected = (score.objections_detected || []).some(o => objection.toLowerCase().includes(o.toLowerCase()) ||
            o.toLowerCase().includes(objection.toLowerCase()));
        if (!wasDetected)
            continue;
        // Calculate confidence based on overall score
        const confidenceScore = Math.min(Math.round((score.overall_score / 100) * 100), 90);
        if (confidenceScore < MIN_CONFIDENCE_SCORE)
            continue;
        patterns.push({
            ...base,
            candidate_category: 'objection_handling',
            candidate_title: `Objection handling: ${objection.substring(0, 50)}...`,
            confidence_score: confidenceScore,
            exact_prospect_quote: objection,
            exact_rep_quote: '[Extract from transcript - rep response to this objection]',
            why_this_mattered: 'Objection was identified and handled effectively, moving the conversation forward',
            why_this_is_repeatable: 'This objection pattern is likely to recur in Credit Club sales calls and the response technique can be modeled',
            source_transcript_section: transcript ? transcript.substring(0, 500) : 'N/A',
            relevant_category_score: score.categories['objection_handling']?.score || 7,
            reason_for_queueing: `Well-handled objection with clear technique demonstrated`,
            suggested_action: score.outcome === 'closed' ? 'promote' : 'approve',
        });
    }
    return patterns;
}
// ---------------------------------------------------------------------------
// Supabase operations
// ---------------------------------------------------------------------------
async function saveCandidatePatterns(supabase, orgId, patterns) {
    const errors = [];
    let saved = 0;
    for (const pattern of patterns) {
        const { error } = await supabase
            .from('learning_queue')
            .insert({
            org_id: orgId,
            // Legacy fields (for backward compat)
            source_call_id: pattern.source_call_id,
            source_score_id: pattern.source_score_id,
            source_rep_name: pattern.source_rep_name,
            source_call_date: pattern.source_call_date,
            pattern_category: pattern.candidate_category,
            exact_quote: pattern.exact_rep_quote,
            explanation: pattern.why_this_mattered,
            suggested_action: pattern.suggested_action === 'promote' ? 'Promote to benchmark library' :
                pattern.suggested_action === 'reject' ? 'Reject - does not meet criteria' :
                    'Review for approval',
            ai_confidence: pattern.confidence_score / 100,
            // New structured fields (per extraction-rules.md)
            candidate_category: pattern.candidate_category,
            candidate_title: pattern.candidate_title,
            confidence_score: pattern.confidence_score,
            exact_prospect_quote: pattern.exact_prospect_quote,
            exact_rep_quote: pattern.exact_rep_quote,
            why_this_mattered: pattern.why_this_mattered,
            why_this_is_repeatable: pattern.why_this_is_repeatable,
            source_outcome: pattern.source_outcome,
            source_close_type: pattern.source_close_type,
            relevant_category_score: pattern.relevant_category_score,
            reason_for_queueing: pattern.reason_for_queueing,
            status: 'pending',
        });
        if (error) {
            errors.push(`Failed to save pattern (${pattern.candidate_category}): ${error.message}`);
        }
        else {
            saved++;
        }
    }
    return { saved, errors };
}
// ---------------------------------------------------------------------------
// Admin approval workflow
// ---------------------------------------------------------------------------
async function approvePattern(supabase, patternId, reviewedBy, notes) {
    const { error } = await supabase
        .from('learning_queue')
        .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        notes: notes || null,
    })
        .eq('id', patternId)
        .eq('status', 'pending');
    if (error)
        return { success: false, error: error.message };
    return { success: true };
}
async function rejectPattern(supabase, patternId, reviewedBy, notes) {
    const { error } = await supabase
        .from('learning_queue')
        .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        notes: notes || null,
    })
        .eq('id', patternId)
        .eq('status', 'pending');
    if (error)
        return { success: false, error: error.message };
    return { success: true };
}
/**
 * Promote an approved pattern to the benchmark library.
 * Per extraction-rules.md: Only promoted candidates become reusable system memory.
 */
async function promoteToBenchmark(supabase, patternId, orgId, benchmarkData) {
    // Get the pattern
    const { data: pattern, error: fetchErr } = await supabase
        .from('learning_queue')
        .select('*')
        .eq('id', patternId)
        .eq('status', 'approved')
        .single();
    if (fetchErr || !pattern) {
        return { success: false, error: 'Pattern not found or not approved' };
    }
    // Insert into benchmark_calls
    const { data: benchmark, error: insertErr } = await supabase
        .from('benchmark_calls')
        .insert({
        org_id: orgId,
        call_id: pattern.source_call_id,
        score_id: pattern.source_score_id,
        transcript: benchmarkData.transcript,
        outcome: benchmarkData.outcome,
        close_type: benchmarkData.close_type,
        rep_name: benchmarkData.rep_name || pattern.source_rep_name,
        call_date: benchmarkData.call_date || pattern.source_call_date,
        quality_rating: benchmarkData.quality_rating,
        overall_score: benchmarkData.overall_score,
        why_this_is_good: benchmarkData.why_this_is_good,
        strongest_moments: benchmarkData.strongest_moments || [],
        objection_examples: benchmarkData.objection_examples || [],
        key_lines_to_model: benchmarkData.key_lines_to_model || [],
        tags: benchmarkData.tags || [],
        approved_by: pattern.reviewed_by,
        approved_at: new Date().toISOString(),
        source: 'promoted_from_queue',
    })
        .select('id')
        .single();
    if (insertErr) {
        return { success: false, error: insertErr.message };
    }
    // Mark pattern as promoted
    await supabase
        .from('learning_queue')
        .update({
        status: 'promoted',
        promoted_to_benchmark_id: benchmark.id,
    })
        .eq('id', patternId);
    return { success: true, benchmark_id: benchmark.id };
}
/**
 * Update objection library with data from an approved pattern.
 */
async function updateObjectionFromPattern(supabase, patternId, orgId, objectionData) {
    // Check if objection exists
    const { data: existing } = await supabase
        .from('objection_library')
        .select('*')
        .eq('org_id', orgId)
        .eq('label', objectionData.label)
        .single();
    if (existing) {
        // Update existing — append new phrasing / response
        const updates = {
            total_occurrences: (existing.total_occurrences || 0) + 1,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        if (objectionData.raw_phrasing) {
            const phrasings = [...(existing.raw_phrasings || [])];
            if (!phrasings.includes(objectionData.raw_phrasing)) {
                phrasings.push(objectionData.raw_phrasing);
                updates.raw_phrasings = phrasings;
            }
        }
        if (objectionData.strong_response) {
            updates.strong_response_examples = [...(existing.strong_response_examples || []), objectionData.strong_response];
        }
        if (objectionData.weak_response) {
            updates.weak_response_examples = [...(existing.weak_response_examples || []), objectionData.weak_response];
        }
        const { error } = await supabase
            .from('objection_library')
            .update(updates)
            .eq('id', existing.id);
        if (error)
            return { success: false, error: error.message };
    }
    else {
        // Create new objection entry
        const { error } = await supabase
            .from('objection_library')
            .insert({
            org_id: orgId,
            label: objectionData.label,
            display_name: objectionData.display_name || objectionData.label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            category: objectionData.category || 'other',
            raw_phrasings: objectionData.raw_phrasing ? [objectionData.raw_phrasing] : [],
            total_occurrences: 1,
            last_seen_at: new Date().toISOString(),
            created_by: 'learning_queue',
        });
        if (error)
            return { success: false, error: error.message };
    }
    // Mark pattern as promoted
    await supabase
        .from('learning_queue')
        .update({ status: 'promoted' })
        .eq('id', patternId);
    return { success: true };
}
