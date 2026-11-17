-- Allow several medications to be active at the same time.
-- Previously a user could only have one regimen with end_date is null.
drop index if exists public.dose_regimens_one_active;

-- Still prevent the same medication from being active twice.
create unique index if not exists dose_regimens_one_active_per_med
  on public.dose_regimens (user_id, lower(medication_name))
  where end_date is null;
