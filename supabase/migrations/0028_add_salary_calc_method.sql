alter table public.salary_lines add column if not exists calc_method text;
alter table public.salary_lines add constraint salary_lines_unique_line unique (org_id, payee_id, offering_id, period);
