#!/usr/bin/env node
/**
 * Requeue a specific call for scoring to test the low_signal fix
 * Usage: node scripts/requeue-call.js <call_id>
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const callId = process.argv[2];
if (!callId) {
  console.error('Usage: node scripts/requeue-call.js <call_id>');
  console.error('Example: node scripts/requeue-call.js 6165c4c1-5e8e-41ac-8512-779558b315aa');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function requeueCall() {
  console.log(`Requeuing call: ${callId}`);

  // 1. Get the call details
  const { data: call, error: callError } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .single();

  if (callError) {
    console.error('Failed to fetch call:', callError.message);
    process.exit(1);
  }

  if (!call) {
    console.error('Call not found:', callId);
    process.exit(1);
  }

  console.log(`Found call: ${call.id}`);
  console.log(`  Transcript length: ${call.transcript?.length || 0} chars`);
  console.log(`  Rep: ${call.rep_name || 'unknown'}`);

  // 2. Check if there's already a pending scoring request
  const { data: existingRequests } = await supabase
    .from('scoring_requests')
    .select('*')
    .eq('call_id', callId)
    .in('status', ['pending', 'processing']);

  if (existingRequests && existingRequests.length > 0) {
    console.log(`  Already has ${existingRequests.length} pending/processing request(s)`);
    console.log('  Skipping (call is already queued)');
    return;
  }

  // 3. Delete any failed requests for this call (so we can retry)
  const { data: failedRequests } = await supabase
    .from('scoring_requests')
    .select('id')
    .eq('call_id', callId)
    .eq('status', 'failed');

  if (failedRequests && failedRequests.length > 0) {
    console.log(`  Deleting ${failedRequests.length} failed request(s)`);
    for (const req of failedRequests) {
      await supabase.from('scoring_requests').delete().eq('id', req.id);
    }
  }

  // 4. Delete any existing scores for this call (so we can re-score)
  const { data: existingScores } = await supabase
    .from('call_scores')
    .select('id')
    .eq('call_id', callId);

  if (existingScores && existingScores.length > 0) {
    console.log(`  Deleting ${existingScores.length} existing score(s)`);
    for (const score of existingScores) {
      await supabase.from('call_scores').delete().eq('id', score.id);
    }
  }

  // 5. Create new scoring request
  const { data: request, error: requestError } = await supabase
    .from('scoring_requests')
    .insert({
      call_id: callId,
      transcript: call.transcript,
      rep_name: call.rep_name,
      status: 'pending',
    })
    .select()
    .single();

  if (requestError) {
    console.error('Failed to create scoring request:', requestError.message);
    process.exit(1);
  }

  console.log(`\n✅ Call requeued successfully!`);
  console.log(`  Request ID: ${request.id}`);
  console.log(`  Status: ${request.status}`);
  console.log(`\nThe scoring worker will pick this up on its next cycle.`);
}

requeueCall().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
