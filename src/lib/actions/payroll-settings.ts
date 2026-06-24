"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type PayrollFlags = {
  salaryVisibleToHeads: boolean;
  headEditAmounts: boolean;
  assistantSeeBreakdown: boolean;
  autoRelease: boolean;
};

export type PayrollSettings = PayrollFlags & { currency: string };

export async function getPayrollSettings(): Promise<PayrollSettings | null> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("currency, salary_visible_to_heads, head_edit_amounts, assistant_see_breakdown, auto_release")
    .eq("id", orgId)
    .single();
  if (!data) return null;
  return {
    currency: data.currency,
    salaryVisibleToHeads: data.salary_visible_to_heads,
    headEditAmounts: data.head_edit_amounts,
    assistantSeeBreakdown: data.assistant_see_breakdown,
    autoRelease: data.auto_release,
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

export async function setCurrency(currency: string) {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ currency }).eq("id", orgId);
  if (error) throw new Error(error.message);
}
