#!/usr/bin/env node
/**
 * Queue all unscored calls for scoring
 * Usage: node scripts/queue-all-calls.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function queueAllCalls() {
  console.log('Fetching unscored calls...');

  // Get all scored call IDs
  const { data: scored } = await supabase
    .from('call_scores')
    .select('call_id');
  
  const scoredIds = scored?.map(s => s.call_id) || [];
  console.log(`Found ${scoredIds.length} scored calls`);

  // Get all calls with transcripts
  const { data: allCalls, error } = await supabase
    .from('calls')
    .select('id, transcript, rep_id, created_at')
    .not('transcript', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch calls:', error.message);
    process.exit(1);
  }

  // Filter to unscored calls
  const unscoredCalls = allCalls?.filter(c => !scoredIds.includes(c.id)) || [];
  console.log(`Found ${unscoredCalls.length} unscored calls`);

  if (unscoredCalls.length === 0) {
    console.log('No calls to queue');
    return;
  }

  // Check for existing pending requests
  const { data: pendingRequests } = await supabase
    .from('scoring_requests')
    .select('call_id')
    .eq('status', 'pending');
  
  const pendingCallIds = new Set(pendingRequests?.map(r => r.call_id) || []);
  console.log(`Found ${pendingCallIds.size} already pending calls`);

  // Filter out calls that are already pending
  const callsToQueue = unscoredCalls.filter(c => !pendingCallIds.has(c.id));
  console.log(`\nQueuing ${callsToQueue.length} calls...`);

  let queued = 0;
  let errors = 0;

  for (const call of callsToQueue) {
    const transcriptLength = call.transcript?.length || 0;
    
    // Skip calls with very short transcripts (< 500 chars)
    if (transcriptLength < 500) {
      console.log(`  Skipping ${call.id.slice(0, 8)}... - transcript too short (${transcriptLength} chars)`);
      continue;
    }

    const { error: insertError } = await supabase
      .from('scoring_requests')
      .insert({
        call_id: call.id,
        transcript: call.transcript,
        rep_name: call.rep_id,
        status: 'pending',
      });

    if (insertError) {
      console.error(`  Error queuing ${call.id.slice(0, 8)}...: ${insertError.message}`);
      errors++;
    } else {
      console.log(`  Queued ${call.id.slice(0, 8)}... (${transcriptLength} chars)`);
      queued++;
    }
  }

  console.log(`\n✅ Done! Queued: ${queued}, Errors: ${errors}, Skipped (short): ${callsToQueue.length - queued - errors}`);
  console.log('\nThe scoring worker will process these calls on its next cycle.');
}

queueAllCalls().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
