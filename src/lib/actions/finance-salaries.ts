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
  officeHoursOfferingId: string | null;
  offering: string;
  method: string;
  calcMethod: "per_paper" | "bracket" | "manual" | null;
  basis: string | null;
  base: number;
  bonus: number;
  deduction: number;
  bonusReason: string | null;
  deductionReason: string | null;
  officeHours: number | null;
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
      "id, payee_id, offering_id, office_hours_offering_id, method, calc_method, basis, base, bonus, deduction, bonus_reason, deduction_reason, office_hours, status, pay_method, profiles(full_name, initials), course_offerings!salary_lines_offering_id_fkey(session, unit, courses(name)), office_hours_course:course_offerings!salary_lines_office_hours_offering_id_fkey(session, unit, courses(name))"
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
          const officeHoursCourse = Array.isArray(r.office_hours_course) ? r.office_hours_course[0] : r.office_hours_course;
          const label = r.offering_id
            ? offeringLabel(offering)
            : r.office_hours_offering_id
              ? `${r.method} · ${offeringLabel(officeHoursCourse)}`
              : r.method;
          return {
            id: r.id,
            offeringId: r.offering_id,
            officeHoursOfferingId: r.office_hours_offering_id,
            offering: label,
            method: r.method,
            calcMethod: r.calc_method as SalaryLineRow["calcMethod"],
            basis: r.basis,
            base: Number(r.base),
            bonus: Number(r.bonus),
            deduction: Number(r.deduction),
            bonusReason: r.bonus_reason,
            deductionReason: r.deduction_reason,
            officeHours: r.office_hours != null ? Number(r.office_hours) : null,
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

async function resolveOfficeHourRate(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string, offeringId: string): Promise<number> {
  const [{ data: overrideRow }, { data: defaultRow }] = await Promise.all([
    supabase.from("other_rates").select("rate").eq("org_id", orgId).eq("label", "Office hour").eq("offering_id", offeringId).maybeSingle(),
    supabase.from("other_rates").select("rate").eq("org_id", orgId).eq("label", "Office hour").is("offering_id", null).maybeSingle(),
  ]);
  return overrideRow ? Number(overrideRow.rate) : defaultRow ? Number(defaultRow.rate) : 15;
}

// A fixed, per-month office-hours line for one specific course. The row
// itself still keeps offering_id = null (like a manual line) — a real
// offering_id would collide with the (org, payee, offering_id, period)
// unique constraint that course's own per-paper/bracket line already
// occupies for this same assistant+period. office_hours_offering_id instead
// tracks which course's rate applied, without touching that constraint, so
// an assistant can have a separate office-hours entry per course.
async function upsertOfficeHoursLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  payeeId: string,
  period: string,
  offeringId: string,
  hours: number
) {
  const rate = await resolveOfficeHourRate(supabase, orgId, offeringId);
  const base = Math.round(hours * rate);
  const basis = `${hours} office hour${hours === 1 ? "" : "s"} @ ${rate}/hr`;

  const { data: existing } = await supabase
    .from("salary_lines")
    .select("id")
    .eq("org_id", orgId)
    .eq("payee_id", payeeId)
    .eq("period", period)
    .is("offering_id", null)
    .eq("method", "Office hours")
    .eq("office_hours_offering_id", offeringId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("salary_lines")
      .update({ office_hours: hours, base, basis, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("salary_lines").insert({
      org_id: orgId,
      payee_id: payeeId,
      offering_id: null,
      office_hours_offering_id: offeringId,
      period,
      method: "Office hours",
      calc_method: "manual",
      basis,
      base,
      office_hours: hours,
    });
    if (error) throw new Error(error.message);
  }
}

export async function setAssistantOfficeHours(payeeId: string, period: string, hours: number, offeringId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "finance" && profile.role !== "admin")) throw new Error("Not authorized");
  await upsertOfficeHoursLine(await createClient(), profile.org.id, payeeId, period, offeringId, hours);
}

