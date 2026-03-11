-- Migration: Add sales_role field to reps table
-- This separates admin permissions from sales function

-- Add sales_role column (nullable enum)
alter table public.reps 
add column if not exists sales_role text check (sales_role in ('closer', 'sdr'));

-- Create index for sales_role queries
create index if not exists reps_sales_role_idx on public.reps (sales_role);

-- Update existing team members with proper sales roles
-- Papur = admin + closer
update public.reps 
set sales_role = 'closer' 
where email = 'papur@creditclub.com' or name = 'Papur';

-- John = closer
update public.reps 
set sales_role = 'closer' 
where email = 'john@creditclub.com' or name = 'John';

-- Adan = closer
update public.reps 
set sales_role = 'closer' 
where email = 'adan@creditclub.com' or name = 'Adan';

-- Callum = closer
update public.reps 
set sales_role = 'closer' 
where email = 'callum@creditclub.com' or name = 'Callum';

-- Yuvraj = sdr
update public.reps 
set sales_role = 'sdr' 
where email = 'yuvraj@creditclub.com' or name = 'Yuvraj';

-- Kayode = sdr
update public.reps 
set sales_role = 'sdr' 
where email = 'kayode@creditclub.com' or name = 'Kayode';

-- cherry = admin only (no sales_role)
-- Leave sales_role as NULL for admin-only users

-- Verify the updates
select name, email, role, sales_role, status 
from public.reps 
order by sales_role nulls last, name;
