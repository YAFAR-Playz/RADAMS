-- Two zero-behavior-change fixes flagged by Supabase's performance advisor
-- (2026-09-10):
--
-- 1. auth_rls_initplan: several RLS policies call auth.uid() directly inside
--    their qual/with_check, which Postgres re-evaluates once PER ROW instead
--    of once per statement. Wrapping it as `(select auth.uid())` lets the
--    planner treat it as an InitPlan (evaluated once, cached) — logically
--    identical, just cheaper at scale. This is Supabase's own documented fix
--    for this exact lint (see the linter's remediation link). Every policy
--    below is recreated with ALTER POLICY using the *exact* qual/with_check
--    already in place (verified live via pg_policies before writing this),
--    with only bare `auth.uid()` occurrences wrapped — no other condition
--    changes anywhere.
--
-- 2. Two policies on salary_receipts were byte-for-byte duplicates of two
--    others on the same table (identical qual/with_check, same cmd) — almost
--    certainly leftover from a rename. Dropping the older-named duplicate of
--    each pair changes nothing (the remaining policy already grants the
--    exact same access) and also reduces salary_receipts' multiple_permissive_
--    policies count.

-- assignment_logs
alter policy "log as head or own assistant" on public.assignment_logs
  using (
    exists (
      select 1
      from assignments a
        join course_offerings o on (o.id = a.offering_id)
        join enrollments e on (e.offering_id = o.id and e.student_id = assignment_logs.student_id)
      where a.id = assignment_logs.assignment_id
        and o.org_id = current_org_id()
        and ("current_role"() = any (array['admin'::user_role, 'head'::user_role]) or e.assistant_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1
      from assignments a
        join course_offerings o on (o.id = a.offering_id)
        join enrollments e on (e.offering_id = o.id and e.student_id = assignment_logs.student_id)
      where a.id = assignment_logs.assignment_id
        and o.org_id = current_org_id()
        and ("current_role"() = any (array['admin'::user_role, 'head'::user_role]) or e.assistant_id = (select auth.uid()))
    )
  );

-- salary_lines
alter policy "read own or finance salary lines" on public.salary_lines
  using (
    payee_id = (select auth.uid())
    or (org_id = current_org_id() and "current_role"() = any (array['finance'::user_role, 'admin'::user_role]))
    or "current_role"() = 'owner'::user_role
  );

-- staffing_requests
alter policy "manage own staffing requests" on public.staffing_requests
  using (
    org_id = current_org_id()
    and (requested_by = (select auth.uid()) or "current_role"() = any (array['admin'::user_role, 'hr'::user_role]))
  )
  with check (
    org_id = current_org_id()
    and "current_role"() = any (array['admin'::user_role, 'head'::user_role, 'hr'::user_role])
  );

-- evaluations
alter policy "read own or finance evaluations" on public.evaluations
  using (
    head_id = (select auth.uid())
    or assistant_id = (select auth.uid())
    or (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'finance'::user_role, 'hr'::user_role]))
    or "current_role"() = 'owner'::user_role
  );

alter policy "head manages own evaluations" on public.evaluations
  using (head_id = (select auth.uid()) and org_id = current_org_id())
  with check (head_id = (select auth.uid()) and org_id = current_org_id());

-- evaluation_lines
alter policy "read own or finance evaluation lines" on public.evaluation_lines
  using (
    exists (
      select 1 from evaluations e
      where e.id = evaluation_lines.evaluation_id
        and (
          e.head_id = (select auth.uid())
          or e.assistant_id = (select auth.uid())
          or (e.org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'finance'::user_role]))
          or "current_role"() = 'owner'::user_role
        )
    )
  );

alter policy "head manages own evaluation lines" on public.evaluation_lines
  using (exists (select 1 from evaluations e where e.id = evaluation_lines.evaluation_id and e.head_id = (select auth.uid())))
  with check (exists (select 1 from evaluations e where e.id = evaluation_lines.evaluation_id and e.head_id = (select auth.uid())));

-- staff_pay_settings
alter policy "read own or finance pay settings" on public.staff_pay_settings
  using (
    profile_id = (select auth.uid())
    or (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'finance'::user_role]))
    or "current_role"() = 'owner'::user_role
  );

-- salary_receipts: drop the two exact-duplicate policies, then fix auth.uid()
-- caching on the ones that remain.
drop policy if exists "finance manages receipts" on public.salary_receipts;
drop policy if exists "read own or finance receipts" on public.salary_receipts;

alter policy "read own or finance salary receipts" on public.salary_receipts
  using (
    payee_id = (select auth.uid())
    or (org_id = current_org_id() and "current_role"() = any (array['finance'::user_role, 'admin'::user_role]))
    or "current_role"() = 'owner'::user_role
  );

-- student_topic_submissions
alter policy "assistants submit topics" on public.student_topic_submissions
  with check (
    org_id = current_org_id()
    and assistant_id = (select auth.uid())
    and exists (
      select 1 from enrollments e
      where e.student_id = student_topic_submissions.student_id
        and e.offering_id = student_topic_submissions.offering_id
        and e.assistant_id = (select auth.uid())
    )
  );

alter policy "assistants remove own topics" on public.student_topic_submissions
  using (org_id = current_org_id() and assistant_id = (select auth.uid()));

-- chat_conversation_members
alter policy "members update their own membership row" on public.chat_conversation_members
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- chat_messages
alter policy "members send messages in their conversations" on public.chat_messages
  with check (sender_id = (select auth.uid()) and is_chat_member(conversation_id));

-- finance_messages
alter policy "send finance message" on public.finance_messages
  with check (
    org_id = current_org_id()
    and from_id = (select auth.uid())
    and (payee_id = from_id or "current_role"() = any (array['finance'::user_role, 'admin'::user_role]))
  );

alter policy "read own or finance messages" on public.finance_messages
  using (
    from_id = (select auth.uid())
    or payee_id = (select auth.uid())
    or (org_id = current_org_id() and "current_role"() = any (array['finance'::user_role, 'admin'::user_role]))
    or "current_role"() = 'owner'::user_role
  );

-- student_monthly_notes
alter policy "assistants manage own monthly notes" on public.student_monthly_notes
  using (
    org_id = current_org_id()
    and exists (
      select 1 from enrollments e
      where e.student_id = student_monthly_notes.student_id
        and e.offering_id = student_monthly_notes.offering_id
        and e.assistant_id = (select auth.uid())
    )
  )
  with check (
    org_id = current_org_id()
    and assistant_id = (select auth.uid())
    and exists (
      select 1 from enrollments e
      where e.student_id = student_monthly_notes.student_id
        and e.offering_id = student_monthly_notes.offering_id
        and e.assistant_id = (select auth.uid())
    )
  );

-- staff_contracts
alter policy "read own or hr admin staff contracts" on public.staff_contracts
  using (
    staff_id = (select auth.uid())
    or (org_id = current_org_id() and "current_role"() = any (array['admin'::user_role, 'hr'::user_role]))
    or "current_role"() = 'owner'::user_role
  );

-- profiles
alter policy "read own profile or org" on public.profiles
  using (
    id = (select auth.uid())
    or org_id = current_org_id()
    or "current_role"() = 'owner'::user_role
    or org_id = '8cfc8e75-4211-427e-b1b7-09d3b786c1ac'::uuid
  );
