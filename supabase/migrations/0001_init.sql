-- RadAMS phase 1 schema: organizations + profiles (roles, branding).
-- Later phases (students, courses, assignments, attendance, payroll, etc.)
-- will add their own tables/migrations on top of this.

create extension if not exists "pgcrypto";

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_name text not null default 'RadAMS',
  logo_letter text not null default 'R',
  primary_color text not null default '#2563eb',
  corner text not null default 'soft' check (corner in ('soft', 'sharp')),
  created_at timestamptz not null default now()
);

create type public.user_role as enum (
  'owner', 'admin', 'hr', 'head', 'assistant', 'registration', 'finance'
);

-- One row per authenticated user. Provisioned ahead of time by an Owner/Admin
-- (see scripts/seed.ts) — there is no public self-signup, matching the
-- invite-only multi-tenant model described in the design.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  role public.user_role not null,
  full_name text not null,
  initials text not null,
  email text not null unique,
  phone text,
  created_at timestamptz not null default now()
);

-- Owner is a platform-level role and may not belong to a single org.
alter table public.profiles
  add constraint profiles_org_required_unless_owner
  check (role = 'owner' or org_id is not null);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

-- SECURITY DEFINER helpers to read the caller's own org/role without
-- triggering recursive RLS evaluation on public.profiles.
create function public.current_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create function public.current_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create policy "read own profile or org" on public.profiles
  for select
  using (
    id = auth.uid()
    or org_id = public.current_org_id()
    or public.current_role() = 'owner'
  );

create policy "read own org" on public.organizations
  for select
  using (
    id = public.current_org_id()
    or public.current_role() = 'owner'
  );
