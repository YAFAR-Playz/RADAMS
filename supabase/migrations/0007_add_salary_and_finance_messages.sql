create table public.salary_lines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  payee_id uuid not null references public.profiles (id) on delete cascade,
  offering_id uuid references public.course_offerings (id) on delete set null,
  period text not null,
  method text not null default 'Per paper',
  basis text,
  base numeric not null default 0,
  bonus numeric not null default 0,
  deduction numeric not null default 0,
  bonus_reason text,
  deduction_reason text,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  pay_method text not null default 'Bank transfer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  period text,
  created_at timestamptz not null default now()
);

alter table public.salary_lines enable row level security;
alter table public.finance_messages enable row level security;

create policy "read own or finance salary lines" on public.salary_lines
  for select using (
    payee_id = auth.uid()
    or (org_id = public.current_org_id() and public.current_role() in ('finance', 'admin'))
    or public.current_role() = 'owner'
  );
create policy "finance manages salary lines" on public.salary_lines
  for all using (org_id = public.current_org_id() and public.current_role() in ('finance', 'admin'))
  with check (org_id = public.current_org_id() and public.current_role() in ('finance', 'admin'));

create policy "send finance message" on public.finance_messages
  for insert with check (org_id = public.current_org_id() and from_id = auth.uid());
create policy "read own or finance messages" on public.finance_messages
  for select using (
    from_id = auth.uid()
    or (org_id = public.current_org_id() and public.current_role() in ('finance', 'admin'))
    or public.current_role() = 'owner'
  );
