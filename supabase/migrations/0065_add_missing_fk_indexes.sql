-- Adds a covering index for every foreign-key column flagged by Supabase's
-- performance advisor (unindexed_foreign_keys) as of 2026-09-10. Purely
-- additive — no behavior change, only faster joins/deletes/cascade checks
-- on these columns. IF NOT EXISTS makes this safe to re-run.

create index if not exists idx_activity_log_actor_id on public.activity_log (actor_id);

create index if not exists idx_assignment_assistants_assistant_id on public.assignment_assistants (assistant_id);

create index if not exists idx_assignment_logs_logged_by on public.assignment_logs (logged_by);
create index if not exists idx_assignment_logs_student_id on public.assignment_logs (student_id);

create index if not exists idx_assignments_created_by on public.assignments (created_by);
create index if not exists idx_assignments_offering_id on public.assignments (offering_id);
create index if not exists idx_assignments_template_id on public.assignments (template_id);

create index if not exists idx_attendance_records_student_id on public.attendance_records (student_id);

create index if not exists idx_attendance_sessions_created_by on public.attendance_sessions (created_by);
create index if not exists idx_attendance_sessions_offering_id on public.attendance_sessions (offering_id);

create index if not exists idx_chat_messages_sender_id on public.chat_messages (sender_id);

create index if not exists idx_course_offerings_course_id on public.course_offerings (course_id);
create index if not exists idx_course_offerings_org_id on public.course_offerings (org_id);

create index if not exists idx_courses_org_id on public.courses (org_id);

create index if not exists idx_enrollments_assistant_id on public.enrollments (assistant_id);
create index if not exists idx_enrollments_offering_id on public.enrollments (offering_id);

create index if not exists idx_evaluation_lines_evaluation_id on public.evaluation_lines (evaluation_id);

create index if not exists idx_evaluations_assistant_id on public.evaluations (assistant_id);
create index if not exists idx_evaluations_offering_id on public.evaluations (offering_id);
create index if not exists idx_evaluations_org_id on public.evaluations (org_id);

create index if not exists idx_finance_messages_from_id on public.finance_messages (from_id);
create index if not exists idx_finance_messages_org_id on public.finance_messages (org_id);
create index if not exists idx_finance_messages_payee_id on public.finance_messages (payee_id);

create index if not exists idx_monthly_report_generations_created_by on public.monthly_report_generations (created_by);
create index if not exists idx_monthly_report_generations_org_id on public.monthly_report_generations (org_id);

create index if not exists idx_monthly_report_students_student_id on public.monthly_report_students (student_id);

create index if not exists idx_offering_assistants_assistant_id on public.offering_assistants (assistant_id);

create index if not exists idx_offering_heads_head_id on public.offering_heads (head_id);

create index if not exists idx_other_rates_offering_id on public.other_rates (offering_id);

create index if not exists idx_pay_brackets_offering_id on public.pay_brackets (offering_id);
create index if not exists idx_pay_brackets_org_id on public.pay_brackets (org_id);

create index if not exists idx_pay_categories_offering_id on public.pay_categories (offering_id);

create index if not exists idx_pay_category_options_category_id on public.pay_category_options (category_id);

create index if not exists idx_payment_plans_offering_id on public.payment_plans (offering_id);

create index if not exists idx_profiles_org_id on public.profiles (org_id);
create index if not exists idx_profiles_pre_demo_org_id on public.profiles (pre_demo_org_id);

create index if not exists idx_salary_lines_offering_id on public.salary_lines (offering_id);
create index if not exists idx_salary_lines_office_hours_offering_id on public.salary_lines (office_hours_offering_id);
create index if not exists idx_salary_lines_payee_id on public.salary_lines (payee_id);

create index if not exists idx_salary_receipts_payee_id on public.salary_receipts (payee_id);
create index if not exists idx_salary_receipts_uploaded_by on public.salary_receipts (uploaded_by);

create index if not exists idx_staff_contracts_org_id on public.staff_contracts (org_id);
create index if not exists idx_staff_contracts_staff_id on public.staff_contracts (staff_id);
create index if not exists idx_staff_contracts_uploaded_by on public.staff_contracts (uploaded_by);

create index if not exists idx_staff_pay_settings_org_id on public.staff_pay_settings (org_id);

create index if not exists idx_staff_report_generations_generated_by on public.staff_report_generations (generated_by);
create index if not exists idx_staff_report_generations_org_id on public.staff_report_generations (org_id);
create index if not exists idx_staff_report_generations_staff_id on public.staff_report_generations (staff_id);

create index if not exists idx_staffing_log_org_id on public.staffing_log (org_id);

create index if not exists idx_staffing_requests_offering_id on public.staffing_requests (offering_id);
create index if not exists idx_staffing_requests_org_id on public.staffing_requests (org_id);
create index if not exists idx_staffing_requests_requested_by on public.staffing_requests (requested_by);
create index if not exists idx_staffing_requests_target_assistant_id on public.staffing_requests (target_assistant_id);

create index if not exists idx_student_monthly_notes_assistant_id on public.student_monthly_notes (assistant_id);
create index if not exists idx_student_monthly_notes_org_id on public.student_monthly_notes (org_id);

create index if not exists idx_student_topic_submissions_assistant_id on public.student_topic_submissions (assistant_id);
create index if not exists idx_student_topic_submissions_reviewed_by on public.student_topic_submissions (reviewed_by);
create index if not exists idx_student_topic_submissions_topic_id on public.student_topic_submissions (topic_id);

create index if not exists idx_topic_catalog_created_by on public.topic_catalog (created_by);
