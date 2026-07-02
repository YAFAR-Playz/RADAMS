"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";

const ALLOWED_RECEIPT_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type SalaryLineRow = {
  id: string;
  offeringId: string | null;
  offering: string;
  method: string;
  calcMethod: "per_paper" | "bracket" | "manual" | null;
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
      "id, payee_id, offering_id, method, calc_method, basis, base, bonus, deduction, bonus_reason, deduction_reason, status, pay_method, profiles(full_name, initials), course_offerings(session, unit, courses(name))"
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
            offeringId: r.offering_id,
            offering: offeringLabel(offering),
            method: r.method,
            calcMethod: r.calc_method as SalaryLineRow["calcMethod"],
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

  const { data: payee } = await supabase.from("profiles").select("full_name").eq("id", payeeId).single();
  await logActivity("payments", `Marked ${payee?.full_name ?? "a payee"} as ${status} for ${period}`);
}

// Optional proof-of-payment attached when marking a payee paid. Storage lives
// in a private bucket — only ever accessed through the admin client, gated
// by the salary_receipts RLS policy (finance/admin, or the payee themself).
export async function uploadSalaryReceipt(payeeId: string, period: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "finance" && profile.role !== "admin")) throw new Error("Not authorized");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) throw new Error("Receipt must be a PDF, PNG, JPG or WEBP file");
  if (file.size > MAX_RECEIPT_BYTES) throw new Error("Receipt must be under 5MB");

  const admin = createAdminClient();
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${profile.org.id}/${payeeId}/${period}.${ext}`;

  const { data: existing } = await admin.storage.from("receipts").list(`${profile.org.id}/${payeeId}`, { search: period });
  const stale = (existing ?? []).map((f) => `${profile.org!.id}/${payeeId}/${f.name}`);
  if (stale.length) await admin.storage.from("receipts").remove(stale);

  const { error: uploadError } = await admin.storage.from("receipts").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await admin
    .from("salary_receipts")
    .upsert(
      { org_id: profile.org.id, payee_id: payeeId, period, path, uploaded_by: profile.id },
      { onConflict: "org_id,payee_id,period" }
    );
  if (error) throw new Error(error.message);
}

export async function getSalaryReceiptUrl(payeeId: string, period: string): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data: receipt } = await supabase
    .from("salary_receipts")
    .select("path")
    .eq("payee_id", payeeId)
    .eq("period", period)
    .maybeSingle();
  if (!receipt) return null;

  const admin = createAdminClient();
  const { data, error } = await admin.storage.from("receipts").createSignedUrl(receipt.path, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}

// "Papers checked" for an assistant on an offering, within a period, is the
// number of that assistant's assigned students (via enrollments.assistant_id
// for that offering) whose assignment_log status is "checked" on an
// assignment due — or if undated, created — within that calendar month.
async function countCheckedPapers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringId: string,
  assistantId: string,
  period: string
): Promise<number> {
  const [y, m] = period.split("-").map(Number);
  const monthStart = `${period}-01`;
  const monthEnd = new Date(y, m, 1).toISOString().slice(0, 10);

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, due_date, created_at")
    .eq("offering_id", offeringId);
  const assignmentIds = (assignments ?? [])
    .filter((a) => {
      const d = a.due_date ?? a.created_at.slice(0, 10);
      return d >= monthStart && d < monthEnd;
    })
    .map((a) => a.id);
  if (!assignmentIds.length) return 0;

  const { data: studentRows } = await supabase.from("enrollments").select("student_id").eq("offering_id", offeringId).eq("assistant_id", assistantId);
  const studentIds = (studentRows ?? []).map((s) => s.student_id);
  if (!studentIds.length) return 0;

  const { count } = await supabase
    .from("assignment_logs")
    .select("id", { count: "exact", head: true })
    .in("assignment_id", assignmentIds)
    .in("student_id", studentIds)
    .eq("status", "checked");
  return count ?? 0;
}

async function computeBaseForMethod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringId: string,
  method: "per_paper" | "bracket",
  checkedCount: number
): Promise<{ base: number; methodLabel: string }> {
  if (method === "bracket") {
    const { data: brackets } = await supabase.from("pay_brackets").select("lo, hi, pay").eq("offering_id", offeringId);
    const match = (brackets ?? []).find((b) => checkedCount >= b.lo && checkedCount <= b.hi);
    return { base: match ? Number(match.pay) : 0, methodLabel: "Bracket" };
  }
  const { data: rateRow } = await supabase.from("per_paper_rates").select("rate").eq("offering_id", offeringId).maybeSingle();
  const rate = rateRow ? Number(rateRow.rate) : 8;
  return { base: checkedCount * rate, methodLabel: "Per paper" };
}

async function defaultMethodForOffering(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string): Promise<"per_paper" | "bracket"> {
  const { count } = await supabase.from("pay_brackets").select("id", { count: "exact", head: true }).eq("offering_id", offeringId);
  return count && count > 0 ? "bracket" : "per_paper";
}

// Generates one salary_line per (assistant, offering) that has at least one
// checked paper in this period. Existing lines for that exact
// (org, payee, offering, period) combination are left completely untouched
// — this only fills in gaps, so it's safe to re-run without clobbering
// anything Finance has already reviewed or hand-edited.
export async function generateSalariesForPeriod(period: string): Promise<{ created: number }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "finance" && profile.role !== "admin")) throw new Error("Not authorized");
  const orgId = profile.org.id;
  const supabase = await createClient();

  const { data: offerings } = await supabase.from("course_offerings").select("id").eq("org_id", orgId);
  let created = 0;

  for (const offering of offerings ?? []) {
    const { data: enrollments } = await supabase.from("enrollments").select("assistant_id").eq("offering_id", offering.id).not("assistant_id", "is", null);
    const assistantIds = Array.from(new Set((enrollments ?? []).map((e) => e.assistant_id as string)));
    if (!assistantIds.length) continue;

    const method = await defaultMethodForOffering(supabase, offering.id);

    for (const assistantId of assistantIds) {
      const checkedCount = await countCheckedPapers(supabase, offering.id, assistantId, period);
      if (checkedCount <= 0) continue;
      const { base, methodLabel } = await computeBaseForMethod(supabase, offering.id, method, checkedCount);

      const { error } = await supabase
        .from("salary_lines")
        .upsert(
          {
            org_id: orgId,
            payee_id: assistantId,
            offering_id: offering.id,
            period,
            method: methodLabel,
            calc_method: method,
            basis: `${checkedCount} papers checked`,
            base,
          },
          { onConflict: "org_id,payee_id,offering_id,period", ignoreDuplicates: true }
        );
      if (!error) created++;
    }
  }

  return { created };
}

// Finance overriding a line's calc method recomputes its base from scratch
// using that method — "manual" leaves the existing base alone so Finance can
// type any number directly.
export async function setLineCalcMethod(lineId: string, method: "per_paper" | "bracket" | "manual") {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data: line } = await supabase.from("salary_lines").select("offering_id, payee_id, period").eq("id", lineId).single();
  if (!line) throw new Error("Salary line not found");

  if (method === "manual" || !line.offering_id) {
    const { error } = await supabase.from("salary_lines").update({ calc_method: "manual", method: "Manual" }).eq("id", lineId);
    if (error) throw new Error(error.message);
    return;
  }

  const checkedCount = await countCheckedPapers(supabase, line.offering_id, line.payee_id, line.period);
  const { base, methodLabel } = await computeBaseForMethod(supabase, line.offering_id, method, checkedCount);
  const { error } = await supabase
    .from("salary_lines")
    .update({ calc_method: method, method: methodLabel, basis: `${checkedCount} papers checked`, base, updated_at: new Date().toISOString() })
    .eq("id", lineId);
  if (error) throw new Error(error.message);
}

export type AssistantDetailRow = {
  assistantId: string;
  assistantName: string;
  email: string | null;
  phone: string | null;
  offering: string;
  period: string;
  papersChecked: number;
  payMethod: string;
  calcMethod: string | null;
  base: number;
  bonus: number;
  bonusReason: string | null;
  deduction: number;
  deductionReason: string | null;
  totalPayout: number;
  status: "paid" | "pending";
  evalRating: string | null;
  evalNotes: string | null;
  evalExtraTotal: number;
  evalDeductionTotal: number;
};

export type AssistantSummaryRow = {
  assistantId: string;
  assistantName: string;
  monthsActive: number;
  totalPapersChecked: number;
  avgPapersCheckedPerMonth: number;
  totalBase: number;
  totalBonus: number;
  totalDeduction: number;
  totalPayout: number;
  totalEvalExtra: number;
  totalEvalDeduction: number;
  evaluationCount: number;
};

// Every salary line ever generated for this org, one row per
// (assistant, course, month), joined with that same slice's evaluation
// (extras/deductions/rating a head logged) and an authoritative
// papers-checked count — not the freeform "basis" text, which Finance can
// hand-edit and so can't be trusted for reporting. Used for the full
// per-assistant CSV export; heads/assistants never see this — same access
// as the rest of salary_lines (finance/admin only).
export async function getAssistantDetailedExport(): Promise<{ detail: AssistantDetailRow[]; summary: AssistantSummaryRow[] }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "finance" && profile.role !== "admin")) return { detail: [], summary: [] };
  const orgId = profile.org.id;
  const supabase = await createClient();

  const { data: lines } = await supabase
    .from("salary_lines")
    .select(
      "id, payee_id, offering_id, period, method, calc_method, base, bonus, deduction, bonus_reason, deduction_reason, status, pay_method, profiles(full_name, email, phone), course_offerings(session, unit, courses(name))"
    )
    .eq("org_id", orgId)
    .order("period", { ascending: false });
  if (!lines || lines.length === 0) return { detail: [], summary: [] };

  const { data: evals } = await supabase
    .from("evaluations")
    .select("id, assistant_id, offering_id, period, rating, notes, evaluation_lines(kind, amount)")
    .eq("org_id", orgId);

  const evalKey = (assistantId: string, offeringId: string | null, period: string) => `${assistantId}::${offeringId}::${period}`;
  const evalByKey = new Map<string, { rating: string | null; notes: string | null; extraTotal: number; deductionTotal: number }>();
  for (const ev of evals ?? []) {
    const lines2 = Array.isArray(ev.evaluation_lines) ? ev.evaluation_lines : [];
    const extraTotal = lines2.filter((l) => l.kind === "extra").reduce((sum, l) => sum + Number(l.amount), 0);
    const deductionTotal = lines2.filter((l) => l.kind === "deduction").reduce((sum, l) => sum + Number(l.amount), 0);
    evalByKey.set(evalKey(ev.assistant_id, ev.offering_id, ev.period), { rating: ev.rating, notes: ev.notes, extraTotal, deductionTotal });
  }

  const detail: AssistantDetailRow[] = [];
  const summaryAcc = new Map<
    string,
    { name: string; periods: Set<string>; papers: number; base: number; bonus: number; deduction: number; evalExtra: number; evalDeduction: number; evalCount: number }
  >();

  for (const l of lines) {
    const payee = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    if (!payee) continue;
    const offering = Array.isArray(l.course_offerings) ? l.course_offerings[0] : l.course_offerings;
    const course = offering ? (Array.isArray(offering.courses) ? offering.courses[0] : offering.courses) : null;
    const offeringLabel2 = offering ? [course?.name, offering.session, offering.unit].filter(Boolean).join(" · ") : "—";

    const papersChecked = l.offering_id ? await countCheckedPapers(supabase, l.offering_id, l.payee_id, l.period) : 0;
    const ev = evalByKey.get(evalKey(l.payee_id, l.offering_id, l.period));
    const base = Number(l.base);
    const bonus = Number(l.bonus);
    const deduction = Number(l.deduction);

    detail.push({
      assistantId: l.payee_id,
      assistantName: payee.full_name,
      email: payee.email ?? null,
      phone: payee.phone ?? null,
      offering: offeringLabel2,
      period: l.period,
      papersChecked,
      payMethod: l.pay_method,
      calcMethod: l.calc_method,
      base,
      bonus,
      bonusReason: l.bonus_reason,
      deduction,
      deductionReason: l.deduction_reason,
      totalPayout: base + bonus - deduction,
      status: l.status as "paid" | "pending",
      evalRating: ev?.rating ?? null,
      evalNotes: ev?.notes ?? null,
      evalExtraTotal: ev?.extraTotal ?? 0,
      evalDeductionTotal: ev?.deductionTotal ?? 0,
    });

    const acc = summaryAcc.get(l.payee_id) ?? {
      name: payee.full_name,
      periods: new Set<string>(),
      papers: 0,
      base: 0,
      bonus: 0,
      deduction: 0,
      evalExtra: 0,
      evalDeduction: 0,
      evalCount: 0,
    };
    acc.periods.add(l.period);
    acc.papers += papersChecked;
    acc.base += base;
    acc.bonus += bonus;
    acc.deduction += deduction;
    if (ev) {
      acc.evalExtra += ev.extraTotal;
      acc.evalDeduction += ev.deductionTotal;
      acc.evalCount += 1;
    }
    summaryAcc.set(l.payee_id, acc);
  }

  const summary: AssistantSummaryRow[] = Array.from(summaryAcc.entries())
    .map(([assistantId, acc]) => {
      const monthsActive = acc.periods.size;
      return {
        assistantId,
        assistantName: acc.name,
        monthsActive,
        totalPapersChecked: acc.papers,
        avgPapersCheckedPerMonth: monthsActive ? Math.round((acc.papers / monthsActive) * 10) / 10 : 0,
        totalBase: acc.base,
        totalBonus: acc.bonus,
        totalDeduction: acc.deduction,
        totalPayout: acc.base + acc.bonus - acc.deduction,
        totalEvalExtra: acc.evalExtra,
        totalEvalDeduction: acc.evalDeduction,
        evaluationCount: acc.evalCount,
      };
    })
    .sort((a, b) => a.assistantName.localeCompare(b.assistantName));

  return { detail: detail.sort((a, b) => a.assistantName.localeCompare(b.assistantName) || b.period.localeCompare(a.period)), summary };
}
