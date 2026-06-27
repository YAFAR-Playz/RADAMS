alter table public.profiles add column is_main_admin boolean not null default false;
update public.profiles set is_main_admin = true where role = 'admin';
