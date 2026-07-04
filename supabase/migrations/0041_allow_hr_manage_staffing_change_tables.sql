drop policy if exists "manage offering assistants" on offering_assistants;
create policy "manage offering assistants" on offering_assistants
  for all using (
    exists (select 1 from course_offerings o where o.id = offering_assistants.offering_id and o.org_id = public.current_org_id() and public.current_role() in ('admin','head','hr'))
  );

drop policy if exists "manage enrollments" on enrollments;
create policy "manage enrollments" on enrollments
  for all using (
    exists (select 1 from course_offerings o where o.id = enrollments.offering_id and o.org_id = public.current_org_id() and public.current_role() in ('admin','head','registration','hr'))
  );
