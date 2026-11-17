-- Allow metric display preference (storage remains lb / inches).
alter table public.profiles
  drop constraint if exists profiles_units_check;

alter table public.profiles
  add constraint profiles_units_check check (units in ('lb_in', 'kg_cm'));
