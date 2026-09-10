-- The demo template org's evaluations (added after the fact — see
-- scripts/seed-demo-org.ts) were never copied into a cloned demo org, so
-- Finance/Admin's Evaluations tab was permanently "No evaluations match
-- these filters" in every tour session, even though salary_lines already
-- reference the exact same bonus/deduction reasons. Copies evaluations
-- (remapped to the clone's own offering ids via _offering_map) and their
-- evaluation_lines into the clone, alongside everything else
-- start_onboarding_demo() already clones.
create or replace function public.start_onboarding_demo(p_profile_id uuid, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_template_org_id uuid := '8cfc8e75-4211-427e-b1b7-09d3b786c1ac';
  v_new_org_id uuid;
  v_real_org_id uuid;
  v_period text;
begin
  if auth.uid() is null or p_profile_id != auth.uid() then
    raise exception 'Not authorized';
  end if;

  if exists (select 1 from profiles where id = p_profile_id and pre_demo_org_id is not null) then
    raise exception 'Already touring a demo org';
  end if;

  insert into organizations (
    name, brand_name, logo_letter, primary_color, corner, currency,
    salary_visible_to_heads, head_edit_amounts, assistant_see_breakdown, auto_release,
    secondary_color, font, logo_url, status, parent_whatsapp_link, traffic_light_bands,
    report_show_weak_topics, report_show_comment, report_group_by_type, mock_exam_enabled,
    heads_can_add_students, head_fixed_per_assistant_enabled, next_student_code,
    report_show_average_grade, staffing_notify_emails, default_assistant_calc_method,
    staff_reports_use_platform_branding
  )
  select
    name, brand_name, logo_letter, primary_color, corner, currency,
    salary_visible_to_heads, head_edit_amounts, assistant_see_breakdown, auto_release,
    secondary_color, font, logo_url, status, parent_whatsapp_link, traffic_light_bands,
    report_show_weak_topics, report_show_comment, report_group_by_type, mock_exam_enabled,
    heads_can_add_students, head_fixed_per_assistant_enabled, next_student_code,
    report_show_average_grade, staffing_notify_emails, default_assistant_calc_method,
    staff_reports_use_platform_branding
  from organizations where id = v_template_org_id
  returning id into v_new_org_id;

  if v_new_org_id is null then
    raise exception 'Demo template organization is not set up yet';
  end if;

  create temporary table _course_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _offering_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _student_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _assignment_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _session_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _payment_plan_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _topic_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  create temporary table _evaluation_map (old_id uuid primary key, new_id uuid not null) on commit drop;

  insert into _course_map (old_id, new_id)
    select id, gen_random_uuid() from courses where org_id = v_template_org_id;
  insert into courses (id, org_id, name, created_at)
    select m.new_id, v_new_org_id, c.name, c.created_at
    from courses c join _course_map m on m.old_id = c.id;

  insert into _topic_map (old_id, new_id)
    select id, gen_random_uuid() from topic_catalog where org_id = v_template_org_id;
  insert into topic_catalog (id, org_id, course_id, label, created_by, created_at)
    select tm.new_id, v_new_org_id, cm.new_id, t.label, t.created_by, t.created_at
    from topic_catalog t
    join _topic_map tm on tm.old_id = t.id
    left join _course_map cm on cm.old_id = t.course_id;
  insert into topic_materials (id, topic_id, kind, label, link, duration, sort_order, created_at)
    select gen_random_uuid(), tm.new_id, tmat.kind, tmat.label, tmat.link, tmat.duration, tmat.sort_order, tmat.created_at
    from topic_materials tmat
    join _topic_map tm on tm.old_id = tmat.topic_id;

  insert into _offering_map (old_id, new_id)
    select id, gen_random_uuid() from course_offerings where org_id = v_template_org_id;
  insert into course_offerings (
    id, org_id, course_id, session, unit, created_at, start_date, end_date, active,
    fee_full, fee_installment_total, installment_count, grade_scale, grade_bands, parent_whatsapp_link
  )
    select om.new_id, v_new_org_id, cm.new_id, co.session, co.unit, co.created_at, co.start_date, co.end_date, co.active,
           co.fee_full, co.fee_installment_total, co.installment_count, co.grade_scale, co.grade_bands, co.parent_whatsapp_link
    from course_offerings co
    join _offering_map om on om.old_id = co.id
    join _course_map cm on cm.old_id = co.course_id;

  insert into _student_map (old_id, new_id)
    select id, gen_random_uuid() from students where org_id = v_template_org_id;
  insert into students (id, org_id, name, initials, guardian_name, guardian_phone, created_at, email, left_at, phone, student_code, drive_folder_link)
    select sm.new_id, v_new_org_id, s.name, s.initials, s.guardian_name, s.guardian_phone, s.created_at, s.email, s.left_at, s.phone, s.student_code, s.drive_folder_link
    from students s join _student_map sm on sm.old_id = s.id;

  insert into enrollments (id, student_id, offering_id, assistant_id, created_at, target_grade, left_at)
    select gen_random_uuid(), sm.new_id, om.new_id, e.assistant_id, e.created_at, e.target_grade, e.left_at
    from enrollments e
    join _student_map sm on sm.old_id = e.student_id
    join _offering_map om on om.old_id = e.offering_id;

  insert into offering_heads (offering_id, head_id)
    select om.new_id, oh.head_id from offering_heads oh join _offering_map om on om.old_id = oh.offering_id;

  insert into offering_assistants (offering_id, assistant_id, joined_at, max_students, default_office_hours)
    select om.new_id, oa.assistant_id, oa.joined_at, oa.max_students, oa.default_office_hours
    from offering_assistants oa join _offering_map om on om.old_id = oa.offering_id;

  insert into _assignment_map (old_id, new_id)
    select a.id, gen_random_uuid() from assignments a join _offering_map om on om.old_id = a.offering_id;
  insert into assignments (
    id, offering_id, title, max_marks, due_date, lettered, created_by, created_at, template,
    grade_scheme, counts_salary, message_template, closed_at, include_in_report, template_id,
    default_comment, mock_exam
  )
    select am.new_id, om.new_id, a.title, a.max_marks, a.due_date, a.lettered, a.created_by, a.created_at, a.template,
           a.grade_scheme, a.counts_salary, a.message_template, a.closed_at, a.include_in_report, a.template_id,
           a.default_comment, a.mock_exam
    from assignments a
    join _assignment_map am on am.old_id = a.id
    join _offering_map om on om.old_id = a.offering_id;

  insert into assignment_logs (id, assignment_id, student_id, status, grade, comment, sent_at, logged_by, updated_at, recipient)
    select gen_random_uuid(), am.new_id, sm.new_id, al.status, al.grade, al.comment, al.sent_at, al.logged_by, al.updated_at, al.recipient
    from assignment_logs al
    join _assignment_map am on am.old_id = al.assignment_id
    join _student_map sm on sm.old_id = al.student_id;

  insert into _session_map (old_id, new_id)
    select ats.id, gen_random_uuid() from attendance_sessions ats join _offering_map om on om.old_id = ats.offering_id;
  insert into attendance_sessions (id, offering_id, title, session_date, session_time, created_by, created_at)
    select sesm.new_id, om.new_id, ats.title, ats.session_date, ats.session_time, ats.created_by, ats.created_at
    from attendance_sessions ats
    join _session_map sesm on sesm.old_id = ats.id
    join _offering_map om on om.old_id = ats.offering_id;

  insert into attendance_records (id, session_id, student_id, status, updated_at)
    select gen_random_uuid(), sesm.new_id, sm.new_id, ar.status, ar.updated_at
    from attendance_records ar
    join _session_map sesm on sesm.old_id = ar.session_id
    join _student_map sm on sm.old_id = ar.student_id;

  insert into _payment_plan_map (old_id, new_id)
    select pp.id, gen_random_uuid()
    from payment_plans pp
    join _student_map sm on sm.old_id = pp.student_id
    join _offering_map om on om.old_id = pp.offering_id;
  insert into payment_plans (id, student_id, offering_id, plan_type, total_amount, installment_count, created_at, discount_pct)
    select ppm.new_id, sm.new_id, om.new_id, pp.plan_type, pp.total_amount, pp.installment_count, pp.created_at, pp.discount_pct
    from payment_plans pp
    join _payment_plan_map ppm on ppm.old_id = pp.id
    join _student_map sm on sm.old_id = pp.student_id
    join _offering_map om on om.old_id = pp.offering_id;

  insert into payment_installments (id, plan_id, seq, amount, due_date, status, paid_at)
    select gen_random_uuid(), ppm.new_id, pi.seq, pi.amount, pi.due_date, pi.status, pi.paid_at
    from payment_installments pi
    join _payment_plan_map ppm on ppm.old_id = pi.plan_id;

  insert into salary_lines (
    id, org_id, payee_id, offering_id, period, method, basis, base, bonus, deduction,
    bonus_reason, deduction_reason, status, pay_method, created_at, updated_at, calc_method,
    office_hours, office_hours_offering_id, released_at
  )
    select gen_random_uuid(), v_new_org_id, sl.payee_id, om.new_id, sl.period, sl.method, sl.basis, sl.base, sl.bonus, sl.deduction,
           sl.bonus_reason, sl.deduction_reason, sl.status, sl.pay_method, sl.created_at, sl.updated_at, sl.calc_method,
           sl.office_hours, om2.new_id, sl.released_at
    from salary_lines sl
    left join _offering_map om on om.old_id = sl.offering_id
    left join _offering_map om2 on om2.old_id = sl.office_hours_offering_id
    where sl.org_id = v_template_org_id;

  insert into _evaluation_map (old_id, new_id)
    select id, gen_random_uuid() from evaluations where org_id = v_template_org_id;
  insert into evaluations (id, org_id, head_id, assistant_id, offering_id, period, base_amount, notes, rating, status, created_at, updated_at)
    select em.new_id, v_new_org_id, e.head_id, e.assistant_id, om.new_id, e.period, e.base_amount, e.notes, e.rating, e.status, e.created_at, e.updated_at
    from evaluations e
    join _evaluation_map em on em.old_id = e.id
    join _offering_map om on om.old_id = e.offering_id;

  insert into evaluation_lines (id, evaluation_id, kind, category, note, qty, sub, amount, created_at)
    select gen_random_uuid(), em.new_id, el.kind, el.category, el.note, el.qty, el.sub, el.amount, el.created_at
    from evaluation_lines el
    join _evaluation_map em on em.old_id = el.evaluation_id;

  insert into staffing_requests (
    id, org_id, offering_id, kind, target_assistant_id, candidate_name, candidate_phone,
    candidate_email, reason, status, requested_by, created_at, proposed_date, gave_notice, leave_date
  )
    select gen_random_uuid(), v_new_org_id, om.new_id, sr.kind, sr.target_assistant_id, sr.candidate_name, sr.candidate_phone,
           sr.candidate_email, sr.reason, sr.status, sr.requested_by, sr.created_at, sr.proposed_date, sr.gave_notice, sr.leave_date
    from staffing_requests sr
    left join _offering_map om on om.old_id = sr.offering_id
    where sr.org_id = v_template_org_id;

  insert into pay_categories (id, org_id, kind, label, mode, rate, sort_order, created_at, offering_id)
    select gen_random_uuid(), v_new_org_id, pc.kind, pc.label, pc.mode, pc.rate, pc.sort_order, pc.created_at, om.new_id
    from pay_categories pc
    left join _offering_map om on om.old_id = pc.offering_id
    where pc.org_id = v_template_org_id;

  insert into pay_brackets (id, org_id, name, lo, hi, pay, sort_order, offering_id)
    select gen_random_uuid(), v_new_org_id, pb.name, pb.lo, pb.hi, pb.pay, pb.sort_order, om.new_id
    from pay_brackets pb
    left join _offering_map om on om.old_id = pb.offering_id
    where pb.org_id = v_template_org_id;

  insert into other_rates (id, org_id, label, unit, rate, sort_order, offering_id)
    select gen_random_uuid(), v_new_org_id, r.label, r.unit, r.rate, r.sort_order, om.new_id
    from other_rates r
    left join _offering_map om on om.old_id = r.offering_id
    where r.org_id = v_template_org_id;

  insert into staffing_log (id, org_id, kind, target_name, target_role, hire_date, leave_date, created_at, gave_notice)
    select gen_random_uuid(), v_new_org_id, sl.kind, sl.target_name, sl.target_role, sl.hire_date, sl.leave_date, sl.created_at, sl.gave_notice
    from staffing_log sl
    where sl.org_id = v_template_org_id;

  select max(period) into v_period from salary_lines where org_id = v_new_org_id;

  if p_role = 'head' then
    insert into offering_heads (offering_id, head_id)
      select new_id, p_profile_id from _offering_map limit 2
      on conflict do nothing;

    insert into salary_lines (id, org_id, payee_id, offering_id, period, method, basis, base, status, pay_method, created_at, updated_at, calc_method, released_at)
      select gen_random_uuid(), v_new_org_id, p_profile_id, om.new_id, coalesce(v_period, to_char(now(), 'YYYY-MM')),
             'Fixed', 'Head oversight stipend', 650, 'paid', 'Bank transfer', now(), now(), 'fixed', now()
      from _offering_map om
      limit 1;
  elsif p_role = 'assistant' then
    insert into offering_assistants (offering_id, assistant_id, joined_at)
      select new_id, p_profile_id, now() from _offering_map limit 2
      on conflict do nothing;
    update enrollments set assistant_id = p_profile_id
      where offering_id in (select new_id from _offering_map limit 2)
        and id in (
          select id from enrollments
          where offering_id in (select new_id from _offering_map limit 2)
          order by created_at limit 6
        );

    insert into salary_lines (id, org_id, payee_id, offering_id, period, method, basis, base, status, pay_method, created_at, updated_at, calc_method, released_at)
      select gen_random_uuid(), v_new_org_id, p_profile_id, om.new_id, coalesce(v_period, to_char(now(), 'YYYY-MM')),
             'Per paper', '140 papers × $8', 1120, 'paid', 'Bank transfer', now(), now(), 'per_paper', now()
      from _offering_map om
      limit 1;
  end if;

  select org_id into v_real_org_id from profiles where id = p_profile_id;
  update profiles set pre_demo_org_id = v_real_org_id, org_id = v_new_org_id where id = p_profile_id;

  return v_new_org_id;
end;
$$;
