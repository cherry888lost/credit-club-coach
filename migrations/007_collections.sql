-- Migration: Native Credit Club Collections tracker
-- Run in Supabase SQL Editor only after approval.
-- Corrected ownership model: one owner_user_id per collection record.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  legacy_google_sheet_id TEXT UNIQUE,

  client_name TEXT NOT NULL,
  telegram TEXT,
  phone_number TEXT,

  owner_user_id UUID REFERENCES public.reps(id) ON DELETE SET NULL,
  owner_name TEXT,
  owner_role TEXT,

  total_sale_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(total_sale_value - amount_paid, 0)) STORED,

  collection_type TEXT NOT NULL DEFAULT 'Deposit then balance',
  sale_date DATE,
  balance_due_date DATE,
  next_follow_up_date DATE,

  risk TEXT NOT NULL DEFAULT 'Medium' CHECK (risk IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Due Soon', 'Overdue', 'Collected', 'Failed Payment', 'Refund Risk', 'Cancelled')),
  payment_link TEXT,
  notes TEXT,

  source TEXT NOT NULL DEFAULT 'native' CHECK (source IN ('native', 'google_sheet_import', 'backup_import')),

  created_by UUID REFERENCES public.reps(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.reps(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_org_id ON public.collections(org_id);
CREATE INDEX IF NOT EXISTS idx_collections_owner_user_id ON public.collections(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_collections_status ON public.collections(status);
CREATE INDEX IF NOT EXISTS idx_collections_balance_due_date ON public.collections(balance_due_date);
CREATE INDEX IF NOT EXISTS idx_collections_next_follow_up_date ON public.collections(next_follow_up_date);
CREATE INDEX IF NOT EXISTS idx_collections_updated_at ON public.collections(updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_collections_updated_at ON public.collections;
CREATE TRIGGER trg_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_collections_updated_at();

COMMENT ON TABLE public.collections IS 'Native Credit Club collections tracker records migrated from the previous Google Sheets tracker.';
COMMENT ON COLUMN public.collections.owner_user_id IS 'Single assigned owner for the collection record. Owner can be a closer, SDR, setter, or recovery user.';
COMMENT ON COLUMN public.collections.legacy_google_sheet_id IS 'Original row ID from the Google-hosted Collections tracker, kept for audit/import idempotency.';
