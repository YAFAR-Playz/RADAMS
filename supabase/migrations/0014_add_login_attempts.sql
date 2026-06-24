create table public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index login_attempts_email_created_idx on public.login_attempts (email, created_at desc);

-- RLS enabled with no policies: only the service-role client (which
-- bypasses RLS) can read/write this table. No anon/authenticated access.
alter table public.login_attempts enable row level security;
