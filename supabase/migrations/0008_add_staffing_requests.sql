create table public.staffing_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  offering_id uuid references public.course_offerings (id) on delete set null,
  kind text not null check (kind in ('add', 'remove', 'replace')),
  target_assistant_id uuid references public.profiles (id) on delete set null,
  candidate_name text,
  candidate_phone text,
  candidate_email text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.staffing_requests enable row level security;

create policy "read org staffing requests" on public.staffing_requests
  for select using (org_id = public.current_org_id() and public.current_role() in ('admin', 'head', 'hr'));

create policy "manage own staffing requests" on public.staffing_requests
  for all using (org_id = public.current_org_id() and (requested_by = auth.uid() or public.current_role() in ('admin', 'hr')))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'head', 'hr'));
