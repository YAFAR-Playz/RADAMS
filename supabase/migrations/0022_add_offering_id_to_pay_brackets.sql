alter table public.pay_brackets add column offering_id uuid references public.course_offerings(id) on delete cascade;
