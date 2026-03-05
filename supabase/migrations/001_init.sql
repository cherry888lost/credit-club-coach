-- Credit Club Coach - Initial Schema
-- Migration: 001_init

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE organizations IS 'Top-level tenant for multi-tenancy';

-- ============================================
-- REPS (Users/Members)
-- ============================================
CREATE TYPE rep_role AS ENUM ('admin', 'manager', 'closer', 'sdr');
CREATE TYPE rep_status AS ENUM ('active', 'inactive', 'pending');

CREATE TABLE reps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role rep_role DEFAULT 'closer',
  status rep_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reps IS 'Sales reps/closers/SDRs linked to Clerk auth';

-- ============================================
-- CALLS
-- ============================================
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rep_id UUID REFERENCES reps(id) ON DELETE SET NULL,
  fathom_call_id TEXT UNIQUE,
  title TEXT,
  occurred_at TIMESTAMPTZ,
  transcript TEXT,
  recording_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE calls IS 'Call recordings ingested from Fathom';

-- ============================================
-- CALL SCORES (AI Analysis Results)
-- ============================================
CREATE TABLE call_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE UNIQUE,
  
  -- Score dimensions (1-10 scale)
  opening_score INT CHECK (opening_score BETWEEN 1 AND 10),
  discovery_score INT CHECK (discovery_score BETWEEN 1 AND 10),
  rapport_score INT CHECK (rapport_score BETWEEN 1 AND 10),
  objection_handling_score INT CHECK (objection_handling_score BETWEEN 1 AND 10),
  closing_score INT CHECK (closing_score BETWEEN 1 AND 10),
  structure_score INT CHECK (structure_score BETWEEN 1 AND 10),
  product_knowledge_score INT CHECK (product_knowledge_score BETWEEN 1 AND 10),
  
  -- AI Analysis
  ai_summary TEXT,
  ai_summary_short TEXT,
  strengths JSONB DEFAULT '[]',
  improvements JSONB DEFAULT '[]',
  coaching_recommendation TEXT,
  example_phrase TEXT,
  tone_analysis JSONB DEFAULT '{}',
  product_concepts_mentioned JSONB DEFAULT '[]',
  
  scored_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE call_scores IS 'AI-generated call analysis and scoring';

-- ============================================
-- FLAGS (Manual Review Flags)
-- ============================================
CREATE TABLE flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- e.g., 'review', 'quality_issue', 'excellent'
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE flags IS 'Manual flags for calls needing review or recognition';

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_reps_org_id ON reps(org_id);
CREATE INDEX idx_reps_clerk_user_id ON reps(clerk_user_id);
CREATE INDEX idx_calls_org_id ON calls(org_id);
CREATE INDEX idx_calls_rep_id ON calls(rep_id);
CREATE INDEX idx_calls_fathom_id ON calls(fathom_call_id);
CREATE INDEX idx_calls_occurred_at ON calls(occurred_at);
CREATE INDEX idx_call_scores_call_id ON call_scores(call_id);
CREATE INDEX idx_flags_org_id ON flags(org_id);
CREATE INDEX idx_flags_call_id ON flags(call_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE flags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MVP POLICIES (Authenticated users only)
-- ============================================

-- Organizations: Authenticated users can read all (will tighten later)
CREATE POLICY "org_read_authenticated" ON organizations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "org_insert_authenticated" ON organizations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "org_update_authenticated" ON organizations
  FOR UPDATE TO authenticated USING (true);

-- Reps: Authenticated users can access
CREATE POLICY "reps_read_authenticated" ON reps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reps_insert_authenticated" ON reps
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "reps_update_authenticated" ON reps
  FOR UPDATE TO authenticated USING (true);

-- Calls: Authenticated users can access
CREATE POLICY "calls_read_authenticated" ON calls
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "calls_insert_authenticated" ON calls
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "calls_update_authenticated" ON calls
  FOR UPDATE TO authenticated USING (true);

-- Call Scores: Authenticated users can access
CREATE POLICY "call_scores_read_authenticated" ON call_scores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "call_scores_insert_authenticated" ON call_scores
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "call_scores_update_authenticated" ON call_scores
  FOR UPDATE TO authenticated USING (true);

-- Flags: Authenticated users can access
CREATE POLICY "flags_read_authenticated" ON flags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "flags_insert_authenticated" ON flags
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "flags_update_authenticated" ON flags
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "flags_delete_authenticated" ON flags
  FOR DELETE TO authenticated USING (true);
