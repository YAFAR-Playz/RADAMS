-- Colleague profiles (the other heads/assistants/etc. a tourer sees as
-- coworkers) permanently live in the ZAD-AMS Demo template org — see
-- scripts/seed-demo-org.ts — and are only ever linked into a tourer's
-- disposable clone via fresh offering_heads/offering_assistants rows, never
-- duplicated. Without this, the existing "read own profile or org" RLS
-- policy (org_id = current_org_id()) hides them entirely from the tourer
-- (whose current_org_id() is their clone, not the template), so every
-- screen that resolves a colleague's name via a profiles join/embed shows
-- blank/"Unassigned" even though the underlying foreign key is set
-- correctly — confirmed live while testing the onboarding tour.
--
-- These colleague accounts are synthetic, non-sensitive placeholders
-- (fake names, @demo.zadams.internal emails, no real PII), so making them
-- readable by any authenticated user is an acceptable trade-off against
-- duplicating profiles (and their required auth.users rows) per tour
-- session, which would need its own cleanup story.
alter policy "read own profile or org" on public.profiles
  using (
    id = auth.uid()
    or org_id = current_org_id()
    or "current_role"() = 'owner'
    or org_id = '8cfc8e75-4211-427e-b1b7-09d3b786c1ac'::uuid
  );
