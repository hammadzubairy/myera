-- MyEra Day 3: notifications, announcements, admin moderation, account lifecycle

-- Profile role / suspend / soft-delete
alter table public.profiles
  add column if not exists role text not null default 'member'
    check (role in ('member', 'admin'));

alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_suspended_idx on public.profiles (suspended_at)
  where suspended_at is not null;

-- Report review workflow
alter table public.post_reports
  add column if not exists status text not null default 'open'
    check (status in ('open', 'removed', 'kept'));

alter table public.post_reports
  add column if not exists reviewed_at timestamptz;

alter table public.post_reports
  add column if not exists reviewed_by uuid references auth.users(id);

create index if not exists post_reports_status_idx
  on public.post_reports (status, created_at desc);

-- Soft-remove posts without hard delete (admin keep history)
alter table public.community_posts
  add column if not exists removed_at timestamptz;

alter table public.community_posts
  add column if not exists removed_by uuid references auth.users(id);

-- Shot schedule scheduler helpers
alter table public.shot_schedules
  add column if not exists timezone text not null default 'UTC';

alter table public.shot_schedules
  add column if not exists next_fire_at timestamptz;

alter table public.shot_schedules
  add column if not exists last_fired_at timestamptz;

alter table public.shot_schedules
  add column if not exists last_dose_logged_on date;

alter table public.shot_schedules
  add column if not exists snooze_until timestamptz;

alter table public.shot_schedules
  add column if not exists enabled boolean not null default true;

create index if not exists shot_schedules_next_fire
  on public.shot_schedules (next_fire_at)
  where enabled = true and next_fire_at is not null;

-- Announcements
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all'
    check (audience in ('all', 'women', 'men')),
  send_push boolean not null default true,
  pin_to_feed boolean not null default false,
  publish_at timestamptz,
  published_at timestamptz,
  created_by uuid references auth.users(id),
  push_sent_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists announcements_published
  on public.announcements (published_at desc nulls last);

create index if not exists announcements_due
  on public.announcements (publish_at)
  where published_at is null and publish_at is not null;

create table if not exists public.announcement_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- Members can read published announcements (API still filters by community)
drop policy if exists announcements_select_published on public.announcements;
create policy announcements_select_published on public.announcements
  for select to authenticated
  using (published_at is not null);

drop policy if exists announcement_reads_own on public.announcement_reads;
create policy announcement_reads_own on public.announcement_reads
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Seed note: promote an admin after creating the auth user, e.g.
-- update public.profiles set role = 'admin' where email = 'admin@myera.rx';
