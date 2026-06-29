insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false) on conflict (id) do nothing;

create table public.salary_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  payee_id uuid not null references public.profiles (id) on delete cascade,
  period text not null,
  path text not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, payee_id, period)
);

alter table public.salary_receipts enable row level security;

create policy "read own or finance receipts" on public.salary_receipts
  for select using (
    payee_id = auth.uid()
    or (org_id = public.current_org_id() and public.current_role() in ('finance', 'admin'))
    or public.current_role() = 'owner'
  );
create policy "finance manages receipts" on public.salary_receipts
  for all using (org_id = public.current_org_id() and public.current_role() in ('finance', 'admin'))
  with check (org_id = public.current_org_id() and public.current_role() in ('finance', 'admin'));
