-- ============================================================================
-- Migration: Add all missing columns for /api/webhooks/fathom route
-- Run this in Supabase SQL Editor to fix Zapier/Fathom ingestion
-- ============================================================================

-- Core Fathom identifiers (CRITICAL for deduplication)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS fathom_call_id TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS share_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS share_token TEXT;

-- Host/Rep identification
ALTER TABLE calls ADD COLUMN IF NOT EXISTS host_email TEXT;

-- Source tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS fathom_event_type TEXT;

-- Content fields
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS action_items JSONB DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS speakers JSONB DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]';

-- Status tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT 'pending';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_status TEXT DEFAULT 'pending';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS score_status TEXT DEFAULT 'pending';

-- Source tracking for field ownership
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript_source TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_source TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS action_items_source TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS share_url_source TEXT;

-- Metadata tracking
ALTER TABLE calls ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS raw_webhook_meta JSONB DEFAULT '{}';

-- Media URLs
ALTER TABLE calls ADD COLUMN IF NOT EXISTS embed_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- ============================================================================
-- Indexes for efficient lookups (the route queries these columns)
-- ============================================================================

-- Critical for deduplication matching (MATCH STEP 1 & 2)
CREATE INDEX IF NOT EXISTS idx_calls_fathom_call_id ON calls(fathom_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_share_url ON calls(share_url);

-- For rep filtering and lookups
CREATE INDEX IF NOT EXISTS idx_calls_host_email ON calls(host_email);
CREATE INDEX IF NOT EXISTS idx_calls_source ON calls(source);

-- For admin dashboard filtering by status
CREATE INDEX IF NOT EXISTS idx_calls_transcript_status ON calls(transcript_status);
CREATE INDEX IF NOT EXISTS idx_calls_summary_status ON calls(summary_status);

-- ============================================================================
-- Comments explaining key fields
-- ============================================================================
COMMENT ON COLUMN calls.fathom_call_id IS 'Fathom unique call ID for deduplication (recording_id)';
COMMENT ON COLUMN calls.occurred_at IS 'When the call actually happened (same as call_date, for Zapier compatibility)';
COMMENT ON COLUMN calls.share_url IS 'Public share link from Fathom (primary matching key)';
COMMENT ON COLUMN calls.host_email IS 'Email of the call host for rep matching';
COMMENT ON COLUMN calls.source IS 'Data source: fathom_direct, zapier, or manual';
COMMENT ON COLUMN calls.transcript_status IS 'pending | ready | error - tracks if transcript received';
COMMENT ON COLUMN calls.summary_status IS 'pending | ready | error - tracks if summary received';
COMMENT ON COLUMN calls.score_status IS 'pending | processing | completed | error - tracks AI scoring';

-- ============================================================================
-- Verification query (run after migration to confirm)
-- ============================================================================
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'calls' 
-- ORDER BY ordinal_position;
