insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false) on conflict (id) do nothing;

-- Full version history is kept (unlike salary_receipts' one-per-period
-- unique constraint) — "current" contract for a staff member is just the
-- most recent row by created_at.
create table public.staff_contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  path text not null,
  file_name text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.staff_report_generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  generated_by uuid references public.profiles (id) on delete set null,
  generated_at timestamptz not null default now(),
  offering_ids uuid[] not null default '{}',
  periods_covered text[] not null default '{}',
  month_year_folder text not null,
  drive_folder_url text,
  drive_file_url text,
  status text not null check (status in ('ok', 'error')),
  error_message text
);

alter table public.staff_contracts enable row level security;
alter table public.staff_report_generations enable row level security;

-- Mirrors 0031_salary_receipts_rls.sql's shape: the managing roles (here
-- admin/hr, not finance) get full access within their org, and the staff
-- member themself can additionally read their own rows.
create policy "hr admin manages staff contracts" on public.staff_contracts
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'hr'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'hr'));

create policy "read own or hr admin staff contracts" on public.staff_contracts
  for select using (
    staff_id = auth.uid()
    or (org_id = public.current_org_id() and public.current_role() in ('admin', 'hr'))
    or public.current_role() = 'owner'
  );

-- Generation history is an internal HR/admin record, not staff-facing.
create policy "hr admin manages staff report generations" on public.staff_report_generations
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'hr'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'hr'));

create policy "owner reads staff report generations" on public.staff_report_generations
  for select using (public.current_role() = 'owner');
