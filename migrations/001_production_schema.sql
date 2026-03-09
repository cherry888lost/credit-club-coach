-- Migration: Update schema for production Credit Club Coach
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Update reps table
-- ============================================

-- Add fathom_email column if not exists
ALTER TABLE reps 
ADD COLUMN IF NOT EXISTS fathom_email TEXT;

-- Add updated_at column if not exists
ALTER TABLE reps 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Make clerk_user_id nullable (for admin-created members before they log in)
ALTER TABLE reps 
ALTER COLUMN clerk_user_id DROP NOT NULL;

-- Update role check constraint
ALTER TABLE reps 
DROP CONSTRAINT IF EXISTS reps_role_check;

ALTER TABLE reps 
ADD CONSTRAINT reps_role_check 
CHECK (role IN ('admin', 'closer', 'sdr'));

-- Update status check constraint
ALTER TABLE reps 
DROP CONSTRAINT IF EXISTS reps_status_check;

ALTER TABLE reps 
ADD CONSTRAINT reps_status_check 
CHECK (status IN ('active', 'inactive'));

-- Create index on fathom_email for faster lookups
CREATE INDEX IF NOT EXISTS idx_reps_fathom_email ON reps(fathom_email);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_reps_email ON reps(email);

-- ============================================
-- PART 2: Update calls table
-- ============================================

-- Add new columns for richer Fathom data
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS summary TEXT;

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS host_email TEXT;

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS participants TEXT[];

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'fathom';

-- Add check constraint for source
ALTER TABLE calls 
ADD CONSTRAINT calls_source_check 
CHECK (source IN ('fathom', 'demo', 'manual'));

-- Create index on host_email for rep matching
CREATE INDEX IF NOT EXISTS idx_calls_host_email ON calls(host_email);

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_calls_source ON calls(source);

-- ============================================
-- PART 3: Update call_scores table for role-based rubrics
-- ============================================

-- Add rubric_type column
ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS rubric_type TEXT DEFAULT 'generic';

ALTER TABLE call_scores 
ADD CONSTRAINT call_scores_rubric_type_check 
CHECK (rubric_type IN ('closer', 'sdr', 'generic'));

-- Add overall_score column
ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS overall_score DECIMAL(3,1);

-- Add closer-specific columns
ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS credit_expertise_score INTEGER;

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS value_explanation_score INTEGER;

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS close_attempt_score INTEGER;

-- Add SDR-specific columns
ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS qualification_score INTEGER;

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS curiosity_probing_score INTEGER;

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS agenda_control_score INTEGER;

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS booking_quality_score INTEGER;

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS urgency_score INTEGER;

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS communication_clarity_score INTEGER;

-- Create index on rubric_type
CREATE INDEX IF NOT EXISTS idx_call_scores_rubric_type ON call_scores(rubric_type);

-- ============================================
-- PART 4: Create webhook logs table
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  status TEXT CHECK (status IN ('success', 'error', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_org_id ON webhook_logs(org_id);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- ============================================
-- PART 5: Seed initial team members (as inactive placeholders)
-- ============================================

-- Insert placeholder reps for the team (admin can activate and set emails later)
INSERT INTO reps (org_id, email, fathom_email, name, role, status, clerk_user_id, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'papur@creditclub.com', NULL, 'Papur', 'closer', 'active', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'john@creditclub.com', NULL, 'John', 'closer', 'active', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'adan@creditclub.com', NULL, 'Adan', 'closer', 'active', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'callum@creditclub.com', NULL, 'Callum', 'closer', 'active', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'yuvraj@creditclub.com', NULL, 'Yuvraj', 'sdr', 'active', NULL, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000001', 'kayode@creditclub.com', NULL, 'Kayode', 'sdr', 'active', NULL, NOW(), NOW())
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  updated_at = NOW();

-- ============================================
-- PART 6: Verify changes
-- ============================================

SELECT 'Reps table updated' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reps' 
ORDER BY ordinal_position;

SELECT 'Calls table updated' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'calls' 
ORDER BY ordinal_position;

SELECT 'Team members seeded' as status;
SELECT name, email, role, status FROM reps WHERE org_id = '00000000-0000-0000-0000-000000000001';
