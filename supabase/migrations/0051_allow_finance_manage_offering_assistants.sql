-- default_office_hours (0048) is set from the Finance-only "Categories" page,
-- but the existing "manage offering assistants" policy only allowed
-- admin/head/hr to write to this table. Finance's update was silently
-- filtered to zero rows by RLS (no error raised), which is why office hours
-- appeared to save but then reverted to empty on reload.
alter policy "manage offering assistants" on public.offering_assistants
using (
  exists (
    select 1
    from public.course_offerings o
    where o.id = offering_assistants.offering_id
      and o.org_id = current_org_id()
      and "current_role"() = any (array['admin'::user_role, 'head'::user_role, 'hr'::user_role, 'finance'::user_role])
  )
);