// Only creates the line when one doesn't already exist for this
// (payee, course, period) — never overwrites hours Finance already entered
// or hand-edited, matching generateSalariesForPeriod's gap-filling-only
// behavior for every other line type.
async function createDefaultOfficeHoursLineIfMissing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  payeeId: string,
  period: string,
  offeringId: string,
  hours: number
) {
  const { data: existing } = await supabase
    .from("salary_lines")
    .select("id")
    .eq("org_id", orgId)
    .eq("payee_id", payeeId)
    .eq("period", period)
    .is("offering_id", null)
    .eq("method", "Office hours")
    .eq("office_hours_offering_id", offeringId)
    .maybeSingle();
  if (existing) return;
  await upsertOfficeHoursLine(supabase, orgId, payeeId, period, offeringId, hours);
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
// number of assignment_logs that assistant personally marked "checked"
// (logged_by) on a salary-counting assignment due — or if undated, created —
// within that calendar month. Attributing by logged_by rather than the
// student's current assistant keeps this correct across mid-term
// reassignment (a paper checked before a handoff still counts for whoever
// actually checked it, not the student's new or previous assistant) and
// excludes a head's own correction/override from counting toward pay.
type CheckedPapersCount = { papers: number; assignments: number };

async function countCheckedPapers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringId: string,
  assistantId: string,
  period: string
): Promise<CheckedPapersCount> {
  const [y, m] = period.split("-").map(Number);
  const monthStart = `${period}-01`;
  const monthEnd = new Date(y, m, 1).toISOString().slice(0, 10);

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, due_date, created_at")
    .eq("offering_id", offeringId)
    .eq("counts_salary", true);
  const assignmentIds = (assignments ?? [])
    .filter((a) => {
      const d = a.due_date ?? a.created_at.slice(0, 10);
      return d >= monthStart && d < monthEnd;
    })
    .map((a) => a.id);
  if (!assignmentIds.length) return { papers: 0, assignments: 0 };

  const { data: logs } = await supabase
    .from("assignment_logs")
    .select("id, assignment_id")
    .in("assignment_id", assignmentIds)
    .eq("logged_by", assistantId)
    .eq("status", "checked");
  return { papers: logs?.length ?? 0, assignments: new Set((logs ?? []).map((l) => l.assignment_id)).size };
}

function formatBasis(method: "per_paper" | "bracket", count: CheckedPapersCount, prorationNote: string | null): string {
  if (count.papers === 0) return "No checked papers this period";
  const base =
    method === "bracket"
      ? `${count.papers} paper${count.papers === 1 ? "" : "s"} checked across ${count.assignments} assignment${count.assignments === 1 ? "" : "s"}`
      : `${count.papers} papers checked`;
  return prorationNote ? `${base} · ${prorationNote}` : base;
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

// Fraction of `period` (YYYY-MM) an assistant was actually active on this
// offering, given when they joined it and when they left the org (if ever).
// A leave date is inclusive of that day (they worked through it); a join
// date is exclusive (counting starts the day after). E.g. in a 31-day
// month: leaving on the 10th pays 10/31, joining on the 10th pays 21/31.
function prorationFraction(period: string, joinedAt: string | null, leftAt: string | null): number {
  const [y, m] = period.split("-").map(Number);
  const n = daysInMonth(y, m);
  const periodStart = Date.UTC(y, m - 1, 1);
  const periodEnd = Date.UTC(y, m - 1, n);

  let startDay = 1;
  if (joinedAt) {
    const j = new Date(joinedAt);
    const jTime = Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate());
    if (jTime > periodEnd) return 0;
    if (j.getUTCFullYear() === y && j.getUTCMonth() + 1 === m) startDay = j.getUTCDate() + 1;
  }

  let endDay = n;
  if (leftAt) {
    const l = new Date(leftAt);
    const lTime = Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate());
    if (lTime < periodStart) return 0;
    if (l.getUTCFullYear() === y && l.getUTCMonth() + 1 === m) endDay = l.getUTCDate();
  }

  return Math.max(0, endDay - startDay + 1) / n;
}

function formatProrationNote(period: string, joinedAt: string | null, leftAt: string | null, fraction: number): string {
  const [y, m] = period.split("-").map(Number);
  const n = daysInMonth(y, m);
  const activeDays = Math.round(fraction * n);
  const notes: string[] = [];
  if (leftAt) {
    const l = new Date(leftAt);
    if (l.getUTCFullYear() === y && l.getUTCMonth() + 1 === m) notes.push(`left ${leftAt}`);
  }
  if (joinedAt) {
    const j = new Date(joinedAt);
    if (j.getUTCFullYear() === y && j.getUTCMonth() + 1 === m) notes.push(`joined ${j.toISOString().slice(0, 10)}`);
  }
  return `prorated ${activeDays}/${n}${notes.length ? ` — ${notes.join(", ")}` : ""}`;
}

