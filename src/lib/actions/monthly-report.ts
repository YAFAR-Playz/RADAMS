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

export type OfferingGradeScale = {
  offeringId: string;
  label: string;
  scale: "percentage" | "letter";
  bands: { label: string; min: number }[];
};

export async function listGradeScalesForOrg(): Promise<OfferingGradeScale[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "admin" && profile.role !== "head")) return [];
  const orgId = profile.org.id;
  const supabase = await createClient();

  let query = supabase.from("course_offerings").select("id, session, unit, grade_scale, grade_bands, courses(name)").eq("org_id", orgId);
  if (profile.role === "head") {
    const { data: heads } = await supabase.from("offering_heads").select("offering_id").eq("head_id", profile.id);
    const offeringIds = (heads ?? []).map((h) => h.offering_id);
    if (!offeringIds.length) return [];
    query = query.in("id", offeringIds);
  }
  const { data } = await query;

  return (data ?? []).map((o) => {
    const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
    return {
      offeringId: o.id,
      label: [course?.name, o.session, o.unit].filter(Boolean).join(" · "),
      scale: (o.grade_scale as "percentage" | "letter" | null) ?? "percentage",
      bands: (o.grade_bands as { label: string; min: number }[] | null) ?? [],
    };
  });
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
    // An assignment belongs to the month it's due in — or, if undated, the
    // month it was created — matching the convention used everywhere else
    // (Finance salary calc, Academic report) so this stat agrees with them
    // instead of silently using a different rule.
    const { data: allAssignments } = await supabase.from("assignments").select("id, due_date, created_at").in("offering_id", offeringIds);
    const assignmentIds = (allAssignments ?? [])
      .filter((a) => {
        const d = a.due_date ?? a.created_at.slice(0, 10);
        return d >= startDate && d < endDate;
      })
      .map((a) => a.id);
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
