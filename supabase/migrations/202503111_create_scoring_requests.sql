-- Migration: Create scoring_requests table for Cherry queue processing
-- This decouples score generation from the Vercel route (which was calling OpenAI directly)
-- Now the route inserts a pending request, and Cherry picks it up asynchronously.

CREATE TABLE IF NOT EXISTS scoring_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  transcript text NOT NULL,
  call_title text,
  rep_name text,
  call_date timestamptz,
  duration_seconds integer,
  result jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Only one active (pending/processing) request per call at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_scoring_requests_call_active
  ON scoring_requests(call_id) WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_scoring_requests_status ON scoring_requests(status);
CREATE INDEX IF NOT EXISTS idx_scoring_requests_call_id ON scoring_requests(call_id);

-- RLS
ALTER TABLE scoring_requests ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Cherry worker uses service key)
CREATE POLICY "scoring_requests_service_all" ON scoring_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read (for polling status)
CREATE POLICY "scoring_requests_read_authenticated" ON scoring_requests
  FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert (for creating requests from the UI)
CREATE POLICY "scoring_requests_insert_authenticated" ON scoring_requests
  FOR INSERT TO authenticated WITH CHECK (true);
