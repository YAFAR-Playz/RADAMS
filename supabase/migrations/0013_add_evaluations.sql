create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  head_id uuid not null references public.profiles (id) on delete cascade,
  assistant_id uuid not null references public.profiles (id) on delete cascade,
  offering_id uuid not null references public.course_offerings (id) on delete cascade,
  period text not null,
  base_amount numeric not null default 0,
  notes text,
  rating text check (rating in ('outstanding', 'exceeds', 'meets', 'below')),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (head_id, assistant_id, offering_id, period)
);

create table public.evaluation_lines (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  kind text not null check (kind in ('extra', 'deduction')),
  category text not null,
  note text,
  qty text,
  sub text,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;
alter table public.evaluation_lines enable row level security;

create policy "read own or finance evaluations" on public.evaluations
  for select using (
    head_id = auth.uid()
    or assistant_id = auth.uid()
    or (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
    or public.current_role() = 'owner'
  );
create policy "head manages own evaluations" on public.evaluations
  for all using (head_id = auth.uid() and org_id = public.current_org_id())
  with check (head_id = auth.uid() and org_id = public.current_org_id());

create policy "read own or finance evaluation lines" on public.evaluation_lines
  for select using (
    exists (
      select 1 from public.evaluations e where e.id = evaluation_id
      and (e.head_id = auth.uid() or e.assistant_id = auth.uid()
           or (e.org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
           or public.current_role() = 'owner')
    )
  );
create policy "head manages own evaluation lines" on public.evaluation_lines
  for all using (
    exists (select 1 from public.evaluations e where e.id = evaluation_id and e.head_id = auth.uid())
  )
  with check (
    exists (select 1 from public.evaluations e where e.id = evaluation_id and e.head_id = auth.uid())
  );
