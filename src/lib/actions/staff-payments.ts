"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type CalcMethod = "paper" | "category" | "fixed";

export type StaffPaymentRow = {
  id: string;
  name: string;
  initials: string;
  role: "head" | "assistant";
  tenureMonths: number;
  calcMethod: CalcMethod;
  payMethod: string;
  fixedSalary: number | null;
  bonusPct: number;
  lastAmount: number | null;
  lastDate: string | null;
  totalPaid: number;
  paymentsCount: number;
};

export async function listStaffPayments(): Promise<StaffPaymentRow[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, initials, role, created_at")
    .eq("org_id", orgId)
    .in("role", ["head", "assistant"]);
  if (!staff || staff.length === 0) return [];

  const staffIds = staff.map((s) => s.id);
  const { data: settings } = await supabase.from("staff_pay_settings").select("*").in("profile_id", staffIds);
  const settingsByProfile = new Map((settings ?? []).map((s) => [s.profile_id, s]));

  const { data: lines } = await supabase
    .from("salary_lines")
    .select("payee_id, period, base, bonus, deduction, status, updated_at")
    .in("payee_id", staffIds);

  const linesByProfile = new Map<string, typeof lines>();
  for (const l of lines ?? []) {
    const list = linesByProfile.get(l.payee_id) ?? [];
    list.push(l);
    linesByProfile.set(l.payee_id, list);
  }

  const now = Date.now();

  return staff
    .map((s) => {
      const setting = settingsByProfile.get(s.id);
      const myLines = (linesByProfile.get(s.id) ?? []).filter((l) => l.status === "paid");
      const periodTotals = new Map<string, number>();
      for (const l of myLines) {
        const amt = Number(l.base) + Number(l.bonus) - Number(l.deduction);
        periodTotals.set(l.period, (periodTotals.get(l.period) ?? 0) + amt);
      }
      const periods = Array.from(periodTotals.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
      const totalPaid = Array.from(periodTotals.values()).reduce((sum, v) => sum + v, 0);
      const lastPeriod = periods[0];
      const lastUpdated = myLines.length
        ? myLines.reduce((latest, l) => (l.updated_at > latest ? l.updated_at : latest), myLines[0].updated_at)
        : null;

      const months = Math.max(0, Math.round((now - new Date(s.created_at).getTime()) / (30 * 24 * 3600_000)));

      return {
        id: s.id,
        name: s.full_name,
        initials: s.initials,
        role: s.role as "head" | "assistant",
        tenureMonths: months,
        calcMethod: (setting?.calc_method as CalcMethod) ?? "paper",
        payMethod: setting?.pay_method ?? "Bank transfer",
        fixedSalary: setting?.fixed_salary != null ? Number(setting.fixed_salary) : null,
        bonusPct: setting?.bonus_pct != null ? Number(setting.bonus_pct) : 0,
        lastAmount: lastPeriod ? lastPeriod[1] : null,
        lastDate: lastUpdated,
        totalPaid,
        paymentsCount: periods.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updatePaySettings(
  profileId: string,
  patch: { calcMethod?: CalcMethod; payMethod?: string; fixedSalary?: number | null; bonusPct?: number }
) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const payload: Record<string, unknown> = { profile_id: profileId, org_id: profile.org.id, updated_at: new Date().toISOString() };
  if (patch.calcMethod !== undefined) payload.calc_method = patch.calcMethod;
  if (patch.payMethod !== undefined) payload.pay_method = patch.payMethod;
  if (patch.fixedSalary !== undefined) payload.fixed_salary = patch.fixedSalary;
  if (patch.bonusPct !== undefined) payload.bonus_pct = patch.bonusPct;

  const { error } = await supabase.from("staff_pay_settings").upsert(payload, { onConflict: "profile_id" });
  if (error) throw new Error(error.message);
}

// Every head/assistant in the org — for the "set a default calc method for
// any staff member" picker in Payroll Settings. Lighter than listStaffPayments
// (no payment history join), since this only needs to populate a dropdown.
export async function listStaffForCalcMethod(): Promise<{ id: string; name: string; role: "head" | "assistant"; calcMethod: CalcMethod }[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("org_id", orgId)
    .is("left_at", null)
    .in("role", ["head", "assistant"])
    .order("full_name", { ascending: true });
  if (!staff?.length) return [];

  const { data: settings } = await supabase
    .from("staff_pay_settings")
    .select("profile_id, calc_method")
    .in(
      "profile_id",
      staff.map((s) => s.id)
    );
  const methodByProfile = new Map((settings ?? []).map((s) => [s.profile_id, s.calc_method as CalcMethod]));

  return staff.map((s) => ({
    id: s.id,
    name: s.full_name,
    role: s.role as "head" | "assistant",
    calcMethod: methodByProfile.get(s.id) ?? "paper",
  }));
}

// Bulk-apply one calc method to every assistant currently assigned to a
// course offering — the one-at-a-time picker (here and on the Staff payments
// page) is fine for occasional exceptions, but reassigning a whole course's
// worth of assistants to a new default (e.g. after switching that course to
// bracket-based pay) shouldn't take N separate clicks.
export async function bulkSetCalcMethodForOffering(offeringId: string, calcMethod: CalcMethod): Promise<{ updated: number }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "finance" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();

  const { data: offering } = await supabase.from("course_offerings").select("org_id").eq("id", offeringId).maybeSingle();
  if (!offering || offering.org_id !== profile.org.id) throw new Error("Course not found");

  const { data: assistants } = await supabase.from("offering_assistants").select("assistant_id").eq("offering_id", offeringId);
  const assistantIds = (assistants ?? []).map((a) => a.assistant_id);
  if (!assistantIds.length) return { updated: 0 };

  const now = new Date().toISOString();
  const { error } = await supabase.from("staff_pay_settings").upsert(
    assistantIds.map((profile_id) => ({ profile_id, org_id: profile.org!.id, calc_method: calcMethod, updated_at: now })),
    { onConflict: "profile_id", ignoreDuplicates: false }
  );
  if (error) throw new Error(error.message);

  return { updated: assistantIds.length };
}
