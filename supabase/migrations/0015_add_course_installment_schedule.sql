create table public.course_installment_schedule (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  seq integer not null,
  amount numeric not null default 0,
  due_date date,
  unique (offering_id, seq)
);

alter table public.course_installment_schedule enable row level security;

create policy "read org course installment schedule" on public.course_installment_schedule
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "admin manages course installment schedule" on public.course_installment_schedule
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() = 'admin')
  )
  with check (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() = 'admin')
  );
