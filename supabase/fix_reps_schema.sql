-- Fix reps table schema to match TypeScript types and auth requirements
-- Run this in Supabase SQL Editor

-- Add missing columns to reps table
ALTER TABLE reps 
ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES calls(id) DEFAULT '00000000-0000-0000-0000-000000000001',
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS fathom_email TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate existing data: set active boolean to status text
UPDATE reps SET status = CASE WHEN active = true THEN 'active' ELSE 'inactive' END WHERE status IS NULL;

-- Set org_id for existing reps
UPDATE reps SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

-- Add index for clerk_user_id lookups (critical for auth performance)
CREATE INDEX IF NOT EXISTS idx_reps_clerk_user_id ON reps(clerk_user_id);

-- Add index for org_id lookups
CREATE INDEX IF NOT EXISTS idx_reps_org_id ON reps(org_id);

-- Verify the schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'reps' 
ORDER BY ordinal_position;
