create table public.staff_pay_settings (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  calc_method text not null default 'paper' check (calc_method in ('paper', 'category', 'fixed')),
  pay_method text not null default 'Bank transfer',
  fixed_salary numeric,
  bonus_pct numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.staff_pay_settings enable row level security;

create policy "read own or finance pay settings" on public.staff_pay_settings
  for select using (
    profile_id = auth.uid()
    or (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
    or public.current_role() = 'owner'
  );
create policy "finance manages pay settings" on public.staff_pay_settings
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'));
