-- Add storage for Credit Club scoring rubric v2 detailed output.
-- Existing legacy scoring fields remain populated for dashboard compatibility.

ALTER TABLE public.call_scores
  ADD COLUMN IF NOT EXISTS rubric_v2 JSONB DEFAULT NULL;

ALTER TABLE public.call_scores
  ADD COLUMN IF NOT EXISTS rubric_version TEXT DEFAULT NULL;

COMMENT ON COLUMN public.call_scores.rubric_v2 IS 'Detailed Credit Club scoring rubric v2 JSON output, including deterministic category scoring, deal outcome, evidence, coaching, and compliance flags.';
COMMENT ON COLUMN public.call_scores.rubric_version IS 'Scoring rubric version used to generate the detailed rubric output.';
