-- Weak topic submissions and monthly comments no longer go through a
-- head-approval queue: an assistant's submission counts immediately, and
-- heads get full CRUD (add/edit/delete any student's submissions and
-- monthly comment) instead of only approve/reject on their own.

-- Heads/admins can insert a topic submission directly for any student in
-- their org (previously only the enrolled assistant could insert at all).
create policy "heads add topic submissions" on public.student_topic_submissions
for insert
with check (
  org_id = current_org_id()
  and "current_role"() = any (array['admin'::user_role, 'head'::user_role])
);

-- Assistants could previously only delete their own submission while it was
-- still "pending". Submissions are now auto-approved on insert, so that
-- status is never expected to be pending — widen this to any status so
-- assistants keep the ability to undo their own mistakes.
drop policy if exists "assistants remove own pending topics" on public.student_topic_submissions;
create policy "assistants remove own topics" on public.student_topic_submissions
for delete
using (
  org_id = current_org_id()
  and assistant_id = auth.uid()
);

-- Heads/admins can create/update/delete a student's monthly comment for any
-- student in their org — previously only the enrolled assistant could write
-- to this table at all, so a head editing a comment was silently rejected
-- by RLS even if the app allowed the request through.
create policy "heads manage monthly notes" on public.student_monthly_notes
for all
using (
  org_id = current_org_id()
  and "current_role"() = any (array['admin'::user_role, 'head'::user_role])
)
with check (
  org_id = current_org_id()
  and "current_role"() = any (array['admin'::user_role, 'head'::user_role])
);
