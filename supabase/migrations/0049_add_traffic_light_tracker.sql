-- Traffic Light Tracker: org-wide grade bands used to translate a raw
-- percentage into a rank ("A"/"B"/"C or below"-equivalent) for the tier
-- rules below — admin-controlled since this org has no letter grades
-- configured anywhere yet (every course_offerings.grade_scale is
-- "percentage"). Same {label,min}[] shape as course_offerings.grade_bands
-- so the existing band-lookup logic/UI pattern can be reused.
alter table public.organizations add column if not exists traffic_light_bands jsonb;

-- A per-course target grade an assistant sets for their student — the
-- "on track" baseline the Green/Yellow/Red tiers compare against. Scoped to
-- the enrollment (not the student row) since grading is already
-- per-course-offering, and a student can have different targets in
-- different courses.
alter table public.enrollments add column if not exists target_grade numeric;
