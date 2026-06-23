-- Courses, offerings (course + session + unit), students, enrollments,
-- assignments and per-student assignment logs — backs the Assignments
-- logging screen and the Head course-oversight screen.

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  session text not null,
  unit text,
  created_at timestamptz not null default now()
);

create table public.offering_assistants (
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  assistant_id uuid not null references public.profiles (id) on delete cascade,
  primary key (offering_id, assistant_id)
);

create table public.offering_heads (
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  head_id uuid not null references public.profiles (id) on delete cascade,
  primary key (offering_id, head_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  initials text not null,
  guardian_name text,
  guardian_phone text,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  assistant_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (student_id, offering_id)
);

create type public.assignment_status as enum (
  'checked', 'submitted', 'late', 'missing', 'excused'
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  title text not null,
  max_marks integer not null default 100,
  due_date date,
  lettered boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.assignment_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.assignment_status,
  grade text,
  comment text,
  sent_at timestamptz,
  logged_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

alter table public.courses enable row level security;
alter table public.course_offerings enable row level security;
alter table public.offering_assistants enable row level security;
alter table public.offering_heads enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_logs enable row level security;

-- Read access: anyone in the same org (owner sees everything).
create policy "read org courses" on public.courses
  for select using (org_id = public.current_org_id() or public.current_role() = 'owner');
create policy "read org offerings" on public.course_offerings
  for select using (org_id = public.current_org_id() or public.current_role() = 'owner');
create policy "read offering assistants" on public.offering_assistants
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "read offering heads" on public.offering_heads
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "read org students" on public.students
  for select using (org_id = public.current_org_id() or public.current_role() = 'owner');
create policy "read enrollments" on public.enrollments
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "read assignments" on public.assignments
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "read assignment logs" on public.assignment_logs
  for select using (
    exists (select 1 from public.assignments a join public.course_offerings o on o.id = a.offering_id
      where a.id = assignment_id and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );

-- Write access: heads and admins manage courses/offerings/assignments for their org.
create policy "manage org courses" on public.courses
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'head'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'head'));
create policy "manage org offerings" on public.course_offerings
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'head'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'head'));
create policy "manage offering assistants" on public.offering_assistants
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'head'))
  );
create policy "manage offering heads" on public.offering_heads
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'head'))
  );
create policy "manage org students" on public.students
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'head', 'registration'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'head', 'registration'));
create policy "manage enrollments" on public.enrollments
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'head', 'registration'))
  );
create policy "manage assignments" on public.assignments
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'head'))
  );

-- Assignment logs: a Head may log for any student in their org's offering;
-- an Assistant may log only for students enrolled to them.
create policy "log as head or own assistant" on public.assignment_logs
  for all using (
    exists (
      select 1
      from public.assignments a
      join public.course_offerings o on o.id = a.offering_id
      join public.enrollments e on e.offering_id = o.id and e.student_id = assignment_logs.student_id
      where a.id = assignment_id
        and o.org_id = public.current_org_id()
        and (public.current_role() in ('admin', 'head') or e.assistant_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.assignments a
      join public.course_offerings o on o.id = a.offering_id
      join public.enrollments e on e.offering_id = o.id and e.student_id = assignment_logs.student_id
      where a.id = assignment_id
        and o.org_id = public.current_org_id()
        and (public.current_role() in ('admin', 'head') or e.assistant_id = auth.uid())
    )
  );
