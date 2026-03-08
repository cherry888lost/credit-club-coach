-- Seed data for Credit Club Coach
-- Run this in Supabase SQL Editor to populate test data

-- ============================================
-- PART 1: Check current data counts
-- ============================================
SELECT 
  'reps' as table_name, 
  COUNT(*) as row_count 
FROM reps
UNION ALL
SELECT 
  'calls' as table_name, 
  COUNT(*) as row_count 
FROM calls
UNION ALL
SELECT 
  'call_scores' as table_name, 
  COUNT(*) as row_count 
FROM call_scores
UNION ALL
SELECT 
  'flags' as table_name, 
  COUNT(*) as row_count 
FROM flags
UNION ALL
SELECT 
  'organizations' as table_name, 
  COUNT(*) as row_count 
FROM organizations;

-- ============================================
-- PART 2: Seed test reps (if less than 2 exist)
-- ============================================

-- First, ensure the default org exists
INSERT INTO organizations (id, name, slug, settings)
VALUES ('00000000-0000-0000-0000-000000000001', 'Credit Club Team', 'credit-club-internal', '{}')
ON CONFLICT (id) DO NOTHING;

-- Seed rep 1: Test Closer (only if not exists)
INSERT INTO reps (org_id, clerk_user_id, email, name, role, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test_closer_001',
  'testcloser@creditclub.com',
  'Test Closer',
  'closer',
  'active'
)
ON CONFLICT (clerk_user_id) DO NOTHING;

-- Seed rep 2: Test Manager (only if not exists)
INSERT INTO reps (org_id, clerk_user_id, email, name, role, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test_manager_001',
  'testmanager@creditclub.com',
  'Test Manager',
  'manager',
  'active'
)
ON CONFLICT (clerk_user_id) DO NOTHING;

-- ============================================
-- PART 3: Seed test calls with scores
-- ============================================

-- Get rep IDs for foreign keys
DO $$
DECLARE
  v_rep1_id UUID;
  v_rep2_id UUID;
  v_call1_id UUID;
  v_call2_id UUID;
  v_call3_id UUID;
