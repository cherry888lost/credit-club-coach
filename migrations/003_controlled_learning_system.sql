-- Migration 003: Controlled Learning Call Analysis System
-- Date: 2026-03-12
-- 5 Parts: Master Rubric, Winning Call Library, Controlled Learning Queue,
--          Objection Intelligence Layer, Weekly Manager Output

-- ============================================
-- PART 1: MASTER RUBRIC (persistent, versioned)
-- ============================================

CREATE TABLE IF NOT EXISTS master_rubric (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- The rubric definition as structured JSON
  -- Each category has: name, weight, description, score_anchors (0-2, 3-4, 5-6, 7-8, 9-10),
  -- credit_club_specific_guidance, red_flags, green_flags
  categories JSONB NOT NULL,

  -- Rubric-level config
  quality_thresholds JSONB NOT NULL DEFAULT '{
    "poor": {"min": 0, "max": 40},
    "average": {"min": 41, "max": 60},
    "strong": {"min": 61, "max": 80},
    "elite": {"min": 81, "max": 100}
  }'::jsonb,

  -- Disqualification logic
  disqualification_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [
  --   { "rule": "prospect_has_no_credit_issues", "description": "...", "auto_disqualify": true },
  --   { "rule": "prospect_under_18", "description": "...", "auto_disqualify": true },
  --   { "rule": "prospect_in_bankruptcy", "description": "...", "auto_disqualify": false, "flag_for_review": true }
  -- ]

  -- What makes a call "low-signal" (excluded from benchmark learning)
  low_signal_criteria JSONB NOT NULL DEFAULT '{
    "min_transcript_length": 500,
    "min_call_duration_seconds": 120,
    "exclude_outcomes": ["disqualified"],
    "min_discovery_score": 2,
    "max_categories_at_zero": 3
  }'::jsonb,

  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active rubric per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_rubric_active
  ON master_rubric(org_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_master_rubric_org ON master_rubric(org_id);

-- ============================================
-- PART 2: WINNING CALL LIBRARY (benchmark calls)
-- ============================================

-- Enhance the existing winning_call_patterns table or create benchmark_calls
CREATE TABLE IF NOT EXISTS benchmark_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  score_id UUID REFERENCES call_scores(id) ON DELETE SET NULL,

  -- Core fields
  transcript TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('closed', 'follow_up', 'no_sale')),
  close_type TEXT CHECK (close_type IS NULL OR close_type IN ('full_close', 'deposit', 'payment_plan', 'partial_access')),
  rep_name TEXT,
  call_date TIMESTAMPTZ,

  -- Quality assessment (independent of outcome)
  quality_rating TEXT NOT NULL CHECK (quality_rating IN ('poor', 'average', 'strong', 'elite')),
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Why this call is in the library
  why_this_is_good TEXT NOT NULL,
  strongest_moments JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ "timestamp_hint": "early", "category": "pain_amplification", "quote": "...", "why_strong": "..." }]

  -- Objection examples from this call
  objection_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ "objection": "price", "prospect_said": "...", "rep_response": "...", "technique": "...", "effectiveness": "strong" }]

  -- Lines worth modeling
  key_lines_to_model JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ "line": "exact quote", "context": "why this line works", "category": "rapport_tone" }]

  -- Tags for filtering
  tags TEXT[] DEFAULT '{}',
  -- e.g. ['strong_discovery', 'price_objection_handled', 'payment_plan_close', 'elite_rapport']

  -- Approval tracking
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'promoted_from_queue')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_calls_org ON benchmark_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_calls_quality ON benchmark_calls(quality_rating);
CREATE INDEX IF NOT EXISTS idx_benchmark_calls_outcome ON benchmark_calls(outcome);
CREATE INDEX IF NOT EXISTS idx_benchmark_calls_tags ON benchmark_calls USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_benchmark_calls_rep ON benchmark_calls(rep_name);

-- ============================================
-- PART 3: CONTROLLED LEARNING QUEUE
-- ============================================

CREATE TABLE IF NOT EXISTS learning_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Source
  source_call_id UUID REFERENCES calls(id) ON DELETE SET NULL,
  source_score_id UUID REFERENCES call_scores(id) ON DELETE SET NULL,
  source_rep_name TEXT,
  source_call_date TIMESTAMPTZ,

  -- Pattern details
  pattern_category TEXT NOT NULL CHECK (pattern_category IN (
    'discovery', 'pain_amplification', 'rapport_tone',
    'authority_confidence', 'offer_explanation', 'objection_handling',
    'urgency', 'close_attempt', 'follow_up_quality', 'disqualification_logic',
    'new_objection', 'new_technique', 'script_improvement', 'other'
  )),
  exact_quote TEXT NOT NULL,
  explanation TEXT NOT NULL,
  suggested_action TEXT, -- what to do with this pattern
  ai_confidence DECIMAL(3,2) CHECK (ai_confidence >= 0 AND ai_confidence <= 1),

  -- Review workflow
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review', 'approved', 'rejected', 'promoted'
  )),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- If promoted, link to where it went
  promoted_to_benchmark_id UUID REFERENCES benchmark_calls(id) ON DELETE SET NULL,
  promoted_to_objection_id UUID,  -- FK added after objection_library creation

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_queue_org ON learning_queue(org_id);
CREATE INDEX IF NOT EXISTS idx_learning_queue_status ON learning_queue(status);
CREATE INDEX IF NOT EXISTS idx_learning_queue_category ON learning_queue(pattern_category);
CREATE INDEX IF NOT EXISTS idx_learning_queue_pending ON learning_queue(org_id, status) WHERE status = 'pending_review';

