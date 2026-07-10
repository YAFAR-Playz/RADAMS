-- Extra-work/deduction categories were org-wide only. A per-course override
-- row (offering_id set) shadows the org-wide row (offering_id null) for the
-- same (kind, label) once Finance sets one via the course multi-select —
-- mirrors the other_rates office-hour override added in 0045.
alter table public.pay_categories add column if not exists offering_id uuid references public.course_offerings(id) on delete cascade;

create unique index if not exists pay_categories_label_kind_offering_uidx on public.pay_categories (org_id, kind, label, offering_id) where offering_id is not null;
