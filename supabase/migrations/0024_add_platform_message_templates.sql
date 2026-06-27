create table public.platform_message_templates (
  key text primary key,
  body text not null,
  updated_at timestamptz not null default now()
);

alter table public.platform_message_templates enable row level security;

create policy "anyone can read platform templates" on public.platform_message_templates
  for select using (true);
create policy "owner manages platform templates" on public.platform_message_templates
  for all using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');
