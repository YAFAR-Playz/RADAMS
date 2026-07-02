-- Per-offering performance grade scale, set by the head who owns it.
-- "percentage" shows the raw average; "letter" maps it through grade_bands,
-- e.g. [{"label":"A","min":90},{"label":"B","min":80},...] ordered high to low.
alter table public.course_offerings
  add column grade_scale text not null default 'percentage' check (grade_scale in ('percentage', 'letter')),
  add column grade_bands jsonb;
