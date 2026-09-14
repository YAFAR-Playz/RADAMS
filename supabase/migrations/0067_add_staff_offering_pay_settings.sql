-- staff_pay_settings.calc_method is one row per profile, so a single
-- assistant working on two courses is forced onto the same calc method for
-- both — there's no way today to pay them, say, "fixed + per paper" on one
-- course and plain "per paper" on another. This table adds a per-course
-- override, keyed on (profile_id, offering_id): when present it wins over
-- the person's own default (staff_pay_settings.calc_method) and the org
-- default, for that one course only — see resolveMethodForAssistant in
-- src/lib/actions/finance-salaries.ts. Plain "fixed" is deliberately excluded
-- from the allowed values here: it's a flat, courseless monthly amount for
-- the whole person (generateFixedSalaryLinesForPeriod), so it doesn't make
-- sense as a per-course override — a person's default stays "fixed" there
-- instead, and individual courses override AWAY from it when they need a
-- course-specific method.
create table public.staff_offering_pay_settings (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  calc_method text not null check (calc_method in ('paper', 'category', 'fixed_per_paper', 'fixed_per_assistant')),
  updated_at timestamptz not null default now(),
  primary key (profile_id, offering_id)
);

create index idx_staff_offering_pay_settings_offering_id on public.staff_offering_pay_settings (offering_id);
create index idx_staff_offering_pay_settings_org_id on public.staff_offering_pay_settings (org_id);

alter table public.staff_offering_pay_settings enable row level security;

create policy "read own or finance offering pay settings" on public.staff_offering_pay_settings
  for select using (
    profile_id = (select auth.uid())
    or (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
    or public.current_role() = 'owner'
  );
create policy "finance manages offering pay settings" on public.staff_offering_pay_settings
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'));
