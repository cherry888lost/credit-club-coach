-- Add coach_summary JSONB column to call_scores
-- Stores { did_well: string[], needs_work: string[], action_items: string[] }
ALTER TABLE call_scores ADD COLUMN IF NOT EXISTS coach_summary JSONB DEFAULT '{}'::jsonb;

-- Comment
COMMENT ON COLUMN call_scores.coach_summary IS 'AI-generated coach summary with did_well, needs_work, and action_items arrays';
