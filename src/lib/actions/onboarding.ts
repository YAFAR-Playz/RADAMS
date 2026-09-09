"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { roleHasOnboardingTour } from "@/lib/onboarding-roles";

// Clones the ZAD-AMS Demo template org into a private, disposable copy and
// points the caller's own profile at it — see start_onboarding_demo in
// supabase/migrations/0059_add_onboarding_demo_tour.sql for the full
// mechanism and why a clone (rather than a shared org or an identity swap)
// was chosen.
export async function startOnboardingDemo(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  if (profile.isTouringDemo) throw new Error("Already touring a demo — exit it first");
  if (!roleHasOnboardingTour(profile.role)) throw new Error("The guided tour isn't available for your role yet");

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_onboarding_demo", { p_profile_id: profile.id, p_role: profile.role });
  if (error) throw new Error(error.message);
}

// Restores the caller's real org and deletes their cloned demo org.
// markCompleted is true only when the tour actually runs to its last step —
// exiting early (or just clicking the persistent "Exit demo" banner) leaves
// onboarding_tour_status untouched so the login prompt still comes back.
export async function exitOnboardingDemo(markCompleted: boolean): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  if (!profile.isTouringDemo) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("exit_onboarding_demo", { p_profile_id: profile.id, p_mark_completed: markCompleted });
  if (error) throw new Error(error.message);
}

export async function markOnboardingSkipped(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || profile.isTouringDemo) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarding_tour_status: "skipped" }).eq("id", profile.id);
}
