alter table public.assignments
  add column template text not null default 'grade' check (template in ('grade', 'checkbox', 'rubric', 'comment')),
  add column grade_scheme text not null default 'numeric' check (grade_scheme in ('numeric', 'letter')),
  add column counts_salary boolean not null default true,
  add column message_template text,
  add column closed_at timestamptz;
