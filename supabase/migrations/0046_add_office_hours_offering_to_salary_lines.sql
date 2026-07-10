-- Office-hours lines intentionally keep offering_id = null (see the comment
-- on setAssistantOfficeHours) to avoid colliding with the
-- (org_id, payee_id, offering_id, period) unique constraint a course's own
-- per-paper/bracket line already occupies for that same assistant+period.
-- This column instead tracks which course's office-hour rate applied,
-- without participating in that constraint, so an assistant can have a
-- separate office-hours entry per course in the same period.
alter table public.salary_lines add column if not exists office_hours_offering_id uuid references public.course_offerings(id) on delete cascade;
