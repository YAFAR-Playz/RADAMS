-- Office-hour pay was a single org-wide rate — Finance needs to set a
-- different office-hour rate per course. A null offering_id row stays the
-- org-wide default (used when no course-specific override exists).
alter table public.other_rates add column if not exists offering_id uuid references public.course_offerings(id) on delete cascade;

-- One rate per (label, offering) — mirrors per_paper_rates' one-row-per-
-- offering shape, but only enforced when offering_id is actually set (the
-- org-wide reference rows, e.g. "Per paper (default)", stay unaffected).
create unique index if not exists other_rates_label_offering_uidx on public.other_rates (org_id, label, offering_id) where offering_id is not null;
