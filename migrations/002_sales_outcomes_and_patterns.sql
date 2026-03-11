-- Migration 002: Sales Outcomes, Winning Call Patterns, Follow-Up Messages
-- Run in Supabase SQL Editor
-- Date: 2026-03-11

-- ============================================
-- PART 1: Manual Outcome Logging
-- ============================================

-- Add manual outcome fields to call_scores
-- AI should NOT guess close_type - it stays null unless manually set
ALTER TABLE call_scores
ADD COLUMN IF NOT EXISTS manual_outcome TEXT,
ADD COLUMN IF NOT EXISTS manual_close_type TEXT,
ADD COLUMN IF NOT EXISTS outcome_logged_by UUID,
ADD COLUMN IF NOT EXISTS outcome_logged_at TIMESTAMPTZ;

-- Constraints for valid values
ALTER TABLE call_scores
DROP CONSTRAINT IF EXISTS call_scores_manual_outcome_check;
ALTER TABLE call_scores
ADD CONSTRAINT call_scores_manual_outcome_check
CHECK (manual_outcome IS NULL OR manual_outcome IN ('closed', 'follow_up', 'no_sale'));

ALTER TABLE call_scores
DROP CONSTRAINT IF EXISTS call_scores_manual_close_type_check;
ALTER TABLE call_scores
ADD CONSTRAINT call_scores_manual_close_type_check
CHECK (manual_close_type IS NULL OR manual_close_type IN ('full_close', 'deposit', 'payment_plan', 'partial_access'));

-- If manual_outcome != 'closed', manual_close_type must be null
-- (enforced in application logic, not DB constraint for flexibility)

-- Index for filtering by manual outcome
CREATE INDEX IF NOT EXISTS idx_call_scores_manual_outcome ON call_scores(manual_outcome) WHERE manual_outcome IS NOT NULL;

-- ============================================
-- PART 2: Winning Call Patterns Library
-- ============================================

CREATE TABLE IF NOT EXISTS winning_call_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  
  -- Classification
  outcome TEXT NOT NULL CHECK (outcome IN ('closed', 'follow_up', 'no_sale')),
  close_type TEXT CHECK (close_type IS NULL OR close_type IN ('full_close', 'deposit', 'payment_plan', 'partial_access')),
  overall_score INTEGER,
  
  -- Extracted patterns (JSON for each category)
  extracted_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure:
  -- {
  --   "discovery_depth": { "score": 8, "techniques": [...], "key_questions": [...], "evidence": "..." },
  --   "pain_amplification": { "score": 9, "techniques": [...], "trigger_phrases": [...], "evidence": "..." },
  --   "authority_demo": { "score": 7, "techniques": [...], "credibility_moves": [...], "evidence": "..." },
  --   "objection_handling": { "score": 8, "objections": [...], "responses": [...], "evidence": "..." },
  --   "close_attempts": { "count": 3, "techniques": [...], "timing": "...", "evidence": "..." },
  --   "urgency_creation": { "score": 7, "techniques": [...], "trigger_phrases": [...], "evidence": "..." }
  -- }
  
  -- Metadata
  rep_name TEXT,
  call_date TIMESTAMPTZ,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_winning_patterns_org ON winning_call_patterns(org_id);
CREATE INDEX IF NOT EXISTS idx_winning_patterns_outcome ON winning_call_patterns(outcome);
CREATE INDEX IF NOT EXISTS idx_winning_patterns_score ON winning_call_patterns(overall_score DESC);

-- ============================================
-- PART 3: Follow-Up Messages
-- ============================================

CREATE TABLE IF NOT EXISTS follow_up_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  score_id UUID REFERENCES call_scores(id) ON DELETE SET NULL,
  
  -- Message variants
  whatsapp_message TEXT,
  sms_message TEXT,
  email_subject TEXT,
  email_body TEXT,
  
  -- Context used
  prospect_name TEXT,
  key_pain_points JSONB DEFAULT '[]'::jsonb,
  discussed_topics JSONB DEFAULT '[]'::jsonb,
  next_steps TEXT,
  cta TEXT,
  
  -- Generation metadata
  model_version TEXT,
  generated_by UUID,  -- rep who requested
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_call ON follow_up_messages(call_id);

-- ============================================
-- PART 4: Enhanced coaching output columns
-- ============================================

-- Add enhanced weakness details to call_scores
ALTER TABLE call_scores
ADD COLUMN IF NOT EXISTS enhanced_weaknesses JSONB DEFAULT '[]'::jsonb;
-- Structure: [
--   {
--     "category": "objection_handling",
--     "what_went_wrong": "...",
--     "why_it_matters": "...",
--     "better_response_example": "...",
--     "credit_club_context": "..."
--   }
-- ]

ALTER TABLE call_scores
ADD COLUMN IF NOT EXISTS objection_scripts JSONB DEFAULT '[]'::jsonb;
-- Structure: [
--   {
--     "objection": "It's too expensive",
--     "prospect_said": "direct quote",
--     "rep_said": "what they actually said",
--     "better_response": "Here's what I'd suggest...",
--     "technique": "Feel-Felt-Found / Isolate-Empathize-Reframe"
--   }
-- ]

-- ============================================
-- PART 5: Verify migration
-- ============================================

SELECT 'Migration 002 complete' as status;

-- Check new columns on call_scores
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'call_scores' 
  AND column_name IN ('manual_outcome', 'manual_close_type', 'enhanced_weaknesses', 'objection_scripts')
ORDER BY column_name;

-- Check new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('winning_call_patterns', 'follow_up_messages')
ORDER BY table_name;
