-- Manual "needs revision" topic flags per student, set by whoever teaches
-- or manages them — not computed from grades, just a note surfaced on the
-- student record.
create table public.student_topic_flags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  topic text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, topic)
);

alter table public.student_topic_flags enable row level security;

create policy "read org topic flags"
  on public.student_topic_flags
  for select
  using (org_id = current_org_id() or "current_role"() = 'owner'::user_role);

create policy "managers flag topics"
  on public.student_topic_flags
  for all
  using (
    org_id = current_org_id()
    and (
      "current_role"() = any (array['admin'::user_role, 'head'::user_role, 'registration'::user_role])
      or exists (
        select 1 from public.enrollments e
        where e.student_id = student_topic_flags.student_id and e.assistant_id = auth.uid()
      )
    )
  )
  with check (
    org_id = current_org_id()
    and (
      "current_role"() = any (array['admin'::user_role, 'head'::user_role, 'registration'::user_role])
      or exists (
        select 1 from public.enrollments e
        where e.student_id = student_topic_flags.student_id and e.assistant_id = auth.uid()
      )
    )
  );
