-- salary_receipts had RLS enabled but no policies, so it was effectively
-- inaccessible to every role. Mirror the salary_lines access pattern:
-- finance/admin manage everything in their org, payees can read their own.
create policy "finance manages salary receipts"
  on public.salary_receipts
  for all
  using (org_id = current_org_id() and "current_role"() = any (array['finance'::user_role, 'admin'::user_role]))
  with check (org_id = current_org_id() and "current_role"() = any (array['finance'::user_role, 'admin'::user_role]));

create policy "read own or finance salary receipts"
  on public.salary_receipts
  for select
  using (
    payee_id = auth.uid()
    or (org_id = current_org_id() and "current_role"() = any (array['finance'::user_role, 'admin'::user_role]))
    or "current_role"() = 'owner'::user_role
  );
