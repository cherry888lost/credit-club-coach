-- SQL to requeue call for scoring after low_signal fix
-- Run this after deploying the updated scoring worker

-- Step 1: Delete the existing low-signal score
DELETE FROM call_scores 
WHERE call_id = '6165c4c1-5e8e-41ac-8512-779558b315aa';

-- Step 2: Reset the scoring request to pending (if exists)
UPDATE scoring_requests 
SET 
  status = 'pending',
  score_id = NULL,
  error_message = NULL,
  updated_at = NOW()
WHERE call_id = '6165c4c1-5e8e-41ac-8512-779558b315aa';

-- Step 3: If no scoring request exists, create one
INSERT INTO scoring_requests (
  call_id,
  org_id,
  status,
  rubric_type,
  requested_by,
  metadata
)
SELECT 
  c.id,
  c.org_id,
  'pending',
  COALESCE(r.sales_role, 'closer'),
  'system',
  jsonb_build_object(
    'requeue_reason', 'low_signal_fix',
    'transcript_length', LENGTH(c.transcript),
    'requeued_at', NOW()
  )
FROM calls c
LEFT JOIN reps r ON c.rep_id = r.id
WHERE c.id = '6165c4c1-5e8e-41ac-8512-779558b315aa'
ON CONFLICT (call_id) WHERE status IN ('pending', 'processing')
DO UPDATE SET 
  status = 'pending',
  score_id = NULL,
  error_message = NULL,
  updated_at = NOW();

-- Step 4: Verify it's queued
SELECT 
  sr.id as request_id,
  sr.call_id,
  sr.status,
  LENGTH(c.transcript) as transcript_length,
  c.title
FROM scoring_requests sr
JOIN calls c ON sr.call_id = c.id
WHERE sr.call_id = '6165c4c1-5e8e-41ac-8512-779558b315aa'
ORDER BY sr.created_at DESC
LIMIT 1;
