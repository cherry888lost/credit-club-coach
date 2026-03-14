-- Credit Club AI Sales Coach - Full Database Schema
-- Phase 3 Implementation
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CALL SCORES TABLE (Expanded for AI Analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS call_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  call_title TEXT,
  rep_name TEXT NOT NULL,
  
  -- Close Analysis
  close_type TEXT CHECK (close_type IN ('full', 'payment_plan', 'partial_access', 'deposit', 'none')),
  close_outcome TEXT CHECK (close_outcome IN ('closed', 'follow_up', 'no_sale', 'disqualified')),
  close_confidence INTEGER CHECK (close_confidence BETWEEN 0 AND 100),
  close_structure JSONB, -- {upfront_amount, total_amount, remainder_amount, timing}
  close_evidence TEXT[], -- Array of quotes
  
  -- Overall Scoring
  score_total INTEGER CHECK (score_total BETWEEN 0 AND 100),
  score_grade TEXT CHECK (score_grade IN ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F')),
  score_breakdown JSONB NOT NULL DEFAULT '{
    "discovery_rapport": 0,
    "objection_handling": 0,
    "value_stacking": 0,
    "urgency_usage": 0,
    "closing": 0,
    "professionalism": 0
  }'::jsonb,
  
  -- Objections Detected
  objections_detected JSONB DEFAULT '[]'::jsonb,
  -- [{type, timestamp, quote, response_quote, handling_score, confidence}]
  
  -- Techniques Detected
  techniques_detected JSONB DEFAULT '[]'::jsonb,
  -- [{technique, score, evidence}]
  
  -- Individual Scores
  value_stacking_score INTEGER CHECK (value_stacking_score BETWEEN 0 AND 10),
  urgency_score INTEGER CHECK (urgency_score BETWEEN 0 AND 10),
  objection_handling_score INTEGER CHECK (objection_handling_score BETWEEN 0 AND 10),
  
  -- AI Analysis
  missed_opportunities TEXT[] DEFAULT '{}',
  coaching_feedback TEXT[] DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  weaknesses TEXT[] DEFAULT '{}',
  key_quotes JSONB DEFAULT '[]'::jsonb,
  -- [{type: 'objection'|'technique'|'close', timestamp, quote, context}]
  
  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CALLS TABLE (If not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  transcript TEXT,
  rep_name TEXT,
  call_date DATE,
  duration_seconds INTEGER,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPS TABLE (Performance tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS reps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'closer',
  active BOOLEAN DEFAULT true,
  
  -- Cached aggregates (updated by trigger)
  avg_score INTEGER,
  total_calls INTEGER DEFAULT 0,
  close_rate INTEGER, -- percentage
  last_call_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEARNING QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS learning_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES calls(id),
  call_score_id UUID REFERENCES call_scores(id),
  
  -- Pattern Detection
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'value_stacking',
    'objection_handling_pricing',
    'objection_handling_partner',
    'objection_handling_think',
    'urgency_creation',
    'closing_phrase',
    'rapport_building'
  )),
  
  -- Content
  quote TEXT NOT NULL,
  context TEXT, -- surrounding transcript
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  
  -- Source
  rep_name TEXT,
  technique_score INTEGER, -- from parent call
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'promoted')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PATTERN LIBRARY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pattern_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'value_stacking',
    'objection_handling',
    'urgency_creation',
    'closing_phrases',
    'rapport_building'
  )),
  subcategory TEXT, -- e.g., 'pricing', 'partner', 'deposit_close'
  
  -- Content
  title TEXT NOT NULL,
  pattern_text TEXT NOT NULL, -- The actual phrase/pattern
  example_usage TEXT, -- Full context from call
  
  -- Analytics
  usage_count INTEGER DEFAULT 1,
  avg_effectiveness INTEGER, -- average score from calls where used
  success_rate INTEGER, -- percentage of closes when used
  
  -- Source
  source_calls UUID[] DEFAULT '{}',
  added_from_queue_id UUID REFERENCES learning_queue(id),
  
  -- Status
  is_benchmark BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COACHING RECOMMENDATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_score_id UUID REFERENCES call_scores(id),
  rep_name TEXT NOT NULL,
  
  -- Categorization
  category TEXT NOT NULL CHECK (category IN (
    'objection_handling',
    'value_stacking',
    'urgency_creation',
    'closing',
    'discovery',
    'rapport'
  )),
  
  -- Content
  issue TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  example_quote TEXT, -- from the call
  
  -- Priority
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  
  -- Status
  acknowledged BOOLEAN DEFAULT false,
  implemented BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEAM ANALYTICS (Daily aggregates)
