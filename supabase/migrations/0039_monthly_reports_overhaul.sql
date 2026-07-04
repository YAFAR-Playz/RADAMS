alter table course_offerings drop constraint if exists course_offerings_grade_scale_check;
alter table course_offerings add constraint course_offerings_grade_scale_check check (grade_scale = any (array['percentage'::text, 'letter'::text, 'numeric'::text]));

alter table students add column if not exists drive_folder_link text;

create table if not exists monthly_report_generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  offering_id uuid not null references course_offerings(id) on delete cascade,
  period text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  assignment_selection jsonb not null default '[]',
  grade_scale jsonb not null default '{"scale":"percentage","bands":[]}',
  unique (offering_id, period)
);

create table if not exists monthly_report_students (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references monthly_report_generations(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  avg_grade numeric,
  assignments jsonb not null default '[]',
  weak_topics jsonb not null default '[]',
  assistant_comment text,
  unique (generation_id, student_id)
);

create index if not exists monthly_report_generations_offering_period_idx on monthly_report_generations (offering_id, period);
create index if not exists monthly_report_students_generation_idx on monthly_report_students (generation_id);

alter table monthly_report_generations enable row level security;
alter table monthly_report_students enable row level security;

create policy "org members can read report generations" on monthly_report_generations
  for select using (org_id = public.current_org_id());
create policy "heads and admins manage report generations" on monthly_report_generations
  for all using (org_id = public.current_org_id() and public.current_role() in ('head','admin'))
  with check (org_id = public.current_org_id() and public.current_role() in ('head','admin'));

create policy "org members can read report students" on monthly_report_students
  for select using (exists (select 1 from monthly_report_generations g where g.id = generation_id and g.org_id = public.current_org_id()));
create policy "heads and admins manage report students" on monthly_report_students
  for all using (exists (select 1 from monthly_report_generations g where g.id = generation_id and g.org_id = public.current_org_id() and public.current_role() in ('head','admin')))
  with check (exists (select 1 from monthly_report_generations g where g.id = generation_id and g.org_id = public.current_org_id() and public.current_role() in ('head','admin')));
