-- MyEra Day 1 foundation schema

create extension if not exists "pgcrypto";

-- Communities
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('women', 'men')),
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.communities (slug, name)
values ('women', 'Women''s community'), ('men', 'Men''s community')
on conflict (slug) do nothing;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  photo_url text,
  photo_public_id text,
  height_in numeric(5,2),
  start_weight_lb numeric(6,2),
  current_weight_lb numeric(6,2),
  goal_weight_lb numeric(6,2),
  gender text check (gender in ('woman', 'man', 'non_binary', 'other')),
  other_gender_text text,
  community_id uuid references public.communities(id),
  units text not null default 'lb_in' check (units = 'lb_in'),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notification prefs (created early for signup trigger)
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  community boolean not null default true,
  announcements boolean not null default true,
  shot_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Dose regimens
create table if not exists public.dose_regimens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_name text not null,
  amount_mg numeric(8,3) not null check (amount_mg > 0),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now()
);

create unique index if not exists dose_regimens_one_active
  on public.dose_regimens (user_id)
  where end_date is null;

create index if not exists dose_regimens_user_start
  on public.dose_regimens (user_id, start_date desc);

-- Dose logs
create table if not exists public.dose_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,
  amount_mg numeric(8,3) not null check (amount_mg > 0),
  regimen_id uuid references public.dose_regimens(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists dose_logs_user_date
  on public.dose_logs (user_id, logged_on desc);

-- Weight logs
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,
  weight_lb numeric(6,2) not null check (weight_lb > 0),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists weight_logs_user_date
  on public.weight_logs (user_id, logged_on desc);

-- Measurement types
create table if not exists public.measurement_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  key text not null,
  label text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists measurement_types_system_key
  on public.measurement_types (key)
  where is_system = true;

create unique index if not exists measurement_types_user_key
  on public.measurement_types (user_id, key)
  where user_id is not null;

insert into public.measurement_types (key, label, is_system)
select v.key, v.label, true
from (values ('waist', 'Waist'), ('hips', 'Hips')) as v(key, label)
where not exists (
  select 1 from public.measurement_types mt where mt.key = v.key and mt.is_system = true
);

-- Measurement logs
create table if not exists public.measurement_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type_id uuid not null references public.measurement_types(id) on delete cascade,
  value_in numeric(6,2) not null check (value_in > 0),
  logged_on date not null,
  created_at timestamptz not null default now()
);

create index if not exists measurement_logs_user_type_date
  on public.measurement_logs (user_id, type_id, logged_on desc);

-- Push tokens
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user on public.push_tokens (user_id);

-- Shot schedules (foundation only)
create table if not exists public.shot_schedules (
  user_id uuid primary key references auth.users(id) on delete cascade,
  frequency text not null check (frequency in ('weekly', 'every_2_weeks', 'daily')),
  shot_day smallint check (shot_day between 0 and 6),
  shot_time time not null default '09:00',
  day_before_enabled boolean not null default false,
  day_before_time time,
  second_reminder_enabled boolean not null default false,
  hide_on_lockscreen boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Community change requests (later admin approval)
create table if not exists public.community_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_community_id uuid references public.communities(id),
  to_community_id uuid not null references public.communities(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);

-- RLS
alter table public.communities enable row level security;
alter table public.profiles enable row level security;
alter table public.dose_regimens enable row level security;
alter table public.dose_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.measurement_types enable row level security;
alter table public.measurement_logs enable row level security;
alter table public.push_tokens enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.shot_schedules enable row level security;
alter table public.community_change_requests enable row level security;

create policy communities_read on public.communities for select to authenticated using (true);

create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy dose_regimens_own on public.dose_regimens for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dose_logs_own on public.dose_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy weight_logs_own on public.weight_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy measurement_types_read on public.measurement_types for select to authenticated
  using (is_system = true or user_id = auth.uid());
create policy measurement_types_insert_own on public.measurement_types for insert to authenticated
  with check (user_id = auth.uid() and is_system = false);
create policy measurement_logs_own on public.measurement_logs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy push_tokens_own on public.push_tokens for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy shot_schedules_own on public.shot_schedules for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy community_change_own on public.community_change_requests for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
