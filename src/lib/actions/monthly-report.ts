"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type MonthlyReport = {
  period: string;
  totalStudents: number;
  newStudents: number;
  studentsLeft: number;
  attendancePct: number;
  assignmentCompletionPct: number;
  payroll: { total: number; paid: number; pending: number };
  staffAdded: number;
  staffRemoved: number;
};

function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { startIso: start.toISOString(), endIso: end.toISOString(), startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export async function getMonthlyReport(period: string): Promise<MonthlyReport | null> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "admin" && profile.role !== "head")) return null;
  const orgId = profile.org.id;
  const supabase = await createClient();
  const { startIso, endIso, startDate, endDate } = monthRange(period);

  const { count: totalStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  const { count: newStudents } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  const { count: studentsLeft } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("left_at", startIso)
    .lt("left_at", endIso);

  const { data: offerings } = await supabase.from("course_offerings").select("id").eq("org_id", orgId);
  const offeringIds = (offerings ?? []).map((o) => o.id);

  let attendancePct = 0;
  if (offeringIds.length) {
    const { data: sessions } = await supabase
      .from("attendance_sessions")
      .select("id")
      .in("offering_id", offeringIds)
      .gte("session_date", startDate)
      .lt("session_date", endDate);
    const sessionIds = (sessions ?? []).map((s) => s.id);
    if (sessionIds.length) {
      const { data: records } = await supabase.from("attendance_records").select("status").in("session_id", sessionIds);
      const total = records?.length ?? 0;
      const present = (records ?? []).filter((r) => r.status === "present" || r.status === "late").length;
      attendancePct = total ? Math.round((present / total) * 100) : 0;
    }
  }

  let assignmentCompletionPct = 0;
  if (offeringIds.length) {
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id")
      .in("offering_id", offeringIds)
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    const assignmentIds = (assignments ?? []).map((a) => a.id);
    if (assignmentIds.length) {
      const { data: logs } = await supabase.from("assignment_logs").select("status").in("assignment_id", assignmentIds);
      const total = logs?.length ?? 0;
      const checked = (logs ?? []).filter((l) => l.status === "checked").length;
      assignmentCompletionPct = total ? Math.round((checked / total) * 100) : 0;
    }
  }

  const { data: lines } = await supabase.from("salary_lines").select("base, bonus, deduction, status").eq("org_id", orgId).eq("period", period);
  const payroll = (lines ?? []).reduce(
    (acc, l) => {
      const amt = Number(l.base) + Number(l.bonus) - Number(l.deduction);
      acc.total += amt;
      if (l.status === "paid") acc.paid += amt;
      else acc.pending += amt;
      return acc;
    },
    { total: 0, paid: 0, pending: 0 }
  );

  const { data: staffing } = await supabase
    .from("staffing_log")
    .select("kind")
    .eq("org_id", orgId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);
  const staffAdded = (staffing ?? []).filter((s) => s.kind === "add").length;
  const staffRemoved = (staffing ?? []).filter((s) => s.kind === "remove").length;

  return {
    period,
    totalStudents: totalStudents ?? 0,
    newStudents: newStudents ?? 0,
    studentsLeft: studentsLeft ?? 0,
    attendancePct,
    assignmentCompletionPct,
    payroll,
    staffAdded,
    staffRemoved,
  };
}
