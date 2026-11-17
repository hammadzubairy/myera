-- Per-product weekly injection-day reminders (replaces the single shot_schedules reminder)
create table if not exists public.injection_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null check (char_length(product_name) between 1 and 120),
  weekdays smallint[] not null check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  time_of_day time,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists injection_schedules_user on public.injection_schedules (user_id);

alter table public.injection_schedules enable row level security;

drop policy if exists injection_schedules_own on public.injection_schedules;
create policy injection_schedules_own on public.injection_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
