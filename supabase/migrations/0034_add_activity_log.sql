-- Org-wide activity history, admin-only. Callers write a short category
-- (e.g. "staff", "students", "payments") plus a human-readable summary;
-- there's no generic entity-diffing here, just an append-only trail.
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name text not null,
  category text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create index activity_log_org_id_created_at_idx on public.activity_log (org_id, created_at desc);

alter table public.activity_log enable row level security;

create policy "org members log activity"
  on public.activity_log
  for insert
  with check (org_id = current_org_id());

create policy "admin reads activity log"
  on public.activity_log
  for select
  using (org_id = current_org_id() and "current_role"() = 'admin'::user_role);