-- ============================================
-- PART 4: OBJECTION INTELLIGENCE LAYER
-- ============================================

CREATE TABLE IF NOT EXISTS objection_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Objection identity
  label TEXT NOT NULL,  -- e.g. "price_too_high", "need_to_think", "spouse_approval"
  display_name TEXT NOT NULL,  -- e.g. "Price Too High", "Need to Think About It"
  category TEXT NOT NULL CHECK (category IN (
    'price', 'timing', 'trust', 'spouse_partner',
    'competitor', 'need_info', 'not_interested',
    'already_tried', 'skepticism', 'other'
  )),

  -- Raw prospect phrasings (collected over time)
  raw_phrasings JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: ["I can't afford that right now", "That's way too expensive", "Is there a cheaper option?"]

  -- Frequency tracking
  total_occurrences INTEGER NOT NULL DEFAULT 0,
  occurrences_last_30_days INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  trend TEXT CHECK (trend IS NULL OR trend IN ('rising', 'stable', 'declining')),

  -- Handling methods
  current_handling_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ "technique": "Feel-Felt-Found", "script": "I totally understand...", "effectiveness_rating": "strong" }]

  -- Response examples
  strong_response_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ "call_id": "uuid", "rep": "John", "quote": "...", "context": "...", "score_impact": 8 }]

  weak_response_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ "call_id": "uuid", "rep": "Callum", "quote": "...", "what_went_wrong": "..." }]

  -- Best call examples for this objection
  best_call_ids UUID[] DEFAULT '{}',

  -- Marketing / ad angle ideas
  ad_angle_ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ "angle": "Address price concern in ad copy", "hook": "Think £3k is expensive? Calculate what bad credit costs you...", "platform": "meta" }]

  -- Coaching notes
  coaching_notes TEXT,

  -- Approval
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_objection_library_label ON objection_library(org_id, label);
CREATE INDEX IF NOT EXISTS idx_objection_library_org ON objection_library(org_id);
CREATE INDEX IF NOT EXISTS idx_objection_library_category ON objection_library(category);
CREATE INDEX IF NOT EXISTS idx_objection_library_frequency ON objection_library(total_occurrences DESC);

-- Now add the FK from learning_queue to objection_library
-- (can't do this inline because objection_library didn't exist yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'learning_queue_promoted_to_objection_fk'
  ) THEN
    ALTER TABLE learning_queue
    ADD CONSTRAINT learning_queue_promoted_to_objection_fk
    FOREIGN KEY (promoted_to_objection_id) REFERENCES objection_library(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- PART 5: WEEKLY MANAGER OUTPUT
-- ============================================

CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Report period
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Generated content
  report_data JSONB NOT NULL,
  -- Structure:
  -- {
  --   "summary": "...",
  --   "period": { "start": "2026-03-06", "end": "2026-03-12" },
  --   "total_calls": 47,
  --   "total_scored": 42,
  --
  --   "common_objections": [
  --     { "label": "price_too_high", "count": 18, "trend": "rising", "best_handler": "John" }
  --   ],
  --
  --   "no_sale_reasons": [
  --     { "reason": "price", "count": 12, "percentage": 35 },
  --     { "reason": "timing", "count": 8, "percentage": 23 }
  --   ],
  --
  --   "coaching_gaps": [
  --     { "category": "pain_amplification", "avg_score": 4.2, "reps_below_5": ["Callum", "Kayode"], "recommendation": "..." }
  --   ],
  --
  --   "rep_performance": [
  --     {
  --       "rep": "John",
  --       "calls": 12,
  --       "avg_score": 72,
  --       "strengths": ["objection_handling", "rapport_tone"],
  --       "weaknesses": ["urgency_close_attempt"],
  --       "best_call_id": "uuid",
  --       "best_call_score": 85,
  --       "worst_call_id": "uuid",
  --       "worst_call_score": 42,
  --       "trend": "improving"
  --     }
  --   ],
  --
  --   "marketing_angles": [
  --     { "insight": "Price objection rising — 38% of no-sales cite cost", "suggested_angle": "ROI calculator ad", "priority": "high" }
  --   ],
  --
  --   "script_priorities": [
  --     { "priority": 1, "area": "price_reframe", "current_gap": "Reps drop price objection too fast", "suggestion": "..." }
  --   ],
  --
  --   "benchmark_candidates": [
  --     { "call_id": "uuid", "rep": "John", "score": 88, "reason": "Elite discovery + close" }
  --   ]
  -- }

  -- Generation metadata
  generated_by TEXT DEFAULT 'system',
  model_version TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_org ON weekly_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_period ON weekly_reports(org_id, week_start DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reports_unique_week ON weekly_reports(org_id, week_start);

-- ============================================
-- PART 6: RLS Policies
-- ============================================

ALTER TABLE master_rubric ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- Read policies (authenticated users can read their org's data)
CREATE POLICY "Authenticated read master_rubric" ON master_rubric
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read benchmark_calls" ON benchmark_calls
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read learning_queue" ON learning_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read objection_library" ON objection_library
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated read weekly_reports" ON weekly_reports
  FOR SELECT TO authenticated USING (true);

-- Insert/update policies (service role handles writes, but allow authenticated for admin actions)
CREATE POLICY "Authenticated write master_rubric" ON master_rubric
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated write benchmark_calls" ON benchmark_calls
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated write learning_queue" ON learning_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated write objection_library" ON objection_library
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated write weekly_reports" ON weekly_reports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- VERIFY
-- ============================================

SELECT 'Migration 003 complete — Controlled Learning System' as status;

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('master_rubric', 'benchmark_calls', 'learning_queue', 'objection_library', 'weekly_reports')
ORDER BY table_name;
