create table if not exists assignment_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  has_grade boolean not null default true,
  has_comment boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists assignment_templates_org_idx on assignment_templates (org_id);

alter table assignment_templates enable row level security;

create policy "read org assignment templates" on assignment_templates
  for select using (org_id = public.current_org_id());

create policy "admin manage assignment templates" on assignment_templates
  for all using (org_id = public.current_org_id() and public.current_role() = 'admin')
  with check (org_id = public.current_org_id() and public.current_role() = 'admin');

alter table assignments drop constraint if exists assignments_template_check;
alter table assignments add column if not exists template_id uuid references assignment_templates(id) on delete set null;
