alter table public.organizations
  add column currency text not null default 'GBP',
  add column salary_visible_to_heads boolean not null default false,
  add column head_edit_amounts boolean not null default false,
  add column assistant_see_breakdown boolean not null default false,
  add column auto_release boolean not null default false;

create policy "admin or finance update own org" on public.organizations
  for update
  using (id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  with check (id = public.current_org_id() and public.current_role() in ('admin', 'finance'));
