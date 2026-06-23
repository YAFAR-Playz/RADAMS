alter table public.students
  add column email text,
  add column phone text,
  add column left_at timestamptz;
