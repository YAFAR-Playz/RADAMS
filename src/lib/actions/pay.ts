"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";

export type SalaryCourseLine = {
  course: string;
  method: string;
  basis: string | null;
  base: number;
  bonus: number;
  deduction: number;
  bonusReason: string | null;
  deductionReason: string | null;
  subtotal: number;
};

export type MyPay = {
  period: string;
  periods: string[];
  paid: boolean;
  // Whether Finance has released this period's breakdown yet — separate
  // from `paid`, which only tracks whether money was actually sent. While
  // unreleased, `courses`/`total` are withheld (not just hidden client-side)
  // so a still-being-edited number is never actually sent to the browser.
  released: boolean;
  payMethod: string;
  total: number;
  courses: SalaryCourseLine[];
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function getMyPay(period?: string): Promise<MyPay | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();

  const { data: allLines } = await supabase
    .from("salary_lines")
    .select("period")
    .eq("payee_id", profile.id)
    .order("period", { ascending: false });
  const periods = Array.from(new Set((allLines ?? []).map((l) => l.period)));
  const targetPeriod = period ?? periods[0];
  if (!targetPeriod) return { period: "", periods: [], paid: false, released: false, payMethod: "Bank transfer", total: 0, courses: [] };

  const { data: lines } = await supabase
    .from("salary_lines")
    .select(
      "offering_id, method, basis, base, bonus, deduction, bonus_reason, deduction_reason, status, released_at, pay_method, course_offerings!salary_lines_offering_id_fkey(session, unit, courses(name))"
    )
    .eq("payee_id", profile.id)
    .eq("period", targetPeriod);

  const rows = lines ?? [];
  const paid = rows.length > 0 && rows.every((l) => l.status === "paid");
  const released = rows.length > 0 && rows.every((l) => l.released_at != null);
  const payMethod = rows[0]?.pay_method ?? "Bank transfer";

  if (!released) {
    return { period: targetPeriod, periods, paid, released, payMethod, total: 0, courses: [] };
  }

  const courses: SalaryCourseLine[] = rows.map((l) => {
    const offering = Array.isArray(l.course_offerings) ? l.course_offerings[0] : l.course_offerings;
    const base = Number(l.base);
    const bonus = Number(l.bonus);
    const deduction = Number(l.deduction);
    return {
      course: offeringLabel(offering),
      method: l.method,
      basis: l.basis,
      base,
      bonus,
      deduction,
      bonusReason: l.bonus_reason,
      deductionReason: l.deduction_reason,
      subtotal: base + bonus - deduction,
    };
  });

  const total = courses.reduce((sum, c) => sum + c.subtotal, 0);

  return { period: targetPeriod, periods, paid, released, payMethod, total, courses };
}

export async function getMyReceiptUrl(period: string): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("salary_receipts")
    .select("path")
    .eq("payee_id", profile.id)
    .eq("period", period)
    .maybeSingle();
  if (!receipt) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("receipts").createSignedUrl(receipt.path, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function sendFinanceMessage(body: string, period: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase.from("finance_messages").insert({ org_id: profile.org.id, from_id: profile.id, body, period });
  if (error) throw new Error(error.message);
}
