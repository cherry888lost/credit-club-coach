-- ============================================
-- PRODUCTION CLEANUP & SETUP SQL
-- Run this in Supabase SQL Editor after deployment
-- ============================================

-- ============================================
-- STEP 1: IDENTIFY DEMO/TEST USERS TO CLEAN UP
-- ============================================
-- These will be marked inactive (review before deleting)

-- View current reps
select id, name, email, role, status, fathom_email, created_at
from public.reps
order by created_at desc;

-- Mark demo/test users as inactive (run after reviewing)
-- update public.reps 
-- set status = 'inactive', updated_at = now()
-- where email like '%test%' 
--    or email like '%demo%'
--    or email like '%cherry%'
--    or name like '%Test%'
--    or name like '%Demo%'
--    and id != 'YOUR_ADMIN_ID'; -- Keep your admin account

-- ============================================
-- STEP 2: ADD fathom_email COLUMN IF MISSING
-- ============================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'reps' and column_name = 'fathom_email'
  ) then
    alter table public.reps add column fathom_email text;
    create index if not exists reps_fathom_email_idx on public.reps (fathom_email);
  end if;
end $$;

-- ============================================
-- STEP 3: INSERT REAL TEAM MEMBERS
-- ============================================
-- Replace 'PAPUR_CLERK_USER_ID' with actual Clerk user ID from Clerk Dashboard
-- Other members can have NULL clerk_user_id until they first login

-- First, ensure Papur is set up as admin+closer
-- Note: We use 'admin' role but can track closer status via secondary role or in metadata

insert into public.reps (org_id, name, email, fathom_email, role, status, clerk_user_id, created_at)
values 
  -- Papur (Admin + Closer hybrid) - Update clerk_user_id after checking Clerk Dashboard
  ('00000000-0000-0000-0000-000000000001', 'Papur', 'papur@creditclub.com', 'papur@creditclub.com', 'admin', 'active', 'PAPUR_CLERK_USER_ID', now()),
  
  -- Closers
  ('00000000-0000-0000-0000-000000000001', 'John', 'john@creditclub.com', 'john@creditclub.com', 'closer', 'active', null, now()),
  ('00000000-0000-0000-0000-000000000001', 'Adan', 'adan@creditclub.com', 'adan@creditclub.com', 'closer', 'active', null, now()),
  ('00000000-0000-0000-0000-000000000001', 'Callum', 'callum@creditclub.com', 'callum@creditclub.com', 'closer', 'active', null, now()),
  
  -- SDRs
  ('00000000-0000-0000-0000-000000000001', 'Yuvraj', 'yuvraj@creditclub.com', 'yuvraj@creditclub.com', 'sdr', 'active', null, now()),
  ('00000000-0000-0000-0000-000000000001', 'Kayode', 'kayode@creditclub.com', 'kayode@creditclub.com', 'sdr', 'active', null, now())

on conflict (email) do update set
  name = excluded.name,
  fathom_email = excluded.fathom_email,
  role = excluded.role,
  status = excluded.status,
  updated_at = now();

-- ============================================
-- STEP 4: CREATE WEBHOOK LOGS TABLE FOR DIAGNOSTICS
-- ============================================
create table if not exists public.webhook_logs (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null default '00000000-0000-0000-0000-000000000001',
  source text not null,
  event_type text not null,
  payload jsonb default '{}',
  status text not null check (status in ('success', 'error', 'pending')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists webhook_logs_org_id_idx on public.webhook_logs (org_id);
create index if not exists webhook_logs_created_at_idx on public.webhook_logs (created_at desc);
create index if not exists webhook_logs_status_idx on public.webhook_logs (status);

-- Enable RLS
alter table public.webhook_logs enable row level security;

create policy if not exists "Allow authenticated read" on public.webhook_logs
  for select to authenticated using (true);

create policy if not exists "Allow service insert" on public.webhook_logs
  for insert to authenticated with check (true);

-- ============================================
-- STEP 5: ADD CALL SOURCE TRACKING
-- ============================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'calls' and column_name = 'source'
  ) then
    alter table public.calls add column source text default 'fathom';
  end if;
end $$;

-- ============================================
-- STEP 6: VERIFY TABLE STRUCTURES
-- ============================================

-- Verify reps table
describe public.reps;

-- Verify calls table has all needed columns
select column_name, data_type 
from information_schema.columns 
where table_name = 'calls'
order by ordinal_position;

-- ============================================
-- POST-DEPLOYMENT MANUAL STEPS
-- ============================================

-- 1. Get your Clerk User ID from Clerk Dashboard → Users
-- 2. Update Papur's record with your actual Clerk ID:
-- update public.reps set clerk_user_id = 'YOUR_ACTUAL_CLERK_ID' where email = 'papur@creditclub.com';

-- 3. For each team member, after they first login via Clerk:
-- update public.reps set clerk_user_id = 'THEIR_CLERK_ID' where email = 'their@email.com';

-- 4. Update fathom_email for each member (their actual Fathom login email):
-- update public.reps set fathom_email = 'their.fathom@email.com' where email = 'their@email.com';

-- 5. Clean up any remaining demo calls if desired:
-- delete from public.calls where source = 'demo';
-- or
-- update public.calls set source = 'archived' where source = 'demo';
