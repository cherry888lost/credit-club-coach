-- Migration: Require collection records to have an owner
-- Run after migrations/007_collections.sql and after confirming existing rows have owner_user_id populated.

ALTER TABLE public.collections
  ALTER COLUMN owner_user_id SET NOT NULL;

COMMENT ON COLUMN public.collections.owner_user_id IS 'Required single assigned owner for the collection record. Owner can be a closer, SDR, setter, or recovery user.';
