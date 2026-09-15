-- Org-configurable Present/Late/Absent cutoffs for attendance-session CSV
-- imports (percentage of the session's actual duration a student needs to
-- have attended). Only shown/editable once Attendance ID matching is
-- turned on (see 0070_add_attendance_id_matching.sql) — it has no effect
-- otherwise.
alter table public.organizations
  add column attendance_present_threshold_pct smallint not null default 75,
  add column attendance_late_threshold_pct smallint not null default 40;
