create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  plan_type text not null check (plan_type in ('full', 'installments')),
  total_amount numeric not null default 0,
  installment_count integer not null default 1,
  created_at timestamptz not null default now(),
  unique (student_id, offering_id)
);

create table public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans (id) on delete cascade,
  seq integer not null,
  amount numeric not null default 0,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  unique (plan_id, seq)
);

alter table public.payment_plans enable row level security;
alter table public.payment_installments enable row level security;

create policy "read org payment plans" on public.payment_plans
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "manage payment plans" on public.payment_plans
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'registration', 'finance'))
  )
  with check (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'registration', 'finance'))
  );

create policy "read org payment installments" on public.payment_installments
  for select using (
    exists (select 1 from public.payment_plans p join public.course_offerings o on o.id = p.offering_id
      where p.id = plan_id and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "manage payment installments" on public.payment_installments
  for all using (
    exists (select 1 from public.payment_plans p join public.course_offerings o on o.id = p.offering_id
      where p.id = plan_id and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'registration', 'finance'))
  )
  with check (
    exists (select 1 from public.payment_plans p join public.course_offerings o on o.id = p.offering_id
      where p.id = plan_id and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'registration', 'finance'))
  );
