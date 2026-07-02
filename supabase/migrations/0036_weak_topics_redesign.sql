-- Replaces the old free-text "weak topic" tags (student_topic_flags) with a
-- proper head-managed catalog + assistant submission/approval workflow:
-- heads define topic options per course and link each to study material,
-- assistants tag students against that catalog monthly, heads approve, and
-- approved tags surface in the monthly report alongside the material links.
drop table if exists public.student_topic_flags;

create table public.topic_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  label text not null,
  video_link text,
  drive_link text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index topic_catalog_org_idx on public.topic_catalog (org_id);
create index topic_catalog_course_idx on public.topic_catalog (course_id);

alter table public.topic_catalog enable row level security;

create policy "read org topic catalog"
  on public.topic_catalog
  for select
  using (org_id = current_org_id() or "current_role"() = 'owner'::user_role);

create policy "heads manage topic catalog"
  on public.topic_catalog
  for all
  using (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'head'::user_role]))
  with check (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'head'::user_role]));

create table public.student_topic_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  topic_id uuid not null references public.topic_catalog (id) on delete cascade,
  assistant_id uuid not null references public.profiles (id) on delete cascade,
  period text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  unique (student_id, topic_id, period)
);

create index student_topic_submissions_org_idx on public.student_topic_submissions (org_id);
create index student_topic_submissions_offering_idx on public.student_topic_submissions (offering_id);
create index student_topic_submissions_period_idx on public.student_topic_submissions (period);

alter table public.student_topic_submissions enable row level security;

create policy "read org topic submissions"
  on public.student_topic_submissions
  for select
  using (org_id = current_org_id() or "current_role"() = 'owner'::user_role);

create policy "assistants submit topics"
  on public.student_topic_submissions
  for insert
  with check (
    org_id = current_org_id()
    and assistant_id = auth.uid()
    and exists (
      select 1 from public.enrollments e
      where e.student_id = student_topic_submissions.student_id
        and e.offering_id = student_topic_submissions.offering_id
        and e.assistant_id = auth.uid()
    )
  );

create policy "assistants remove own pending topics"
  on public.student_topic_submissions
  for delete
  using (org_id = current_org_id() and assistant_id = auth.uid() and status = 'pending');

create policy "heads review topic submissions"
  on public.student_topic_submissions
  for update
  using (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'head'::user_role]))
  with check (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'head'::user_role]));

create policy "heads delete topic submissions"
  on public.student_topic_submissions
  for delete
  using (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'head'::user_role]));
