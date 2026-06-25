"use server";

import { createClient } from "@/lib/supabase/server";

export type PlanType = "full" | "installments";

export type OfferingFees = {
  feeFull: number | null;
  feeInstallmentTotal: number | null;
  installmentCount: number;
};

export type InstallmentRow = {
  id: string;
  seq: number;
  amount: number;
  dueDate: string | null;
  status: "pending" | "paid";
  paidAt: string | null;
};

export type StudentPaymentRow = {
  planId: string;
  studentId: string;
  studentName: string;
  initials: string;
  offering: string;
  offeringId: string;
  planType: PlanType | null;
  discountPct: number;
  totalAmount: number;
  paidAmount: number;
  installments: InstallmentRow[];
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null }) {
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function getOfferingFees(offeringId: string): Promise<OfferingFees> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_offerings")
    .select("fee_full, fee_installment_total, installment_count")
    .eq("id", offeringId)
    .single();
  if (!data) return { feeFull: null, feeInstallmentTotal: null, installmentCount: 1 };
  return { feeFull: data.fee_full, feeInstallmentTotal: data.fee_installment_total, installmentCount: data.installment_count };
}

export async function createPaymentPlan(input: { studentId: string; offeringId: string; planType: PlanType }) {
  const supabase = await createClient();
  const fees = await getOfferingFees(input.offeringId);

  const totalAmount = input.planType === "full" ? fees.feeFull ?? 0 : fees.feeInstallmentTotal ?? 0;
  const count = input.planType === "full" ? 1 : Math.max(1, fees.installmentCount);

  const { data: plan, error } = await supabase
    .from("payment_plans")
    .insert({
      student_id: input.studentId,
      offering_id: input.offeringId,
      plan_type: input.planType,
      total_amount: totalAmount,
      installment_count: count,
    })
    .select("id")
    .single();
  if (error || !plan) throw new Error(error?.message ?? "Failed to create payment plan");

  let scheduleDefs: { seq: number; amount: number; dueDate: string | null }[] = [];
  if (input.planType === "installments") {
    const { data: customSchedule } = await supabase
      .from("course_installment_schedule")
      .select("seq, amount, due_date")
      .eq("offering_id", input.offeringId)
      .order("seq", { ascending: true });
    if (customSchedule && customSchedule.length) {
      scheduleDefs = customSchedule.map((r) => ({ seq: r.seq, amount: Number(r.amount), dueDate: r.due_date }));
    }
  }

  if (!scheduleDefs.length) {
    const per = Math.round((totalAmount / count) * 100) / 100;
    scheduleDefs = Array.from({ length: count }, (_, i) => {
      const isLast = i === count - 1;
      const amount = isLast ? Math.round((totalAmount - per * (count - 1)) * 100) / 100 : per;
      const due = new Date();
      due.setMonth(due.getMonth() + i);
      return { seq: i + 1, amount, dueDate: due.toISOString().slice(0, 10) };
    });
  }

  const rows = scheduleDefs.map((s) => ({
    plan_id: plan.id,
    seq: s.seq,
    amount: s.amount,
    due_date: s.dueDate ?? new Date().toISOString().slice(0, 10),
    status: "pending" as const,
  }));

  const { error: rowsError } = await supabase.from("payment_installments").insert(rows);
  if (rowsError) throw new Error(rowsError.message);

  return { id: plan.id };
}

export async function listPaymentPlans(): Promise<StudentPaymentRow[]> {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("payment_plans")
    .select(
      "id, student_id, offering_id, plan_type, total_amount, discount_pct, students(name, initials), course_offerings(session, unit, courses(name))"
    )
    .order("created_at", { ascending: false });
  if (!plans || plans.length === 0) return [];

  const planIds = plans.map((p) => p.id);
  const { data: installments } = await supabase
    .from("payment_installments")
    .select("id, plan_id, seq, amount, due_date, status, paid_at")
    .in("plan_id", planIds)
    .order("seq", { ascending: true });

  const installmentsByPlan = new Map<string, InstallmentRow[]>();
  for (const row of installments ?? []) {
    const list = installmentsByPlan.get(row.plan_id) ?? [];
    list.push({ id: row.id, seq: row.seq, amount: Number(row.amount), dueDate: row.due_date, status: row.status, paidAt: row.paid_at });
    installmentsByPlan.set(row.plan_id, list);
  }

  const rows: (StudentPaymentRow | null)[] = plans.map((p) => {
    const student = Array.isArray(p.students) ? p.students[0] : p.students;
    const offering = Array.isArray(p.course_offerings) ? p.course_offerings[0] : p.course_offerings;
    if (!student || !offering) return null;
    const installmentRows = installmentsByPlan.get(p.id) ?? [];
    const paidAmount = installmentRows.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
    return {
      planId: p.id,
      studentId: p.student_id,
      studentName: student.name,
      initials: student.initials,
      offering: offeringLabel(offering),
      offeringId: p.offering_id,
      planType: p.plan_type as PlanType,
      discountPct: p.discount_pct,
      totalAmount: Number(p.total_amount),
      paidAmount,
      installments: installmentRows,
    };
  });

  return rows.filter((x): x is StudentPaymentRow => x !== null);
}

