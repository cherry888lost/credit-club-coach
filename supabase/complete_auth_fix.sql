-- COMPREHENSIVE AUTH SCHEMA FIX
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. FIX REPS TABLE
-- ============================================

-- Add all missing columns
ALTER TABLE reps 
ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS fathom_email TEXT,
ADD COLUMN IF NOT EXISTS sales_role TEXT CHECK (sales_role IN ('closer', 'sdr')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate active boolean to status text
UPDATE reps SET status = CASE WHEN active = true THEN 'active' ELSE 'inactive' END WHERE status IS NULL;

-- Set org_id for existing reps
UPDATE reps SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- Set sales_role default based on role
UPDATE reps SET sales_role = CASE 
  WHEN role IN ('closer', 'admin') THEN 'closer'
  WHEN role = 'sdr' THEN 'sdr'
  ELSE 'closer'
END WHERE sales_role IS NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reps_clerk_user_id ON reps(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_reps_org_id ON reps(org_id);
CREATE INDEX IF NOT EXISTS idx_reps_email ON reps(email);

-- ============================================
-- 2. FIX CALLS TABLE (if org_id missing)
-- ============================================

ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update existing calls to have org_id
UPDATE calls SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_calls_org_id ON calls(org_id);
CREATE INDEX IF NOT EXISTS idx_calls_rep_id ON calls(rep_id);
CREATE INDEX IF NOT EXISTS idx_calls_deleted_at ON calls(deleted_at);

-- ============================================
-- 3. FIX CALL_SCORES TABLE (if org_id needed)
-- ============================================

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE call_scores SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_call_scores_org_id ON call_scores(org_id);

-- ============================================
-- 4. FIX LEARNING_QUEUE TABLE
-- ============================================

ALTER TABLE learning_queue 
ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE learning_queue SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_learning_queue_org_id ON learning_queue(org_id);

-- ============================================
-- 5. FIX PATTERN_LIBRARY TABLE
-- ============================================

ALTER TABLE pattern_library 
ADD COLUMN IF NOT EXISTS org_id UUID DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE pattern_library SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- ============================================
-- 6. ADD OVERALL_SCORE AND GRADE MIRRORS
-- ============================================

ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS overall_score INTEGER,
ADD COLUMN IF NOT EXISTS grade TEXT;

UPDATE call_scores SET overall_score = score_total, grade = score_grade;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'reps columns' as check_type, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reps' 
ORDER BY ordinal_position;
