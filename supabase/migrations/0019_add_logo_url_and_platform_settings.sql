insert into storage.buckets (id, name, public) values ('branding', 'branding', true) on conflict (id) do nothing;

alter table public.organizations add column logo_url text;

create table public.platform_settings (
  id boolean primary key default true,
  default_logo_url text,
  constraint single_row check (id)
);

alter table public.platform_settings enable row level security;

create policy "anyone can read platform settings" on public.platform_settings
  for select using (true);
create policy "owner manages platform settings" on public.platform_settings
  for all using (public.current_role() = 'owner')
  with check (public.current_role() = 'owner');

insert into public.platform_settings (id) values (true);
