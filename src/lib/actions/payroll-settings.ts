"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type PayrollFlags = {
  salaryVisibleToHeads: boolean;
  headEditAmounts: boolean;
  assistantSeeBreakdown: boolean;
  autoRelease: boolean;
};

// Whole-feature toggles, distinct from PayrollFlags above (routine payroll
// behavior Finance can also adjust) — these turn entire new capabilities on
// or off org-wide, so only Admin can touch them (enforced in
// setOrgFeatureFlag, not just RLS, since RLS allows Finance to update
// organizations for the PayrollFlags columns).
export type OrgFeatureFlags = {
  mockExamEnabled: boolean;
  headsCanAddStudents: boolean;
  headFixedPerAssistantEnabled: boolean;
};

export type PayrollSettings = PayrollFlags & OrgFeatureFlags & { currency: string; defaultAssistantCalcMethod: string };

export async function getPayrollSettings(): Promise<PayrollSettings | null> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "currency, salary_visible_to_heads, head_edit_amounts, assistant_see_breakdown, auto_release, mock_exam_enabled, heads_can_add_students, head_fixed_per_assistant_enabled, default_assistant_calc_method"
    )
    .eq("id", orgId)
    .single();
  if (!data) return null;
  return {
    currency: data.currency,
    salaryVisibleToHeads: data.salary_visible_to_heads,
    headEditAmounts: data.head_edit_amounts,
    assistantSeeBreakdown: data.assistant_see_breakdown,
    autoRelease: data.auto_release,
    mockExamEnabled: data.mock_exam_enabled,
    headsCanAddStudents: data.heads_can_add_students,
    headFixedPerAssistantEnabled: data.head_fixed_per_assistant_enabled,
    defaultAssistantCalcMethod: data.default_assistant_calc_method,
  };
}

export async function setPayrollFlag(key: keyof PayrollFlags, value: boolean) {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) throw new Error("Not authenticated");
  const columnByKey: Record<keyof PayrollFlags, string> = {
    salaryVisibleToHeads: "salary_visible_to_heads",
    headEditAmounts: "head_edit_amounts",
    assistantSeeBreakdown: "assistant_see_breakdown",
    autoRelease: "auto_release",
  };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ [columnByKey[key]]: value }).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function setOrgFeatureFlag(key: keyof OrgFeatureFlags, value: boolean) {
  const profile = await getCurrentProfile();
  if (!profile?.org) throw new Error("Not authenticated");
  if (profile.role !== "admin") throw new Error("Not authorized");
  const columnByKey: Record<keyof OrgFeatureFlags, string> = {
    mockExamEnabled: "mock_exam_enabled",
    headsCanAddStudents: "heads_can_add_students",
    headFixedPerAssistantEnabled: "head_fixed_per_assistant_enabled",
  };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ [columnByKey[key]]: value }).eq("id", profile.org.id);
  if (error) throw new Error(error.message);
}

export async function setCurrency(currency: string) {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ currency }).eq("id", orgId);
  if (error) throw new Error(error.message);
}

// Extra recipients for the staffing-request (add/remove/replace) email
// notification, on top of every HR/Admin profile's own email (which stays
// automatic) — for reaching an inbox that isn't tied to a RadAMS account
// (a shared ops address, someone who needs visibility but no app access).
export async function getStaffingNotifyEmails(): Promise<string[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("staffing_notify_emails").eq("id", orgId).single();
  return data?.staffing_notify_emails ?? [];
}

export async function setStaffingNotifyEmails(emails: string[]) {
  const profile = await getCurrentProfile();
  if (!profile?.org) throw new Error("Not authenticated");
  if (profile.role !== "admin") throw new Error("Not authorized");
  const cleaned = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ staffing_notify_emails: cleaned }).eq("id", profile.org.id);
  if (error) throw new Error(error.message);
}
