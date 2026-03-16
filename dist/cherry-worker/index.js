"use strict";
// cherry-worker/index.ts
// Entry point: orchestrates the scoring pipeline
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.processRequest = processRequest;
exports.runScoringCycle = runScoringCycle;
const scoring_processor_1 = require("./scoring-processor");
const reasoner_prompt_1 = require("./reasoner-prompt");
// ---------------------------------------------------------------------------
// Config from environment
// ---------------------------------------------------------------------------
function loadConfig() {
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
async function processRequest(config, request, spawnFn) {
    console.log(`[PROCESS] Starting request ${request.id}, call ${request.call_id}, transcript length: ${request.transcript?.length}`);
    // 1. Validate transcript
    const transcript = (0, scoring_processor_1.validateTranscript)(request.transcript);
    console.log(`[PROCESS] Transcript validated, length: ${transcript.length}`);
    // 2. Build prompt (rep_name is the current column, agent_name is legacy)
    const repName = request.rep_name || request.agent_name;
    const prompt = (0, reasoner_prompt_1.buildScoringPrompt)(transcript, repName);
    // 3. Spawn reasoner and get raw output
    const agentId = config.reasonerAgentId ?? 'reasoner';
    const rawOutput = await spawnFn(prompt, agentId);
    console.log(`[PROCESS] Raw output received, length: ${rawOutput.length}`);
    // 4. Parse and validate the output
    let result;
    try {
        result = (0, scoring_processor_1.parseReasonerOutput)(rawOutput);
    }
    catch (parseErr) {
        console.error(`[PROCESS] Parse error: ${parseErr.message}`);
        throw parseErr;
    }
    console.log(`[PROCESS] Parsed successfully: overall_score=${result.overall_score}, quality_label=${result.quality_label}, outcome=${result.outcome}`);
    // 5. Write score to call_scores
    if (config.dryRun) {
        console.log('[DRY RUN] Would write score:', JSON.stringify(result, null, 2));
        return { scoreId: 'dry-run' };
    }
    const scoreId = await (0, scoring_processor_1.writeScore)(config, request.call_id, request.id, result, repName);
    console.log(`[PROCESS] Score written: ${scoreId}`);
    // 6. Post-scoring hook: extract patterns for controlled learning
    try {
        const supabase = (0, scoring_processor_1.getSupabase)(config);
        const orgId = '00000000-0000-0000-0000-000000000001';
        const { runPostScoringHook } = await Promise.resolve().then(() => __importStar(require('./post-scoring-hook')));
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
    }
    catch (hookErr) {
        console.warn(`[PROCESS] Post-scoring hook failed (non-fatal):`, hookErr.message);
    }
    console.log(`[PROCESS] Complete: scoreId=${scoreId}`);
    return { scoreId };
}
// ---------------------------------------------------------------------------
// Main run loop: poll → claim → process → complete/fail
// ---------------------------------------------------------------------------
async function runScoringCycle(config, spawnFn) {
    const stats = { processed: 0, failed: 0, skipped: 0 };
    // 1. Poll for pending requests
    let requests;
    try {
        requests = await (0, scoring_processor_1.pollSupabase)(config);
    }
    catch (err) {
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
        const claimed = await (0, scoring_processor_1.claimRequest)(config, request.id);
        if (!claimed) {
            stats.skipped++;
            continue;
        }
        try {
            const { scoreId } = await processRequest(config, request, spawnFn);
            await (0, scoring_processor_1.markCompleted)(config, request.id, scoreId);
            stats.processed++;
            console.log(`[cherry-worker] ✅ Scored request ${request.id} → score ${scoreId}`);
        }
        catch (err) {
            stats.failed++;
            const msg = err?.message ?? String(err);
            console.error(`[cherry-worker] ❌ Failed request ${request.id}:`, msg);
            await (0, scoring_processor_1.markFailed)(config, request.id, msg);
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
        const spawnFn = async (_prompt, _agentId) => {
            throw new Error('No spawnFn provided. Run via OpenClaw heartbeat for production use.');
        };
        const stats = await runScoringCycle(config, spawnFn);
        console.log('[cherry-worker] Cycle complete:', stats);
        process.exit(stats.failed > 0 ? 1 : 0);
    })();
}
