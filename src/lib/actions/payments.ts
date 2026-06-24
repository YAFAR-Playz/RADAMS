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
  studentId: string;
  studentName: string;
  initials: string;
  offering: string;
  planType: PlanType | null;
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

  const per = Math.round((totalAmount / count) * 100) / 100;
  const rows = Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1;
    const amount = isLast ? Math.round((totalAmount - per * (count - 1)) * 100) / 100 : per;
    const due = new Date();
    due.setMonth(due.getMonth() + i);
    return {
      plan_id: plan.id,
      seq: i + 1,
      amount,
      due_date: due.toISOString().slice(0, 10),
      status: "pending" as const,
    };
  });

  const { error: rowsError } = await supabase.from("payment_installments").insert(rows);
  if (rowsError) throw new Error(rowsError.message);

  return { id: plan.id };
}

export async function listPaymentPlans(): Promise<StudentPaymentRow[]> {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("payment_plans")
    .select(
      "id, student_id, offering_id, plan_type, total_amount, students(name, initials), course_offerings(session, unit, courses(name))"
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
      studentId: p.student_id,
      studentName: student.name,
      initials: student.initials,
      offering: offeringLabel(offering),
      planType: p.plan_type as PlanType,
      totalAmount: Number(p.total_amount),
      paidAmount,
      installments: installmentRows,
    };
  });

  return rows.filter((x): x is StudentPaymentRow => x !== null);
}

export async function markInstallmentPaid(installmentId: string, paid: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_installments")
    .update({ status: paid ? "paid" : "pending", paid_at: paid ? new Date().toISOString() : null })
    .eq("id", installmentId);
  if (error) throw new Error(error.message);
}
