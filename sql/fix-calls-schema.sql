-- PRODUCTION-SAFE SQL: Add all missing columns to calls table
-- Run this in Supabase SQL Editor

-- Add duration_seconds column (converting from minutes if needed)
alter table public.calls 
add column if not exists duration_seconds integer;

-- Add summary column
alter table public.calls 
add column if not exists summary text;

-- Add highlights column (JSONB for flexibility)
alter table public.calls 
add column if not exists highlights jsonb;

-- Add action_items column (JSONB for flexibility)  
alter table public.calls 
add column if not exists action_items jsonb;

-- Add video_url column
alter table public.calls 
add column if not exists video_url text;

-- Add host_email column
alter table public.calls 
add column if not exists host_email text;

-- Add participants column (array of strings)
alter table public.calls 
add column if not exists participants text[];

-- Add speakers column (JSONB for speaker data)
alter table public.calls 
add column if not exists speakers jsonb;

-- Add source column with default
alter table public.calls 
add column if not exists source text default 'fathom';

-- Create indexes for common queries
create index if not exists calls_host_email_idx on public.calls (host_email);
create index if not exists calls_source_idx on public.calls (source);
create index if not exists calls_fathom_call_id_idx on public.calls (fathom_call_id);

-- Verify columns were added
select column_name, data_type, is_nullable
from information_schema.columns 
where table_name = 'calls'
order by ordinal_position;
