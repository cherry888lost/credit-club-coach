-- Soft delete column for calls table
-- This migration adds soft delete functionality to the calls table

-- Add deleted_at timestamp column
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for performance on non-deleted calls
-- Partial index: only includes rows where deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_calls_deleted_at 
ON calls(deleted_at) 
WHERE deleted_at IS NULL;

-- Add comment explaining the column
COMMENT ON COLUMN calls.deleted_at IS 'Soft delete timestamp. NULL = not deleted, timestamp = deleted at that time.';

-- Optional: Create a view for active (non-deleted) calls
-- This can be used instead of .is("deleted_at", null) in some cases
CREATE OR REPLACE VIEW active_calls AS
SELECT * FROM calls WHERE deleted_at IS NULL;

-- Optional: Create function to soft delete a call
CREATE OR REPLACE FUNCTION soft_delete_call(call_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE calls 
    SET deleted_at = NOW() 
    WHERE id = call_uuid 
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create function to restore a soft-deleted call
CREATE OR REPLACE FUNCTION restore_deleted_call(call_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE calls 
    SET deleted_at = NULL 
    WHERE id = call_uuid 
    AND deleted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