async function getActivityWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringId: string,
  assistantId: string
): Promise<{ joinedAt: string | null; leftAt: string | null }> {
  const [{ data: oa }, { data: p }] = await Promise.all([
    supabase.from("offering_assistants").select("joined_at").eq("offering_id", offeringId).eq("assistant_id", assistantId).maybeSingle(),
    supabase.from("profiles").select("left_at").eq("id", assistantId).maybeSingle(),
  ]);
  return { joinedAt: oa?.joined_at ?? null, leftAt: p?.left_at ?? null };
}

async function computeBaseForMethod(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringId: string,
  assistantId: string,
  period: string,
  method: "per_paper" | "bracket",
  checkedCount: number
): Promise<{ base: number; methodLabel: string; prorationNote: string | null }> {
  if (method === "bracket") {
    const { data: brackets } = await supabase.from("pay_brackets").select("lo, hi, pay").eq("offering_id", offeringId);

    const { joinedAt, leftAt } = await getActivityWindow(supabase, offeringId, assistantId);
    const fraction = prorationFraction(period, joinedAt, leftAt);
    const prorationNote = fraction < 1 ? formatProrationNote(period, joinedAt, leftAt, fraction) : null;

    // Brackets are calibrated against a full period — a partial-period
    // assistant naturally checks fewer papers just because they had fewer
    // days, so match against their pace extrapolated to a full period
    // instead of the raw (and therefore artificially low) count. The pay
    // itself still only gets prorated by the actual fraction below.
    const normalizedCount = fraction > 0 ? checkedCount / fraction : checkedCount;
    const match = (brackets ?? []).find((b) => normalizedCount >= b.lo && normalizedCount <= b.hi);
    const fullPay = match ? Number(match.pay) : 0;

    return { base: Math.round(fullPay * fraction), methodLabel: "Bracket", prorationNote };
  }
  const { data: rateRow } = await supabase.from("per_paper_rates").select("rate").eq("offering_id", offeringId).maybeSingle();
  const rate = rateRow ? Number(rateRow.rate) : 8;
  return { base: checkedCount * rate, methodLabel: "Per paper", prorationNote: null };
}

async function defaultMethodForOffering(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string): Promise<"per_paper" | "bracket"> {
  const { count } = await supabase.from("pay_brackets").select("id", { count: "exact", head: true }).eq("offering_id", offeringId);
  return count && count > 0 ? "bracket" : "per_paper";
}

// A staff member's own default (set in Payroll Settings, or bulk-applied to
// a whole course) takes priority over the offering's bracket-presence-based
// default — that offering-level default only exists as a fallback for staff
// who've never had a personal preference set. "fixed" isn't wired into this
// paper-counting engine at all (a flat recurring salary isn't a function of
// papers checked), so it's treated the same as no preference set: fall
// through and let the assistant's line stay "manual" unless they have
// checked papers, exactly like today's behavior for anyone with no default.
async function resolveMethodForAssistant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringId: string,
  assistantId: string,
  staffDefault: "paper" | "category" | "fixed" | undefined
): Promise<"per_paper" | "bracket"> {
  if (staffDefault === "paper") return "per_paper";
  if (staffDefault === "category") return "bracket";
  return defaultMethodForOffering(supabase, offeringId);
}

