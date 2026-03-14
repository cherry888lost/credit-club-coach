-- Migration 004: Enhanced AI Analysis Fields
-- Adds detailed scoring breakdown, close analysis, techniques detection

-- Close analysis fields
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS close_type TEXT;
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS close_outcome TEXT;
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS close_confidence INTEGER;
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS close_analysis JSONB;

-- Score breakdown (the 6-dimension scoring)
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- Detailed objection analysis with quotes
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS objection_details JSONB DEFAULT '[]'::jsonb;

-- Techniques detected
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS techniques_detected JSONB DEFAULT '{}'::jsonb;

-- Value stacking and urgency individual scores
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS value_stacking_score INTEGER;
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS urgency_score INTEGER;

-- Missed opportunities
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS missed_opportunities JSONB DEFAULT '[]'::jsonb;

-- Coaching feedback
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS coaching_feedback TEXT[];

-- Key quotes
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS key_quotes JSONB DEFAULT '[]'::jsonb;

-- Rep name (denormalized for quick display)
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS rep_name TEXT;

-- Prospect name extracted from call
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS prospect_name TEXT;

-- Grade letter
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS grade TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_scores_close_type ON call_scores(close_type) WHERE close_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_scores_close_outcome ON call_scores(close_outcome) WHERE close_outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_scores_grade ON call_scores(grade) WHERE grade IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_scores_rep_name ON call_scores(rep_name) WHERE rep_name IS NOT NULL;

-- Add close_type constraint
ALTER TABLE call_scores DROP CONSTRAINT IF EXISTS call_scores_close_type_v2_check;
ALTER TABLE call_scores ADD CONSTRAINT call_scores_close_type_v2_check
CHECK (close_type IS NULL OR close_type IN ('full', 'payment_plan', 'partial_access', 'deposit', 'none'));

ALTER TABLE call_scores DROP CONSTRAINT IF EXISTS call_scores_close_outcome_check;
ALTER TABLE call_scores ADD CONSTRAINT call_scores_close_outcome_check
CHECK (close_outcome IS NULL OR close_outcome IN ('closed', 'follow_up', 'no_sale'));

SELECT 'Migration 004 complete — Enhanced AI Analysis' as status;
