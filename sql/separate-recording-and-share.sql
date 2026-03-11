-- Migration: Separate recording_id from share_token/share_url
-- recording_id = numeric internal Fathom ID (for API)
-- share_url = full public URL
-- share_token = token from /share/{token}

-- Add share_token column
alter table public.calls add column if not exists share_token text;

-- Create index for share lookups
create index if not exists calls_share_token_idx on public.calls (share_token);

-- For existing calls, try to extract share_token from various fields
-- This is a one-time data migration

-- If share_url exists and contains /share/, extract token
update public.calls
set share_token = substring(share_url from '/share/([^/?]+)')
where share_url like '%/share/%' and share_token is null;

-- If recording_id looks like a share token (not numeric), move it
-- First, identify calls where recording_id is NOT numeric
with non_numeric_ids as (
  select id, fathom_call_id
  from public.calls
  where fathom_call_id ~ '[^0-9]'
    and fathom_call_id is not null
)
-- Copy to share_token
update public.calls c
set share_token = c.fathom_call_id,
    fathom_call_id = null
from non_numeric_ids n
where c.id = n.id;

-- Verify the changes
select 
  count(*) as total_calls,
  count(fathom_call_id) as has_recording_id,
  count(share_url) as has_share_url,
  count(share_token) as has_share_token
from public.calls;

-- Show any problematic records
select id, title, fathom_call_id, share_url, share_token
from public.calls
where fathom_call_id ~ '[^0-9]'
   or (fathom_call_id is null and share_token is null);