// Generates one salary_line per (assistant, offering) that has at least one
// checked paper in this period, OR an evaluation with a nonzero extra/
// deduction logged by their head for this period — a head's bonus or
// deduction still needs somewhere for Finance to see and pay it even when
// the assistant had nothing due this month. Also creates that period's
// office-hours line for any assistant with a standing default_office_hours
// set on this course (Pay categories → Fixed office hours per assistant).
// Existing lines for that exact (org, payee, offering, period) — or
// (payee, office_hours_offering_id, period) for office hours — are left
// completely untouched, so it's safe to re-run without clobbering anything
// Finance has already reviewed or hand-edited.
export async function generateSalariesForPeriod(period: string): Promise<{ created: number }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "finance" && profile.role !== "admin")) throw new Error("Not authorized");
  const orgId = profile.org.id;
  const supabase = await createClient();

  const { data: offerings } = await supabase.from("course_offerings").select("id").eq("org_id", orgId);
  let created = 0;

  for (const offering of offerings ?? []) {
    const { data: enrollments } = await supabase.from("enrollments").select("assistant_id").eq("offering_id", offering.id).not("assistant_id", "is", null);
    const enrolledAssistantIds = new Set((enrollments ?? []).map((e) => e.assistant_id as string));

    const { data: evalRows } = await supabase
      .from("evaluations")
      .select("assistant_id, evaluation_lines(kind, amount)")
      .eq("org_id", orgId)
      .eq("offering_id", offering.id)
      .eq("period", period);
    const evalByAssistant = new Map<string, { extra: number; deduction: number }>();
    for (const ev of evalRows ?? []) {
      const evLines = Array.isArray(ev.evaluation_lines) ? ev.evaluation_lines : [];
      const extra = evLines.filter((l) => l.kind === "extra").reduce((sum, l) => sum + Number(l.amount), 0);
      const deduction = evLines.filter((l) => l.kind === "deduction").reduce((sum, l) => sum + Number(l.amount), 0);
      if (extra > 0 || deduction > 0) evalByAssistant.set(ev.assistant_id, { extra, deduction });
    }

    const { data: officeHourDefaults } = await supabase
      .from("offering_assistants")
      .select("assistant_id, default_office_hours")
      .eq("offering_id", offering.id)
      .not("default_office_hours", "is", null);
    for (const row of officeHourDefaults ?? []) {
      await createDefaultOfficeHoursLineIfMissing(supabase, orgId, row.assistant_id, period, offering.id, Number(row.default_office_hours));
    }

    const assistantIds = Array.from(new Set([...enrolledAssistantIds, ...evalByAssistant.keys()]));
    if (!assistantIds.length) continue;

    const { data: staffSettings } = await supabase.from("staff_pay_settings").select("profile_id, calc_method").in("profile_id", assistantIds);
    const staffDefaultByAssistant = new Map((staffSettings ?? []).map((s) => [s.profile_id, s.calc_method as "paper" | "category" | "fixed"]));

    for (const assistantId of assistantIds) {
      const checkedCount = await countCheckedPapers(supabase, offering.id, assistantId, period);
      const evalAmounts = evalByAssistant.get(assistantId);
      if (checkedCount.papers <= 0 && !evalAmounts) continue;

      let base = 0;
      let methodLabel = "Manual";
      let calcMethod: "per_paper" | "bracket" | "manual" = "manual";
      let basis = "No checked papers this period";
      if (checkedCount.papers > 0) {
        const method = await resolveMethodForAssistant(supabase, offering.id, assistantId, staffDefaultByAssistant.get(assistantId));
        const computed = await computeBaseForMethod(supabase, offering.id, assistantId, period, method, checkedCount.papers);
        base = computed.base;
        methodLabel = computed.methodLabel;
        calcMethod = method;
        basis = formatBasis(method, checkedCount, computed.prorationNote);
      }

      const { error } = await supabase
        .from("salary_lines")
        .upsert(
          {
            org_id: orgId,
            payee_id: assistantId,
            offering_id: offering.id,
            period,
            method: methodLabel,
            calc_method: calcMethod,
            basis,
            base,
            bonus: evalAmounts?.extra ?? 0,
            deduction: evalAmounts?.deduction ?? 0,
            bonus_reason: evalAmounts?.extra ? "From head evaluation" : null,
            deduction_reason: evalAmounts?.deduction ? "From head evaluation" : null,
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
  const { base, methodLabel, prorationNote } = await computeBaseForMethod(supabase, line.offering_id, line.payee_id, line.period, method, checkedCount.papers);
  const { error } = await supabase
    .from("salary_lines")
    .update({ calc_method: method, method: methodLabel, basis: formatBasis(method, checkedCount, prorationNote), base, updated_at: new Date().toISOString() })
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

    const papersChecked = l.offering_id ? (await countCheckedPapers(supabase, l.offering_id, l.payee_id, l.period)).papers : 0;
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
