-- Migration: Invite-Only Team System
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- PART 1: Update reps table for invite system
-- ============================================

-- Drop old status constraint and update to support invite statuses
ALTER TABLE reps DROP CONSTRAINT IF EXISTS reps_status_check;

-- Update existing 'inactive' to 'disabled' for consistency
UPDATE reps SET status = 'disabled' WHERE status = 'inactive';

-- Add new status constraint: invited | active | disabled
ALTER TABLE reps 
ADD CONSTRAINT reps_status_check 
CHECK (status IN ('invited', 'active', 'disabled'));

-- Add invite-related columns
ALTER TABLE reps ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE reps ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE reps ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES reps(id) ON DELETE SET NULL;
ALTER TABLE reps ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE reps ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Unique constraint on invite_token (only non-null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reps_invite_token ON reps(invite_token) WHERE invite_token IS NOT NULL;

-- Unique constraint on clerk_user_id (only non-null)  
DROP INDEX IF EXISTS idx_reps_clerk_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reps_clerk_user_id_unique ON reps(clerk_user_id) WHERE clerk_user_id IS NOT NULL;

-- Case-insensitive unique email constraint
DROP INDEX IF EXISTS idx_reps_email_unique_ci;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reps_email_unique_ci ON reps(LOWER(email));

-- Set all existing reps to 'active' and record accepted_at
UPDATE reps SET status = 'active', accepted_at = COALESCE(accepted_at, created_at) WHERE status NOT IN ('disabled');

-- ============================================
-- PART 2: Create invite_history table
-- ============================================

CREATE TABLE IF NOT EXISTS invite_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES reps(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES reps(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_invite_history_rep_id ON invite_history(rep_id);

-- ============================================
-- PART 3: Drop old role constraint, update to new roles
-- ============================================

-- The existing role constraint may be: admin | closer | sdr
-- We want: admin | member (with sales_role handling closer/sdr separately)
-- Only update if the constraint exists
ALTER TABLE reps DROP CONSTRAINT IF EXISTS reps_role_check;
ALTER TABLE reps ADD CONSTRAINT reps_role_check CHECK (role IN ('admin', 'member'));

-- Migrate any 'closer' or 'sdr' role values to 'member' (sales_role already tracks this)
UPDATE reps SET role = 'member' WHERE role NOT IN ('admin', 'member');
