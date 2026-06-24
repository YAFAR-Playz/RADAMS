"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type SalaryLineRow = {
  id: string;
  offering: string;
  method: string;
  basis: string | null;
  base: number;
  bonus: number;
  deduction: number;
  bonusReason: string | null;
  deductionReason: string | null;
};

export type AssistantSalary = {
  payeeId: string;
  name: string;
  initials: string;
  payMethod: string;
  status: "paid" | "pending";
  lines: SalaryLineRow[];
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function listPeriods(): Promise<string[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("salary_lines").select("period").eq("org_id", orgId);
  return Array.from(new Set((data ?? []).map((d) => d.period))).sort((a, b) => (a < b ? 1 : -1));
}

export async function listSalariesForPeriod(period: string): Promise<AssistantSalary[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: lines } = await supabase
    .from("salary_lines")
    .select(
      "id, payee_id, method, basis, base, bonus, deduction, bonus_reason, deduction_reason, status, pay_method, profiles(full_name, initials), course_offerings(session, unit, courses(name))"
    )
    .eq("org_id", orgId)
    .eq("period", period);
  if (!lines || lines.length === 0) return [];

  const byPayee = new Map<string, typeof lines>();
  for (const l of lines) {
    const list = byPayee.get(l.payee_id) ?? [];
    list.push(l);
    byPayee.set(l.payee_id, list);
  }

  return Array.from(byPayee.entries())
    .map(([payeeId, rows]) => {
      const payee = Array.isArray(rows[0].profiles) ? rows[0].profiles[0] : rows[0].profiles;
      if (!payee) return null;
      const allPaid = rows.every((r) => r.status === "paid");
      return {
        payeeId,
        name: payee.full_name,
        initials: payee.initials,
        payMethod: rows[0].pay_method,
        status: allPaid ? ("paid" as const) : ("pending" as const),
        lines: rows.map((r) => {
          const offering = Array.isArray(r.course_offerings) ? r.course_offerings[0] : r.course_offerings;
          return {
            id: r.id,
            offering: offeringLabel(offering),
            method: r.method,
            basis: r.basis,
            base: Number(r.base),
            bonus: Number(r.bonus),
            deduction: Number(r.deduction),
            bonusReason: r.bonus_reason,
            deductionReason: r.deduction_reason,
          };
        }),
      };
    })
    .filter((x): x is AssistantSalary => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateSalaryLine(
  id: string,
  patch: { base?: number; bonus?: number; deduction?: number; bonusReason?: string; deductionReason?: string }
) {
  const supabase = await createClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.base !== undefined) payload.base = patch.base;
  if (patch.bonus !== undefined) payload.bonus = patch.bonus;
  if (patch.deduction !== undefined) payload.deduction = patch.deduction;
  if (patch.bonusReason !== undefined) payload.bonus_reason = patch.bonusReason || null;
  if (patch.deductionReason !== undefined) payload.deduction_reason = patch.deductionReason || null;
  const { error } = await supabase.from("salary_lines").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setPayeeStatus(payeeId: string, period: string, status: "paid" | "pending") {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase
    .from("salary_lines")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("org_id", orgId)
    .eq("payee_id", payeeId)
    .eq("period", period);
  if (error) throw new Error(error.message);
}
