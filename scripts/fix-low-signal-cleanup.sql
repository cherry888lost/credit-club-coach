-- ============================================================
-- LOW-SIGNAL CLEANUP MIGRATION
-- Run after deploying the updated code.
-- ============================================================

-- 1. Find all scoring_requests with score_id = 'low-signal'
--    These are the phantom results from the old pipeline.
SELECT id, call_id, status, score_id, error_message, created_at
FROM scoring_requests
WHERE score_id = 'low-signal'
ORDER BY created_at DESC;

-- 2. Reset those requests to 'pending' so Cherry re-scores them
UPDATE scoring_requests
SET 
  status = 'pending',
  score_id = NULL,
  error_message = NULL,
  updated_at = NOW()
WHERE score_id = 'low-signal';

-- 3. Find any call_scores rows with low_signal = true
SELECT cs.id, cs.call_id, cs.overall_score, cs.quality_label, cs.outcome, c.title
FROM call_scores cs
JOIN calls c ON cs.call_id = c.id
WHERE cs.low_signal = true
ORDER BY cs.created_at DESC;

-- 4. Set low_signal = false on all existing rows
--    (The column will no longer be written to by the pipeline)
UPDATE call_scores SET low_signal = false WHERE low_signal = true;

-- 5. Requeue calls that had low-signal scores but no valid score
--    (Find calls with a scoring_request that completed as low-signal but no real call_scores row)
INSERT INTO scoring_requests (call_id, status, transcript, call_title, rep_name)
SELECT 
  c.id,
  'pending',
  c.transcript,
  c.title,
  r.name
FROM calls c
LEFT JOIN call_scores cs ON c.id = cs.call_id
LEFT JOIN reps r ON c.rep_id = r.id
WHERE c.transcript IS NOT NULL
  AND LENGTH(c.transcript) >= 500
  AND c.deleted_at IS NULL
  AND cs.id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM scoring_requests sr
    WHERE sr.call_id = c.id AND sr.status IN ('pending', 'processing')
  )
  AND EXISTS (
    SELECT 1 FROM scoring_requests sr2
    WHERE sr2.call_id = c.id AND sr2.score_id = 'low-signal'
  );

-- ============================================================
-- VERIFICATION QUERIES (run after pipeline processes the backlog)
-- ============================================================

-- V1: No more low-signal score_ids in scoring_requests
SELECT COUNT(*) as low_signal_requests
FROM scoring_requests
WHERE score_id = 'low-signal';

-- V2: No more low_signal = true in call_scores
SELECT COUNT(*) as low_signal_scores
FROM call_scores
WHERE low_signal = true;

-- V3: All completed scoring_requests have valid UUID score_ids
SELECT COUNT(*) as bad_score_ids
FROM scoring_requests
WHERE status = 'completed'
  AND (score_id IS NULL OR score_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

-- V4: All call_scores have required fields populated
SELECT COUNT(*) as incomplete_scores
FROM call_scores
WHERE overall_score IS NULL
   OR quality_label IS NULL
   OR outcome IS NULL;

-- V5: Pipeline health — recent scoring requests
SELECT status, COUNT(*) as cnt
FROM scoring_requests
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY status;

-- V6: Calls with transcripts that have no score and no pending request
SELECT COUNT(*) as unscored_calls
FROM calls c
WHERE c.transcript IS NOT NULL
  AND LENGTH(c.transcript) >= 500
  AND c.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM call_scores cs WHERE cs.call_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM scoring_requests sr
    WHERE sr.call_id = c.id AND sr.status IN ('pending', 'processing')
  );
