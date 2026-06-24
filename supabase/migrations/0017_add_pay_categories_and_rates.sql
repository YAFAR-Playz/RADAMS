create table public.pay_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('extra', 'deduction')),
  label text not null,
  mode text not null check (mode in ('number', 'dropdown', 'fixed')),
  rate numeric,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.pay_category_options (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.pay_categories (id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  sort_order integer not null default 0
);

create table public.per_paper_rates (
  offering_id uuid primary key references public.course_offerings (id) on delete cascade,
  rate numeric not null default 8
);

create table public.pay_brackets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  lo integer not null default 0,
  hi integer not null default 0,
  pay numeric not null default 0,
  sort_order integer not null default 0
);

create table public.other_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  unit text not null,
  rate numeric not null default 0,
  sort_order integer not null default 0
);

alter table public.pay_categories enable row level security;
alter table public.pay_category_options enable row level security;
alter table public.per_paper_rates enable row level security;
alter table public.pay_brackets enable row level security;
alter table public.other_rates enable row level security;

create policy "read org pay categories" on public.pay_categories
  for select using (org_id = public.current_org_id() or public.current_role() = 'owner');
create policy "finance manages pay categories" on public.pay_categories
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'));

create policy "read org pay category options" on public.pay_category_options
  for select using (
    exists (select 1 from public.pay_categories c where c.id = category_id
      and (c.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "finance manages pay category options" on public.pay_category_options
  for all using (
    exists (select 1 from public.pay_categories c where c.id = category_id
      and c.org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  )
  with check (
    exists (select 1 from public.pay_categories c where c.id = category_id
      and c.org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  );

create policy "read org per paper rates" on public.per_paper_rates
  for select using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and (o.org_id = public.current_org_id() or public.current_role() = 'owner'))
  );
create policy "finance manages per paper rates" on public.per_paper_rates
  for all using (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  )
  with check (
    exists (select 1 from public.course_offerings o where o.id = offering_id
      and o.org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  );

create policy "read org pay brackets" on public.pay_brackets
  for select using (org_id = public.current_org_id() or public.current_role() = 'owner');
create policy "finance manages pay brackets" on public.pay_brackets
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'));

create policy "read org other rates" on public.other_rates
  for select using (org_id = public.current_org_id() or public.current_role() = 'owner');
create policy "finance manages other rates" on public.other_rates
  for all using (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'))
  with check (org_id = public.current_org_id() and public.current_role() in ('admin', 'finance'));
