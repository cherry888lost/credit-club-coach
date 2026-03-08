-- Cleanup script for Credit Club Coach demo data
-- Run this in Supabase SQL Editor to reset or clean up test data

-- ============================================
-- OPTION 1: Remove all old placeholder test calls
-- ============================================
-- DELETE FROM call_scores WHERE call_id IN (
--   SELECT id FROM calls WHERE title = 'Test Webhook Call' OR fathom_call_id LIKE 'test_call_%'
-- );
-- DELETE FROM flags WHERE call_id IN (
--   SELECT id FROM calls WHERE title = 'Test Webhook Call' OR fathom_call_id LIKE 'test_call_%'
-- );
-- DELETE FROM calls WHERE title = 'Test Webhook Call' OR fathom_call_id LIKE 'test_call_%';

-- ============================================
-- OPTION 2: Remove ALL demo data (including new realistic demos)
-- ============================================
-- DELETE FROM call_scores WHERE call_id IN (
--   SELECT id FROM calls WHERE fathom_call_id LIKE 'demo_%' OR fathom_call_id LIKE 'test_call_%' OR metadata->>'source' IN ('demo_webhook', 'dashboard_test')
-- );
-- DELETE FROM flags WHERE call_id IN (
--   SELECT id FROM calls WHERE fathom_call_id LIKE 'demo_%' OR fathom_call_id LIKE 'test_call_%' OR metadata->>'source' IN ('demo_webhook', 'dashboard_test')
-- );
-- DELETE FROM calls WHERE fathom_call_id LIKE 'demo_%' OR fathom_call_id LIKE 'test_call_%' OR metadata->>'source' IN ('demo_webhook', 'dashboard_test');
-- DELETE FROM reps WHERE clerk_user_id LIKE 'demo_%';

-- ============================================
-- OPTION 3: View current demo data (safe - just shows what exists)
-- ============================================
SELECT 
  c.id,
  c.title,
  c.fathom_call_id,
  c.rep_id,
  r.name as rep_name,
  c.org_id,
  c.created_at,
  c.metadata->>'source' as source,
  cs.opening_score,
  cs.discovery_score,
  cs.closing_score
FROM calls c
LEFT JOIN reps r ON c.rep_id = r.id
LEFT JOIN call_scores cs ON c.id = cs.call_id
WHERE c.fathom_call_id LIKE 'demo_%' 
   OR c.fathom_call_id LIKE 'test_call_%'
   OR c.metadata->>'source' IN ('demo_webhook', 'dashboard_test')
   OR c.title = 'Test Webhook Call'
ORDER BY c.created_at DESC;

-- ============================================
-- OPTION 4: Fix rep assignment for unassigned demo calls
-- Assign them to existing demo reps
-- ============================================
-- Get a demo rep ID
-- DO $$
-- DECLARE
--   demo_rep_id UUID;
-- BEGIN
--   SELECT id INTO demo_rep_id FROM reps WHERE clerk_user_id LIKE 'demo_%' LIMIT 1;
--   
--   IF demo_rep_id IS NOT NULL THEN
--     UPDATE calls 
--     SET rep_id = demo_rep_id
--     WHERE rep_id IS NULL 
--       AND (fathom_call_id LIKE 'demo_%' OR metadata->>'source' = 'demo_webhook');
--   END IF;
-- END $$;

-- ============================================
-- Count current data
-- ============================================
SELECT 
  'Total Calls' as metric, 
  COUNT(*) as count 
FROM calls
UNION ALL
SELECT 
  'Demo/Test Calls', 
  COUNT(*) 
FROM calls 
WHERE fathom_call_id LIKE 'demo_%' 
   OR fathom_call_id LIKE 'test_call_%'
   OR metadata->>'source' IN ('demo_webhook', 'dashboard_test')
   OR title = 'Test Webhook Call'
UNION ALL
SELECT 
  'Unassigned Calls',
  COUNT(*)
FROM calls
WHERE rep_id IS NULL;
