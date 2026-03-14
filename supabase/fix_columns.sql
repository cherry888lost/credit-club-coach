-- Fix column names to match UI expectations
-- Run this in Supabase SQL Editor

-- Add overall_score column (mirror of score_total)
ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS overall_score INTEGER;

-- Add grade column (mirror of score_grade)
ALTER TABLE call_scores 
ADD COLUMN IF NOT EXISTS grade TEXT;

-- Copy data from new columns to old columns for UI compatibility
UPDATE call_scores 
SET overall_score = score_total,
    grade = score_grade;

-- Verify the update
SELECT id, score_total, overall_score, score_grade, grade 
FROM call_scores 
LIMIT 5;
