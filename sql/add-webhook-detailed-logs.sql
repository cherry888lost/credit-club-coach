-- Add detailed webhook logs table for live diagnostics

create table if not exists public.webhook_logs_detailed (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  request_id text not null,
  source text not null,
  event_type text not null,
  status text not null check (status in ('success', 'error', 'pending')),
  trace_data jsonb default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists webhook_logs_detailed_org_id_idx on public.webhook_logs_detailed (org_id);
create index if not exists webhook_logs_detailed_created_at_idx on public.webhook_logs_detailed (created_at desc);
create index if not exists webhook_logs_detailed_request_id_idx on public.webhook_logs_detailed (request_id);

-- Enable RLS
alter table public.webhook_logs_detailed enable row level security;

drop policy if exists "Allow authenticated read detailed" on public.webhook_logs_detailed;
drop policy if exists "Allow service insert detailed" on public.webhook_logs_detailed;

create policy "Allow authenticated read detailed" on public.webhook_logs_detailed
  for select to authenticated using (true);

create policy "Allow service insert detailed" on public.webhook_logs_detailed
  for insert to authenticated with check (true);

-- Verify the table was created
select column_name, data_type 
from information_schema.columns 
where table_name = 'webhook_logs_detailed'
order by ordinal_position;
