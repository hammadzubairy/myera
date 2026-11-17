-- Run in project ewmnfzwmmpjmvmxhtdba (My Era) → SQL Editor → New query
-- First confirm the table exists in THIS project:
select
  to_regclass('public.dose_regimens') as dose_regimens_table,
  count(*) as row_count
from public.dose_regimens;

-- Then allow multiple active medications (one active row per med name):
drop index if exists public.dose_regimens_one_active;

create unique index if not exists dose_regimens_one_active_per_med
  on public.dose_regimens (user_id, lower(medication_name))
  where end_date is null;
