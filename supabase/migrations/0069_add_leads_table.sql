create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text not null,
  email text not null,
  phone text not null,
  country text not null,
  student_range text not null,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Public submissions happen via the service-role client from the landing
-- page's server action (unauthenticated visitors have no session, so RLS
-- can't scope an insert to them) — this table has no anon-facing policy at
-- all, only the owner role can read/manage rows through a real session.
create policy "owner manages leads" on public.leads
  for all using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');
