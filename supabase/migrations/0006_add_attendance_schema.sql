create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  title text not null,
  session_date date not null,
  session_time text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create type public.attendance_status as enum ('present', 'late', 'absent');

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.attendance_status not null default 'present',
  updated_at timestamptz not null default now(),
  unique (session_id, student_id)
);

alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

create policy "read attendance sessions" on public.attendance_sessions
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "manage attendance sessions" on public.attendance_sessions
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'head', 'registration'))
  );

create policy "read attendance records" on public.attendance_records
  for select using (
    exists (select 1 from public.attendance_sessions s join public.course_offerings o on o.id = s.offering_id
      where s.id = session_id and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "manage attendance records" on public.attendance_records
  for all using (
    exists (select 1 from public.attendance_sessions s join public.course_offerings o on o.id = s.offering_id
      where s.id = session_id and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'head', 'registration'))
  );
