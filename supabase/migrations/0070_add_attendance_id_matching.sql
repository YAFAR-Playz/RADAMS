-- Org-wide opt-in (default off, admin-only, same shape as
-- staff_reports_use_platform_branding) for matching students by an external
-- "attendance id" (e.g. a Zoom registration id) during both student import
-- and attendance-session import, instead of relying on name matching.
alter table public.organizations
  add column attendance_id_matching_enabled boolean not null default false;

-- Nullable, per-org unique (not global — two different orgs' external
-- platforms can happen to reuse the same id space), so it stays optional
-- and doesn't collide with student_code's own per-org uniqueness.
alter table public.students
  add column attendance_id text;

create unique index students_org_attendance_id_idx
  on public.students (org_id, attendance_id)
  where attendance_id is not null;
