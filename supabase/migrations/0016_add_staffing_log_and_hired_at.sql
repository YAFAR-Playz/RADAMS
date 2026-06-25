alter table public.profiles add column hired_at date not null default current_date;

create table public.staffing_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('add','remove')),
  target_name text not null,
  target_role text not null,
  hire_date date,
  leave_date date,
  created_at timestamptz not null default now()
);

alter table public.staffing_log enable row level security;

create policy "read org staffing log" on public.staffing_log
  for select using (org_id = public.current_org_id() and public.current_role() in ('admin','hr','owner'));
create policy "admin hr insert staffing log" on public.staffing_log
  for insert with check (org_id = public.current_org_id() and public.current_role() in ('admin','hr'));
