-- Split generic 'drive' documents into purpose-specific kinds so the
-- monthly report can render dedicated Notes / Tricky Questions sections
-- (previously both were the same generic 'drive' kind, distinguished only
-- by free-text label, if at all).
alter table topic_materials drop constraint topic_materials_kind_check;
update topic_materials set kind = 'notes' where kind = 'drive';
alter table topic_materials add constraint topic_materials_kind_check
  check (kind = any (array['video'::text, 'notes'::text, 'tricky_question'::text]));

-- More monthly-report sections beyond homework/quiz/other.
alter table assignment_templates drop constraint assignment_templates_report_group_check;
alter table assignment_templates add constraint assignment_templates_report_group_check
  check (report_group = any (array['homework'::text, 'classwork'::text, 'quiz'::text, 'mock_exam'::text, 'other'::text]));
