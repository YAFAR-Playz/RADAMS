alter table public.organizations add column status text not null default 'active' check (status in ('active','trial','suspended'));