-- ============================================
CREATE TABLE IF NOT EXISTS team_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  
  -- Volume
  total_calls INTEGER DEFAULT 0,
  scored_calls INTEGER DEFAULT 0,
  
  -- Performance
  avg_score INTEGER,
  close_rate INTEGER,
  
  -- Close types breakdown
  full_closes INTEGER DEFAULT 0,
  payment_plans INTEGER DEFAULT 0,
  partial_access INTEGER DEFAULT 0,
  deposits INTEGER DEFAULT 0,
  no_sales INTEGER DEFAULT 0,
  
  -- Objections
  top_objections JSONB DEFAULT '[]'::jsonb,
  -- [{type, count, avg_handling_score}]
  
  -- Techniques
  top_techniques JSONB DEFAULT '[]'::jsonb,
  -- [{technique, count, avg_score}]
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_call_scores_call_id ON call_scores(call_id);
CREATE INDEX IF NOT EXISTS idx_call_scores_rep_name ON call_scores(rep_name);
CREATE INDEX IF NOT EXISTS idx_call_scores_close_type ON call_scores(close_type);
CREATE INDEX IF NOT EXISTS idx_call_scores_score_total ON call_scores(score_total);
CREATE INDEX IF NOT EXISTS idx_call_scores_created_at ON call_scores(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_learning_queue_status ON learning_queue(status);
CREATE INDEX IF NOT EXISTS idx_learning_queue_pattern_type ON learning_queue(pattern_type);

CREATE INDEX IF NOT EXISTS idx_pattern_library_category ON pattern_library(category);
CREATE INDEX IF NOT EXISTS idx_pattern_library_active ON pattern_library(active);

CREATE INDEX IF NOT EXISTS idx_coaching_rep_name ON coaching_recommendations(rep_name);
CREATE INDEX IF NOT EXISTS idx_coaching_acknowledged ON coaching_recommendations(acknowledged);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
ALTER TABLE call_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_recommendations ENABLE ROW LEVEL SECURITY;

-- Allow all access for now (update with auth later)
CREATE POLICY "Allow all" ON call_scores FOR ALL USING (true);
CREATE POLICY "Allow all" ON learning_queue FOR ALL USING (true);
CREATE POLICY "Allow all" ON pattern_library FOR ALL USING (true);
CREATE POLICY "Allow all" ON coaching_recommendations FOR ALL USING (true);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_call_scores_updated_at
  BEFORE UPDATE ON call_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_reps_updated_at
  BEFORE UPDATE ON reps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_pattern_library_updated_at
  BEFORE UPDATE ON pattern_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update rep aggregates when call_score is inserted
CREATE OR REPLACE FUNCTION update_rep_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO reps (name, avg_score, total_calls, close_rate, last_call_at)
  SELECT 
    NEW.rep_name,
    (SELECT AVG(score_total)::int FROM call_scores WHERE rep_name = NEW.rep_name AND status = 'completed'),
    (SELECT COUNT(*) FROM call_scores WHERE rep_name = NEW.rep_name AND status = 'completed'),
    (SELECT 
      (COUNT(*) FILTER (WHERE close_outcome IN ('closed', 'follow_up')) * 100 / NULLIF(COUNT(*), 0))::int
      FROM call_scores WHERE rep_name = NEW.rep_name AND status = 'completed'
    ),
    NOW()
  ON CONFLICT (name) DO UPDATE SET
    avg_score = EXCLUDED.avg_score,
    total_calls = EXCLUDED.total_calls,
    close_rate = EXCLUDED.close_rate,
    last_call_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rep_stats
  AFTER INSERT ON call_scores
  FOR EACH ROW EXECUTE FUNCTION update_rep_stats();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample patterns
INSERT INTO pattern_library (category, subcategory, title, pattern_text, example_usage, is_benchmark) VALUES
('value_stacking', 'roi', 'One Flight Pays', 'One business class flight pays for the entire program', 'ROI reframing example', true),
('objection_handling', 'pricing', 'Never Discount', 'I promise you, we never discount. It''s unfair on other members.', 'Price integrity handling', true),
('urgency_creation', 'price_increase', 'Lock Price Now', 'Price goes up to £4,000 next week. Lock in £3,000 now.', 'Price increase urgency', true),
('closing_phrases', 'deposit', 'Get on System', 'Just to get you on the system. The money''s not about the money.', 'Deposit close psychology', true),
('value_stacking', 'software', 'Lifetime Access', 'You get lifetime access. Normally people pay £49.99 a month.', 'Software value stacking', false)
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS (For common queries)
-- ============================================

-- Rep leaderboard view
CREATE OR REPLACE VIEW rep_leaderboard AS
SELECT 
  r.name,
  r.avg_score,
  r.total_calls,
  r.close_rate,
  (SELECT COUNT(*) FROM call_scores cs WHERE cs.rep_name = r.name AND cs.close_type = 'full') as full_closes,
  (SELECT COUNT(*) FROM call_scores cs WHERE cs.rep_name = r.name AND cs.close_type = 'payment_plan') as payment_plans,
  r.last_call_at
FROM reps r
WHERE r.active = true
ORDER BY r.avg_score DESC;

-- Recent calls with scores view
CREATE OR REPLACE VIEW recent_calls_analysis AS
SELECT 
  cs.call_id,
  c.title as call_title,
  cs.rep_name,
  cs.close_type,
  cs.close_outcome,
  cs.score_total,
  cs.score_grade,
  cs.value_stacking_score,
  cs.urgency_score,
  cs.created_at
FROM call_scores cs
JOIN calls c ON cs.call_id = c.id
ORDER BY cs.created_at DESC
LIMIT 50;

-- ============================================
-- END OF SCHEMA
-- ============================================