async function regenerateInstallments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  offeringId: string,
  planType: PlanType,
  totalAmount: number,
  alreadyPaid: number
) {
  await supabase.from("payment_installments").delete().eq("plan_id", planId);

  let scheduleDefs: { seq: number; amount: number; dueDate: string | null }[] = [];
  const count = planType === "full" ? 1 : Math.max(1, (await getOfferingFees(offeringId)).installmentCount);
  if (planType === "installments") {
    const { data: customSchedule } = await supabase
      .from("course_installment_schedule")
      .select("seq, amount, due_date")
      .eq("offering_id", offeringId)
      .order("seq", { ascending: true });
    if (customSchedule && customSchedule.length) {
      scheduleDefs = customSchedule.map((r) => ({ seq: r.seq, amount: Number(r.amount), dueDate: r.due_date }));
    }
  }
  if (!scheduleDefs.length) {
    const per = Math.round((totalAmount / count) * 100) / 100;
    scheduleDefs = Array.from({ length: count }, (_, i) => {
      const isLast = i === count - 1;
      const amount = isLast ? Math.round((totalAmount - per * (count - 1)) * 100) / 100 : per;
      const due = new Date();
      due.setMonth(due.getMonth() + i);
      return { seq: i + 1, amount, dueDate: due.toISOString().slice(0, 10) };
    });
  }

  let remainingPaid = alreadyPaid;
  const rows = scheduleDefs.map((s) => {
    const markPaid = remainingPaid >= s.amount - 0.01;
    if (markPaid) remainingPaid -= s.amount;
    return {
      plan_id: planId,
      seq: s.seq,
      amount: s.amount,
      due_date: s.dueDate ?? new Date().toISOString().slice(0, 10),
      status: markPaid ? ("paid" as const) : ("pending" as const),
      paid_at: markPaid ? new Date().toISOString() : null,
    };
  });

  const { error } = await supabase.from("payment_installments").insert(rows);
  if (error) throw new Error(error.message);
}

export async function setPlanDiscount(planId: string, discountPct: number) {
  const supabase = await createClient();
  const { data: plan } = await supabase.from("payment_plans").select("offering_id, plan_type").eq("id", planId).single();
  if (!plan) throw new Error("Plan not found");

  const fees = await getOfferingFees(plan.offering_id);
  const baseFee = plan.plan_type === "full" ? fees.feeFull ?? 0 : fees.feeInstallmentTotal ?? 0;
  const clampedPct = Math.max(0, Math.min(100, discountPct));
  const totalAmount = Math.round(baseFee * (1 - clampedPct / 100) * 100) / 100;

  const { data: installments } = await supabase.from("payment_installments").select("amount, status").eq("plan_id", planId);
  const alreadyPaid = (installments ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);

  const { error } = await supabase.from("payment_plans").update({ total_amount: totalAmount, discount_pct: clampedPct }).eq("id", planId);
  if (error) throw new Error(error.message);

  await regenerateInstallments(supabase, planId, plan.offering_id, plan.plan_type as PlanType, totalAmount, alreadyPaid);
}

export async function setPlanType(planId: string, planType: PlanType) {
  const supabase = await createClient();
  const { data: plan } = await supabase.from("payment_plans").select("offering_id, discount_pct").eq("id", planId).single();
  if (!plan) throw new Error("Plan not found");

  const { data: installments } = await supabase.from("payment_installments").select("amount, status").eq("plan_id", planId);
  const alreadyPaid = (installments ?? []).filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
  if (alreadyPaid > 0) throw new Error("Can't change plan type after a payment has been made");

  const fees = await getOfferingFees(plan.offering_id);
  const baseFee = planType === "full" ? fees.feeFull ?? 0 : fees.feeInstallmentTotal ?? 0;
  const totalAmount = Math.round(baseFee * (1 - plan.discount_pct / 100) * 100) / 100;
  const count = planType === "full" ? 1 : Math.max(1, fees.installmentCount);

  const { error } = await supabase
    .from("payment_plans")
    .update({ plan_type: planType, total_amount: totalAmount, installment_count: count })
    .eq("id", planId);
  if (error) throw new Error(error.message);

  await regenerateInstallments(supabase, planId, plan.offering_id, planType, totalAmount, 0);
}

export type PaymentStatusSummary = { planType: PlanType | null; totalAmount: number; paidAmount: number; status: "paid" | "pending" | "partial" | "none" };

export async function getPaymentStatusForOffering(offeringId: string): Promise<Record<string, PaymentStatusSummary>> {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("payment_plans")
    .select("id, student_id, plan_type, total_amount")
    .eq("offering_id", offeringId);
  if (!plans || plans.length === 0) return {};

  const planIds = plans.map((p) => p.id);
  const { data: installments } = await supabase
    .from("payment_installments")
    .select("plan_id, amount, status")
    .in("plan_id", planIds);

  const paidByPlan = new Map<string, number>();
  for (const row of installments ?? []) {
    if (row.status !== "paid") continue;
    paidByPlan.set(row.plan_id, (paidByPlan.get(row.plan_id) ?? 0) + Number(row.amount));
  }

  const result: Record<string, PaymentStatusSummary> = {};
  for (const plan of plans) {
    const paidAmount = paidByPlan.get(plan.id) ?? 0;
    const totalAmount = Number(plan.total_amount);
    const status: PaymentStatusSummary["status"] = paidAmount <= 0 ? "pending" : paidAmount >= totalAmount ? "paid" : "partial";
    result[plan.student_id] = { planType: plan.plan_type as PlanType, totalAmount, paidAmount, status };
  }
  return result;
}

export async function markInstallmentPaid(installmentId: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_installments")
    .update({ status: paid ? "paid" : "pending", paid_at: paid ? new Date().toISOString() : null })
    .eq("id", installmentId);
  if (error) throw new Error(error.message);
}
