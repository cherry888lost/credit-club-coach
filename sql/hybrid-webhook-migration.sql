-- Migration: Add hybrid webhook support columns
-- Safe to run multiple times (IF NOT EXISTS)

-- Field ownership tracking
ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS share_url_source TEXT,
ADD COLUMN IF NOT EXISTS transcript_source TEXT,
ADD COLUMN IF NOT EXISTS summary_source TEXT,
ADD COLUMN IF NOT EXISTS action_items_source TEXT;

-- Status tracking
ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS transcript_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS summary_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS score_status TEXT DEFAULT 'pending';

-- Event tracking
ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS fathom_event_type TEXT,
ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP WITH TIME ZONE;

-- Metadata storage
ALTER TABLE public.calls 
ADD COLUMN IF NOT EXISTS raw_webhook_meta JSONB;

-- Add comment explaining the hybrid architecture
COMMENT ON TABLE public.calls IS 'Sales calls from Fathom. Hybrid ingestion: Zapier creates with share_url, direct Fathom webhooks update with transcript/summary.';

COMMENT ON COLUMN public.calls.transcript_status IS 'pending | ready | failed';
COMMENT ON COLUMN public.calls.summary_status IS 'pending | ready | failed';
COMMENT ON COLUMN public.calls.score_status IS 'pending | completed | failed';
COMMENT ON COLUMN public.calls.share_url_source IS 'zapier | fathom_direct | api_fallback';
COMMENT ON COLUMN public.calls.transcript_source IS 'fathom_direct | api_fallback | manual';
COMMENT ON COLUMN public.calls.summary_source IS 'fathom_direct | api_fallback | manual';