BEGIN
  -- Get rep IDs
  SELECT id INTO v_rep1_id FROM reps WHERE clerk_user_id = 'test_closer_001' LIMIT 1;
  SELECT id INTO v_rep2_id FROM reps WHERE clerk_user_id = 'test_manager_001' LIMIT 1;
  
  -- Only proceed if we found the reps
  IF v_rep1_id IS NOT NULL THEN
    
    -- Call 1: High scoring call
    INSERT INTO calls (org_id, rep_id, fathom_call_id, title, occurred_at, transcript, recording_url, metadata)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      v_rep1_id,
      'fathom_test_001',
      'Discovery Call - Sarah Johnson',
      NOW() - INTERVAL '2 days',
      'Rep: Hi Sarah, thanks for joining today. I wanted to understand your current credit card setup...\n\nCustomer: Yeah I have a few cards but I''m not really maximizing the points...\n\nRep: Great, let me show you how our system can help you earn 3x on travel...',
      'https://example.com/recording1.mp4',
      '{"source": "seed", "test": true}'::jsonb
    )
    ON CONFLICT (fathom_call_id) DO NOTHING
    RETURNING id INTO v_call1_id;
    
    -- Call 2: Medium scoring call
    INSERT INTO calls (org_id, rep_id, fathom_call_id, title, occurred_at, transcript, recording_url, metadata)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      v_rep1_id,
      'fathom_test_002',
      'Follow-up - Michael Chen',
      NOW() - INTERVAL '1 day',
      'Rep: Hi Michael, following up on our conversation about the Amex Gold...\n\nCustomer: I''m still thinking about the annual fee...\n\nRep: I understand, let me break down how the credits offset that...',
      'https://example.com/recording2.mp4',
      '{"source": "seed", "test": true}'::jsonb
    )
    ON CONFLICT (fathom_call_id) DO NOTHING
    RETURNING id INTO v_call2_id;
    
    -- Call 3: Lower scoring call (for variety)
    INSERT INTO calls (org_id, rep_id, fathom_call_id, title, occurred_at, transcript, recording_url, metadata)
    VALUES (
      '00000000-0000-0000-0000-000000000001',
      v_rep2_id,
      'fathom_test_003',
      'Cold Call - David Smith',
      NOW() - INTERVAL '3 hours',
      'Rep: Hello, is this David? I''m calling about credit card optimization...\n\nCustomer: I''m not interested...\n\nRep: Wait, let me just tell you one thing that could save you...',
      'https://example.com/recording3.mp4',
      '{"source": "seed", "test": true}'::jsonb
    )
    ON CONFLICT (fathom_call_id) DO NOTHING
    RETURNING id INTO v_call3_id;
    
    -- ============================================
    -- PART 4: Seed call scores (using jsonb for strengths/improvements)
    -- ============================================
    
    -- Score for Call 1 (high scores)
    IF v_call1_id IS NOT NULL THEN
      INSERT INTO call_scores (
        call_id, opening_score, discovery_score, rapport_score, objection_handling_score,
        closing_score, structure_score, product_knowledge_score, ai_summary, strengths, improvements
      )
      VALUES (
        v_call1_id,
        9, 9, 8, 9, 8, 9, 9,
        'Excellent discovery call. Rep built strong rapport, asked qualifying questions, and handled fee objection well. Clear structure and strong product knowledge demonstrated throughout.',
        '["Strong opening with clear agenda", "Excellent rapport building", "Great objection handling on annual fee", "Clear structure throughout"]'::jsonb,
        '["Could ask more about travel spending", "Closing could be more assumptive"]'::jsonb
      )
      ON CONFLICT (call_id) DO NOTHING;
    END IF;
    
    -- Score for Call 2 (medium scores)
    IF v_call2_id IS NOT NULL THEN
      INSERT INTO call_scores (
        call_id, opening_score, discovery_score, rapport_score, objection_handling_score,
        closing_score, structure_score, product_knowledge_score, ai_summary, strengths, improvements
      )
      VALUES (
        v_call2_id,
        8, 7, 7, 8, 6, 7, 8,
        'Solid follow-up call. Good product knowledge and objection handling, but closing was weak - rep missed opportunity to assume the sale. Discovery was brief.',
        '["Strong product knowledge", "Good objection handling on fee concern"]'::jsonb,
        '["Discovery questions too brief", "Weak closing - no assumptive close", "Did not recap benefits before asking for sale"]'::jsonb
      )
      ON CONFLICT (call_id) DO NOTHING;
    END IF;
    
    -- Score for Call 3 (lower scores)
    IF v_call3_id IS NOT NULL THEN
      INSERT INTO call_scores (
        call_id, opening_score, discovery_score, rapport_score, objection_handling_score,
        closing_score, structure_score, product_knowledge_score, ai_summary, strengths, improvements
      )
      VALUES (
        v_call3_id,
        5, 3, 4, 5, 3, 4, 6,
        'Cold call that struggled from the start. Rep sounded scripted, failed to hook the prospect in opening, and did not establish rapport. Some product knowledge shown but delivery was poor.',
        '["Attempted to hook with value proposition", "Some product knowledge demonstrated"]'::jsonb,
        '["Opening sounded scripted", "No rapport established", "Discovery was non-existent", "Structure was unclear", "Weak closing attempt"]'::jsonb
      )
      ON CONFLICT (call_id) DO NOTHING;
    END IF;
    
    -- ============================================
    -- PART 5: Seed flags
    -- ============================================
    
    IF v_call3_id IS NOT NULL THEN
      INSERT INTO flags (org_id, call_id, type, note)
      VALUES (
        '00000000-0000-0000-0000-000000000001',
        v_call3_id,
        'coaching_needed',
        'Cold call technique needs work - rep should review opening scripts and rapport building techniques'
      )
      ON CONFLICT DO NOTHING;
    END IF;
    
  END IF;
END $$;

-- ============================================
-- PART 6: Verify seed data
-- ============================================
SELECT 
  'reps' as table_name, 
  COUNT(*) as row_count 
FROM reps
UNION ALL
SELECT 
  'calls' as table_name, 
  COUNT(*) as row_count 
FROM calls
UNION ALL
SELECT 
  'call_scores' as table_name, 
  COUNT(*) as row_count 
FROM call_scores
UNION ALL
SELECT 
  'flags' as table_name, 
  COUNT(*) as row_count 
FROM flags;
