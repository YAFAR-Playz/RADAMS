-- Lets Finance assign a standing monthly office-hours figure to an assistant
-- for a specific course, instead of retyping it in Salaries every period —
-- generateSalariesForPeriod uses this to auto-create that month's line.
alter table public.offering_assistants add column if not exists default_office_hours numeric;
