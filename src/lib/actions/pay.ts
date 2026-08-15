"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { currencySymbol } from "@/lib/currency";

export type EvaluationItem = {
  category: string | null;
  note: string | null;
  amount: number;
};

export type SalaryCourseLine = {
  course: string;
  method: string;
  basis: string | null;
  base: number;
  bonus: number;
  deduction: number;
  bonusReason: string | null;
  deductionReason: string | null;
  // Itemized breakdown behind the bonus/deduction totals, from the head's
  // evaluation for this course/period — a lump "From head evaluation" reason
  // isn't enough for the assistant to know WHAT the extra work or penalty
  // actually was, so each individual eval line (category + note + amount)
  // is surfaced here when one generated the total.
  extraItems: EvaluationItem[];
  deductionItems: EvaluationItem[];
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
  currency: string;
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
  const { data: org } = profile.org
    ? await supabase.from("organizations").select("currency").eq("id", profile.org.id).single()
    : { data: null };
  const currency = currencySymbol(org?.currency);

  const { data: allLines } = await supabase
    .from("salary_lines")
    .select("period")
    .eq("payee_id", profile.id)
    .order("period", { ascending: false });
  const periods = Array.from(new Set((allLines ?? []).map((l) => l.period)));
  const targetPeriod = period ?? periods[0];
  if (!targetPeriod)
    return { period: "", periods: [], paid: false, released: false, payMethod: "Bank transfer", currency, total: 0, courses: [] };

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
    return { period: targetPeriod, periods, paid, released, payMethod, currency, total: 0, courses: [] };
  }

  const offeringIds = Array.from(new Set(rows.map((l) => l.offering_id).filter((id): id is string => !!id)));
  const { data: evalRows } = offeringIds.length
    ? await supabase
        .from("evaluations")
        .select("offering_id, evaluation_lines(kind, category, note, amount)")
        .eq("assistant_id", profile.id)
        .eq("period", targetPeriod)
        .in("offering_id", offeringIds)
    : { data: [] };
  const evalByOffering = new Map<string, { extras: EvaluationItem[]; deductions: EvaluationItem[] }>();
  for (const ev of evalRows ?? []) {
    const evLines = Array.isArray(ev.evaluation_lines) ? ev.evaluation_lines : [];
    const toItem = (l: (typeof evLines)[number]) => ({ category: l.category, note: l.note, amount: Number(l.amount) });
    evalByOffering.set(ev.offering_id, {
      extras: evLines.filter((l) => l.kind === "extra").map(toItem),
      deductions: evLines.filter((l) => l.kind === "deduction").map(toItem),
    });
  }

  const courses: SalaryCourseLine[] = rows.map((l) => {
    const offering = Array.isArray(l.course_offerings) ? l.course_offerings[0] : l.course_offerings;
    const base = Number(l.base);
    const bonus = Number(l.bonus);
    const deduction = Number(l.deduction);
    const evalItems = l.offering_id ? evalByOffering.get(l.offering_id) : undefined;
    return {
      course: offeringLabel(offering),
      method: l.method,
      basis: l.basis,
      base,
      bonus,
      deduction,
      bonusReason: l.bonus_reason,
      deductionReason: l.deduction_reason,
      extraItems: evalItems?.extras ?? [],
      deductionItems: evalItems?.deductions ?? [],
      subtotal: base + bonus - deduction,
    };
  });

  const total = courses.reduce((sum, c) => sum + c.subtotal, 0);

  return { period: targetPeriod, periods, paid, released, payMethod, currency, total, courses };
}

// Whether this payee has a period that's fully released but they haven't
// opened My Pay since — drives the nav sidebar's red dot. Compared against
// profiles.pay_viewed_at rather than a per-period table, so opening My Pay
// at all clears it (like a normal "new" indicator), not just viewing the
// specific period that triggered it.
export async function hasUnviewedReleasedPay(): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile) return false;
  const supabase = await createClient();

  const [{ data: lines }, { data: viewedRow }] = await Promise.all([
    supabase.from("salary_lines").select("period, released_at").eq("payee_id", profile.id),
    supabase.from("profiles").select("pay_viewed_at").eq("id", profile.id).single(),
  ]);
  if (!lines || lines.length === 0) return false;

  const byPeriod = new Map<string, { allReleased: boolean; maxReleasedAt: string }>();
  for (const l of lines) {
    const entry = byPeriod.get(l.period) ?? { allReleased: true, maxReleasedAt: "" };
    entry.allReleased = entry.allReleased && l.released_at != null;
    if (l.released_at && l.released_at > entry.maxReleasedAt) entry.maxReleasedAt = l.released_at;
    byPeriod.set(l.period, entry);
  }

  const latestRelease = Array.from(byPeriod.values())
    .filter((p) => p.allReleased)
    .reduce((max, p) => (p.maxReleasedAt > max ? p.maxReleasedAt : max), "");
  if (!latestRelease) return false;

  const viewedAt = viewedRow?.pay_viewed_at ?? "";
  return latestRelease > viewedAt;
}

export async function markPayViewed() {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const admin = createAdminClient();
  await admin.from("profiles").update({ pay_viewed_at: new Date().toISOString() }).eq("id", profile.id);
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
