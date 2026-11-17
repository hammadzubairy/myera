-- MyEra Day 2: progress photos, food diary, community posts

-- Calorie goal on profile
alter table public.profiles
  add column if not exists calorie_goal_kcal integer check (calorie_goal_kcal is null or (calorie_goal_kcal >= 800 and calorie_goal_kcal <= 6000));

-- Progress photos (private by default)
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null,
  url text not null,
  public_id text,
  created_at timestamptz not null default now()
);

create index if not exists progress_photos_user_date
  on public.progress_photos (user_id, taken_on desc);

-- Food diary
create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_on date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  off_code text,
  servings numeric(8,3) not null default 1 check (servings > 0),
  serving_label text not null default 'serving',
  calories numeric(10,2) not null check (calories >= 0),
  protein_g numeric(10,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(10,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(10,2) not null default 0 check (fat_g >= 0),
  created_at timestamptz not null default now()
);

create index if not exists food_logs_user_date
  on public.food_logs (user_id, logged_on desc);

-- Community posts
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  photo_urls text[] not null default '{}',
  include_weight_change boolean not null default false,
  include_before_after boolean not null default false,
  include_dose boolean not null default false,
  weight_change_lb numeric(6,2),
  before_url text,
  after_url text,
  dose_label text,
  created_at timestamptz not null default now()
);

create index if not exists community_posts_community_created
  on public.community_posts (community_id, created_at desc);

create index if not exists community_posts_author
  on public.community_posts (author_id);

-- Likes
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists post_likes_post on public.post_likes (post_id);

-- Comments
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_created
  on public.post_comments (post_id, created_at asc);

-- Reports (admin reviews later; post stays until removed)
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in (
    'spam', 'harassment', 'unsafe_medical', 'inappropriate_photo', 'other'
  )),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

-- Hide member posts from feed
create table if not exists public.hidden_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, hidden_user_id),
  check (user_id <> hidden_user_id)
);

create index if not exists hidden_members_user on public.hidden_members (user_id);

-- RLS
alter table public.progress_photos enable row level security;
alter table public.food_logs enable row level security;
alter table public.community_posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reports enable row level security;
alter table public.hidden_members enable row level security;

create policy progress_photos_own on public.progress_photos
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy food_logs_own on public.food_logs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy community_posts_same_community on public.community_posts
  for select to authenticated
  using (
    community_id = (select community_id from public.profiles where id = auth.uid())
    and author_id not in (
      select hidden_user_id from public.hidden_members where user_id = auth.uid()
    )
  );

create policy community_posts_insert_own on public.community_posts
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and community_id = (select community_id from public.profiles where id = auth.uid())
  );

create policy community_posts_delete_own on public.community_posts
  for delete to authenticated using (author_id = auth.uid());

create policy post_likes_same_community on public.post_likes
  for select to authenticated
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.community_id = (select community_id from public.profiles where id = auth.uid())
    )
  );

create policy post_likes_insert on public.post_likes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.community_id = (select community_id from public.profiles where id = auth.uid())
    )
  );

create policy post_likes_delete_own on public.post_likes
  for delete to authenticated using (user_id = auth.uid());

create policy post_comments_same_community on public.post_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.community_id = (select community_id from public.profiles where id = auth.uid())
    )
  );

create policy post_comments_insert on public.post_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.community_id = (select community_id from public.profiles where id = auth.uid())
    )
  );

create policy post_comments_delete_own on public.post_comments
  for delete to authenticated using (author_id = auth.uid());

create policy post_reports_insert_own on public.post_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and p.community_id = (select community_id from public.profiles where id = auth.uid())
    )
  );

create policy post_reports_select_own on public.post_reports
  for select to authenticated using (reporter_id = auth.uid());

create policy hidden_members_own on public.hidden_members
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
