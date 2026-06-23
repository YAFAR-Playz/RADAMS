create table public.assignment_assistants (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  assistant_id uuid not null references public.profiles (id) on delete cascade,
  primary key (assignment_id, assistant_id)
);

alter table public.assignment_assistants enable row level security;

create policy "read assignment assistants" on public.assignment_assistants
  for select using (
    exists (
      select 1 from public.assignments a join public.course_offerings o on o.id = a.offering_id
      where a.id = assignment_id and (o.org_id = public.current_org_id() or public.current_role() = 'owner')
    )
  );

create policy "manage assignment assistants" on public.assignment_assistants
  for all using (
    exists (
      select 1 from public.assignments a join public.course_offerings o on o.id = a.offering_id
      where a.id = assignment_id and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'head')
    )
  );
