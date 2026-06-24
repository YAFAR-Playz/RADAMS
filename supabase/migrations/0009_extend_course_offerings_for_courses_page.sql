alter table public.course_offerings
  add column start_date date,
  add column end_date date,
  add column active boolean not null default true,
  add column fee_full numeric,
  add column fee_installment_total numeric,
  add column installment_count integer not null default 1;
