-- Migration: Add missing columns for richer call detail display
-- Run this in Supabase SQL Editor

-- Add columns for Fathom media URLs
alter table public.calls add column if not exists share_url text;
alter table public.calls add column if not exists embed_url text;
alter table public.calls add column if not exists thumbnail_url text;

-- Add columns for Fathom content (if not already added)
alter table public.calls add column if not exists highlights jsonb;
alter table public.calls add column if not exists action_items jsonb;
alter table public.calls add column if not exists speakers jsonb;

-- Add column for Fathom processing status
alter table public.calls add column if not exists fathom_status text default 'pending';

-- Create indexes for new columns
create index if not exists calls_fathom_status_idx on public.calls (fathom_status);
create index if not exists calls_share_url_idx on public.calls (share_url);

-- Verify columns
select column_name, data_type 
from information_schema.columns 
where table_name = 'calls'
order by ordinal_position;
