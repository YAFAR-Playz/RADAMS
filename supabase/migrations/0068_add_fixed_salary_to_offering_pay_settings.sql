-- A per-course override can now itself be "fixed" — a flat amount for just
-- this one course (distinct from staff_pay_settings.fixed_salary, the
-- person-level flat salary with no course tied to it at all). Needs its own
-- amount column since the person-level fixed_salary column doesn't apply
-- here — Finance sets a separate number per course.
alter table public.staff_offering_pay_settings
  add column if not exists fixed_salary numeric;

alter table public.staff_offering_pay_settings
  drop constraint staff_offering_pay_settings_calc_method_check;

alter table public.staff_offering_pay_settings
  add constraint staff_offering_pay_settings_calc_method_check
  check (calc_method in ('paper', 'category', 'fixed', 'fixed_per_paper', 'fixed_per_assistant'));
