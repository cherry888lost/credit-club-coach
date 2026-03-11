-- Create call_scores table for sales coaching analysis
CREATE TABLE IF NOT EXISTS call_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES calls(id) ON DELETE CASCADE,
  
  -- Overall metrics
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  quality_label TEXT CHECK (quality_label IN ('poor', 'average', 'strong', 'elite')),
  outcome TEXT CHECK (outcome IN ('closed', 'follow_up', 'no_sale', 'disqualified')),
  close_type TEXT CHECK (close_type IN ('full_close', 'deposit', 'partial_access', 'payment_plan')),
  
  -- Category scores stored as JSONB
  categories JSONB NOT NULL DEFAULT '{}',
  
  -- Analysis arrays
  strengths JSONB DEFAULT '[]',
  weaknesses JSONB DEFAULT '[]',
  objections_detected JSONB DEFAULT '[]',
  objections_handled_well JSONB DEFAULT '[]',
  objections_missed JSONB DEFAULT '[]',
  next_coaching_actions JSONB DEFAULT '[]',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  model_version TEXT DEFAULT 'v1',
  
  -- Each call can only have one score
  UNIQUE(call_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_call_scores_call_id ON call_scores(call_id);

-- Index for score-based queries
CREATE INDEX IF NOT EXISTS idx_call_scores_overall_score ON call_scores(overall_score);
CREATE INDEX IF NOT EXISTS idx_call_scores_quality_label ON call_scores(quality_label);
CREATE INDEX IF NOT EXISTS idx_call_scores_outcome ON call_scores(outcome);
