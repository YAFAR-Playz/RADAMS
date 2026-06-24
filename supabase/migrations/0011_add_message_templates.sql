create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  unique (org_id, key)
);

alter table public.message_templates enable row level security;

create policy "read org message templates" on public.message_templates
  for select using (org_id = public.current_org_id() or public.current_role() = 'owner');

create policy "admin manages message templates" on public.message_templates
  for all using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');
