-- Org-wide monthly report look, admin-controlled. Section toggles default to
-- what the example format uses (group-by-type on; the other two default on
-- too, matching current behavior — an org can turn them off if they want a
-- leaner report).
alter table public.organizations add column if not exists report_show_weak_topics boolean not null default true;
alter table public.organizations add column if not exists report_show_comment boolean not null default true;
alter table public.organizations add column if not exists report_group_by_type boolean not null default true;

-- Which section an assignment type's entries land in on the monthly report
-- ("Homeworks" gets a simple title+status table; "Quizzes" gets a
-- Status/Grade/Mark mini-table per quiz; "other" keeps the original flat
-- table). Defaults to homework so existing templates don't silently
-- disappear from the report.
alter table public.assignment_templates add column if not exists report_group text not null default 'homework';
alter table public.assignment_templates drop constraint if exists assignment_templates_report_group_check;
alter table public.assignment_templates add constraint assignment_templates_report_group_check check (report_group in ('homework', 'quiz', 'other'));
