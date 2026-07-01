-- Short, memorable per-org student code (starts at 1001), assigned automatically.
alter table public.students
  add column student_code text;

with numbered as (
  select id, (1000 + row_number() over (partition by org_id order by created_at, id))::text as code
  from public.students
)
update public.students s
set student_code = numbered.code
from numbered
where s.id = numbered.id;

alter table public.students
  alter column student_code set not null;

create unique index students_org_id_student_code_key on public.students (org_id, student_code);

create function public.assign_student_code()
returns trigger
language plpgsql
as $$
begin
  if new.student_code is null then
    perform pg_advisory_xact_lock(hashtext(new.org_id::text));
    select (coalesce(max(student_code::int), 1000) + 1)::text
      into new.student_code
      from public.students
      where org_id = new.org_id;
  end if;
  return new;
end;
$$;

create trigger students_assign_code
  before insert on public.students
  for each row
  execute function public.assign_student_code();
