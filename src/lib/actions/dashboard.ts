"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { Kpi, Tone } from "@/lib/roles";
import { trackInfo } from "@/lib/oversight-data";
import { currencySymbol } from "@/lib/currency";
import { getStudentCountTrend, getStaffCountTrend, getFinancePayrollTrend } from "@/lib/actions/dashboard-charts";

export type BarRow = { label: string; n: number; barWPct: number };
export type OfferingSummary = { id: string; label: string; students: number; pending: number };
export type AssistantRow = {
  id: string;
  name: string;
  initials: string;
  sent: number;
  total: number;
  pct: number;
  badge: { text: string; tone: Tone; icon: "check2" | "clock" | "alert" };
};
export type StudentRow = { name: string; initials: string; offering: string; badge: { text: string; tone: Tone; icon: "clock" | "alert" } };

export type AdminDashboard = {
  kpis: Kpi[];
  staffByRole: BarRow[];
  offerings: OfferingSummary[];
};

export type AssistantDashboard = {
  kpis: Kpi[];
  pendingStudents: StudentRow[];
  myOfferings: OfferingSummary[];
};

export type HeadDashboard = {
  kpis: Kpi[];
  offeringLabel: string;
  assistants: AssistantRow[];
  statusBreakdown: { label: string; count: number; tone: Tone }[];
  completionPct: number;
};

function offeringLabelOf(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null }) {
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) {
    return { kpis: [], staffByRole: [], offerings: [] };
  }
  const supabase = await createClient();

  const [{ count: studentsCount }, { data: staff }, { data: offeringRows }] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("profiles").select("role").eq("org_id", orgId).is("left_at", null),
    supabase.from("course_offerings").select("id, session, unit, courses(name)").eq("org_id", orgId),
  ]);

  const offeringIds = (offeringRows ?? []).map((o) => o.id);
  const { data: assignmentRows } = offeringIds.length
    ? await supabase.from("assignments").select("id, due_date, closed_at, offering_id").in("offering_id", offeringIds)
    : { data: [] as { id: string; due_date: string | null; closed_at: string | null; offering_id: string }[] };

  const today = new Date().toISOString().slice(0, 10);
  const pendingTasks = (assignmentRows ?? []).filter((a) => !a.closed_at && a.due_date && a.due_date < today).length;

  // One count-only query per offering rather than fetching every enrollment
  // row for the whole org — a single unbounded select here silently
  // truncated at Supabase's default 1000-row cap once enrollments passed
  // that count, under-reporting students for every offering after the cut.
  const studentsByOffering = new Map<string, number>();
  await Promise.all(
    offeringIds.map(async (id) => {
      const { count } = await supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("offering_id", id);
      studentsByOffering.set(id, count ?? 0);
    })
  );

  const roleCount = new Map<string, number>();
  for (const s of staff ?? []) {
    roleCount.set(s.role, (roleCount.get(s.role) ?? 0) + 1);
  }
  const ROLE_LABELS: Record<string, string> = {
    admin: "Admins",
    hr: "HR",
    head: "Heads",
    assistant: "Assistants",
    registration: "Registration",
    finance: "Finance",
  };
  const maxRoleCount = Math.max(1, ...Array.from(roleCount.values()));
  const staffByRole: BarRow[] = Array.from(roleCount.entries())
    .filter(([role]) => role !== "owner")
    .map(([role, n]) => ({ label: ROLE_LABELS[role] ?? role, n, barWPct: Math.round((n / maxRoleCount) * 100) }))
    .sort((a, b) => b.n - a.n);

  const offerings: OfferingSummary[] = (offeringRows ?? []).map((o) => ({
    id: o.id,
    label: offeringLabelOf(o),
    students: studentsByOffering.get(o.id) ?? 0,
    pending: (assignmentRows ?? []).filter((a) => a.offering_id === o.id && !a.closed_at).length,
  }));

  const [studentTrend, staffTrend] = await Promise.all([getStudentCountTrend(), getStaffCountTrend()]);

  const kpis: Kpi[] = [
    { icon: "grad", value: String(studentsCount ?? 0), label: "Students", tone: "brand", trend: studentTrend },
    { icon: "users", value: String((staff ?? []).length), label: "Staff members", tone: "neutral", trend: staffTrend },
    { icon: "clipboard-list", value: String(offeringIds.length), label: "Active courses", tone: "neutral" },
    { icon: "alert", value: String(pendingTasks), label: "Pending tasks", tone: pendingTasks > 0 ? "warn" : "ok" },
  ];

  return { kpis, staffByRole, offerings };
}

export async function getAssistantDashboard(): Promise<AssistantDashboard> {
  const profile = await getCurrentProfile();
  if (!profile) return { kpis: [], pendingStudents: [], myOfferings: [] };
  const supabase = await createClient();

  const { data: offeringLinks } = await supabase
    .from("offering_assistants")
    .select("course_offerings(id, session, unit, courses(name))")
    .eq("assistant_id", profile.id);

  const offerings = (offeringLinks ?? [])
    .map((row) => {
      const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
      return o ? { id: o.id, label: offeringLabelOf(o) } : null;
    })
    .filter((x): x is { id: string; label: string } => !!x);
  const offeringIds = offerings.map((o) => o.id);

  const { data: enrollments } = offeringIds.length
    ? await supabase.from("enrollments").select("id, offering_id, student_id, students(name, initials)").eq("assistant_id", profile.id)
    : { data: [] as { id: string; offering_id: string; student_id: string; students: { name: string; initials: string } | { name: string; initials: string }[] | null }[] };

  const myEnrollments = (enrollments ?? []).filter((e) => offeringIds.includes(e.offering_id));
  const studentsCount = new Set(myEnrollments.map((e) => e.student_id)).size;

  // Scope by offering, not assignment_assistants — that join table is only
  // populated when a head explicitly picks assistants while creating an
  // assignment (optional), but the actual logging page (listAssignmentsForOffering
  // + getRoster) shows every assignment in every offering this assistant is
  // linked to, regardless of that table. Scoping "pending" by it silently
  // undercounted any assignment created without explicit assistant picks.
  const { data: assignments } = offeringIds.length
    ? await supabase.from("assignments").select("id, title, offering_id, closed_at").in("offering_id", offeringIds)
    : { data: [] as { id: string; title: string; offering_id: string; closed_at: string | null }[] };

  const openAssignments = (assignments ?? []).filter((a) => !a.closed_at);
  const assignmentIds = (assignments ?? []).map((a) => a.id);

  const { data: logs } = assignmentIds.length
    ? await supabase.from("assignment_logs").select("assignment_id, student_id, status").in("assignment_id", assignmentIds)
    : { data: [] as { assignment_id: string; student_id: string; status: string | null }[] };

  const loggedSet = new Set((logs ?? []).filter((l) => l.status).map((l) => `${l.assignment_id}:${l.student_id}`));

  let pendingCount = 0;
  const pendingByOffering = new Map<string, number>();
  const pendingStudents: StudentRow[] = [];
  const seenStudents = new Set<string>();

  for (const a of openAssignments) {
    const studentsInOffering = myEnrollments.filter((e) => e.offering_id === a.offering_id);
    for (const e of studentsInOffering) {
      if (!loggedSet.has(`${a.id}:${e.student_id}`)) {
        pendingCount++;
        pendingByOffering.set(a.offering_id, (pendingByOffering.get(a.offering_id) ?? 0) + 1);
        if (!seenStudents.has(e.student_id) && pendingStudents.length < 8) {
          seenStudents.add(e.student_id);
          const student = Array.isArray(e.students) ? e.students[0] : e.students;
          const offering = offerings.find((o) => o.id === a.offering_id);
          if (student && offering) {
            pendingStudents.push({
              name: student.name,
              initials: student.initials,
              offering: offering.label,
              badge: { text: "Pending", tone: "warn", icon: "clock" },
            });
          }
        }
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const { count: loggedTodayCount } = await supabase
    .from("assignment_logs")
    .select("id", { count: "exact", head: true })
    .eq("logged_by", profile.id)
    .gte("updated_at", `${today}T00:00:00.000Z`);

  const myOfferings: OfferingSummary[] = offerings.map((o) => ({
    id: o.id,
    label: o.label,
    students: new Set(myEnrollments.filter((e) => e.offering_id === o.id).map((e) => e.student_id)).size,
    pending: pendingByOffering.get(o.id) ?? 0,
  }));

  const kpis: Kpi[] = [
    { icon: "grad", value: String(studentsCount), label: "My students", tone: "brand" },
    { icon: "clipboard-list", value: String(pendingCount), label: "Pending logs", tone: pendingCount > 0 ? "warn" : "ok" },
    { icon: "check", value: String(loggedTodayCount ?? 0), label: "Logged today", tone: "ok" },
    { icon: "clipboard-list", value: String(openAssignments.length), label: "Open assignments", tone: "neutral" },
  ];

  return { kpis, pendingStudents, myOfferings };
}

// Lean count-only version of the "Pending logs" KPI above, for the
// Assignments nav badge — avoids pulling the full dashboard payload just
// to show a number in the sidebar.
export async function getAssistantPendingLogCount(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile) return 0;
  const supabase = await createClient();

  const { data: offeringLinks } = await supabase.from("offering_assistants").select("offering_id").eq("assistant_id", profile.id);
  const offeringIds = (offeringLinks ?? []).map((r) => r.offering_id);
  if (!offeringIds.length) return 0;

  const { data: assignments } = await supabase.from("assignments").select("id, offering_id, closed_at").in("offering_id", offeringIds);
  const openAssignments = (assignments ?? []).filter((a) => !a.closed_at);
  if (!openAssignments.length) return 0;
  const assignmentIds = openAssignments.map((a) => a.id);

  const { data: enrollments } = await supabase.from("enrollments").select("offering_id, student_id").eq("assistant_id", profile.id);
  const { data: logs } = await supabase.from("assignment_logs").select("assignment_id, student_id, status").in("assignment_id", assignmentIds);
  const loggedSet = new Set((logs ?? []).filter((l) => l.status).map((l) => `${l.assignment_id}:${l.student_id}`));

  let pendingCount = 0;
  for (const a of openAssignments) {
    const studentsInOffering = (enrollments ?? []).filter((e) => e.offering_id === a.offering_id);
    for (const e of studentsInOffering) {
      if (!loggedSet.has(`${a.id}:${e.student_id}`)) pendingCount++;
    }
  }
  return pendingCount;
}

export async function getHeadDashboard(): Promise<HeadDashboard> {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { kpis: [], offeringLabel: "", assistants: [], statusBreakdown: [], completionPct: 0 };
  }
  const supabase = await createClient();

  const { data: offeringLinks } = await supabase
    .from("offering_heads")
    .select("course_offerings(id, session, unit, courses(name))")
    .eq("head_id", profile.id);

  const offerings = (offeringLinks ?? [])
    .map((row) => {
      const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
      return o ? { id: o.id, label: offeringLabelOf(o) } : null;
    })
    .filter((x): x is { id: string; label: string } => !!x);
  const offeringIds = offerings.map((o) => o.id);

  if (offeringIds.length === 0) {
    return {
      kpis: [
        { icon: "clipboard-list", value: "0", label: "My courses", tone: "brand" },
        { icon: "grad", value: "0", label: "Students", tone: "neutral" },
        { icon: "user-check", value: "0", label: "Assistants", tone: "neutral" },
        { icon: "clock", value: "0", label: "Pending messages", tone: "neutral" },
      ],
      offeringLabel: "",
      assistants: [],
      statusBreakdown: [],
      completionPct: 0,
    };
  }

  // A student who left THAT course must not count toward the tracking
  // totals below — same rule as the Students/Assistants tabs and the
  // Oversight page's own copy of this same tracking concept. "Left" is
  // tracked per enrollment, so this filters directly on the enrollment row.
  const [{ data: enrollments }, { data: assistantLinksRaw }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("offering_id, student_id, assistant_id")
      .in("offering_id", offeringIds)
      .is("left_at", null),
    supabase.from("offering_assistants").select("offering_id, profiles(id, full_name, initials)").in("offering_id", offeringIds),
    supabase.from("assignments").select("id, offering_id").in("offering_id", offeringIds),
  ]);

  const assignmentIds = (assignmentRows ?? []).map((a) => a.id);
  const { data: logs } = assignmentIds.length
    ? await supabase.from("assignment_logs").select("assignment_id, student_id, sent_at").in("assignment_id", assignmentIds)
    : { data: [] as { assignment_id: string; student_id: string; sent_at: string | null }[] };

  const assignmentToOffering = new Map((assignmentRows ?? []).map((a) => [a.id, a.offering_id]));
  const sentByStudentInOffering = new Map<string, number>();
  let totalSentAll = 0;
  for (const log of logs ?? []) {
    if (!log.sent_at) continue;
    const offeringId = assignmentToOffering.get(log.assignment_id);
    if (!offeringId) continue;
    const key = `${offeringId}:${log.student_id}`;
    sentByStudentInOffering.set(key, (sentByStudentInOffering.get(key) ?? 0) + 1);
    totalSentAll++;
  }

  const assignmentsPerOffering = new Map<string, number>();
  for (const a of assignmentRows ?? []) {
    assignmentsPerOffering.set(a.offering_id, (assignmentsPerOffering.get(a.offering_id) ?? 0) + 1);
  }

  const studentsCount = new Set((enrollments ?? []).map((e) => e.student_id)).size;
  const assistantIds = new Set((assistantLinksRaw ?? []).map((r) => r.offering_id + ":" + JSON.stringify(r.profiles)));
  const distinctAssistants = new Set(
    (assistantLinksRaw ?? [])
      .map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return p?.id;
      })
      .filter(Boolean)
  );
  void assistantIds;

  const totalExpected = (enrollments ?? []).length
    ? (enrollments ?? []).reduce((sum, e) => sum + (assignmentsPerOffering.get(e.offering_id) ?? 0), 0)
    : 0;
  const completionPct = totalExpected ? Math.round((totalSentAll / totalExpected) * 100) : 0;

  const pendingMessages = totalExpected - totalSentAll;

  // Per-offering completion → status breakdown buckets, and the first
  // offering's assistant breakdown for the "message completion" panel.
  const statusCounts = new Map<string, number>();
  const perOfferingAssistants = new Map<string, AssistantRow[]>();

  for (const offering of offerings) {
    const offeringEnrollments = (enrollments ?? []).filter((e) => e.offering_id === offering.id);
    const expectedPerStudent = assignmentsPerOffering.get(offering.id) ?? 0;
    const offeringAssistantRows = (assistantLinksRaw ?? []).filter((r) => r.offering_id === offering.id);

    const rows: AssistantRow[] = offeringAssistantRows
      .map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        if (!p) return null;
        const myStudents = offeringEnrollments.filter((e) => e.assistant_id === p.id);
        const total = myStudents.length * expectedPerStudent;
        const sent = myStudents.reduce((sum, e) => sum + (sentByStudentInOffering.get(`${offering.id}:${e.student_id}`) ?? 0), 0);
        const pct = total ? Math.round((sent / total) * 100) : 0;
        const track = trackInfo(pct);
        return { id: p.id, name: p.full_name, initials: p.initials, sent, total, pct, badge: { text: track.text, tone: track.tone, icon: track.icon as "check2" | "clock" | "alert" } };
      })
      .filter((x): x is AssistantRow => !!x);

    perOfferingAssistants.set(offering.id, rows);

    const offeringTotal = rows.reduce((s, r) => s + r.total, 0);
    const offeringSent = rows.reduce((s, r) => s + r.sent, 0);
    const offeringPct = offeringTotal ? Math.round((offeringSent / offeringTotal) * 100) : 0;
    const track = trackInfo(offeringPct);
    statusCounts.set(track.text, (statusCounts.get(track.text) ?? 0) + 1);
  }

  const STATUS_ORDER: { label: string; tone: Tone }[] = [
    { label: "Complete", tone: "ok" },
    { label: "On track", tone: "brand" },
    { label: "Behind", tone: "warn" },
    { label: "At risk", tone: "danger" },
  ];
  const statusBreakdown = STATUS_ORDER.map((s) => ({ label: s.label, tone: s.tone, count: statusCounts.get(s.label) ?? 0 })).filter(
    (s) => s.count > 0
  );

  // The KPI above (pendingMessages) is summed across every offering this
  // head runs, so the panel showing "the same number" broken down by
  // assistant needs to match that scope too — combine each assistant's
  // sent/total across every offering they help with, not just offerings[0].
  // A single-offering head would otherwise never notice, but anyone running
  // 2+ courses saw a KPI and a panel that silently disagreed.
  const combinedAssistants = new Map<string, { id: string; name: string; initials: string; sent: number; total: number }>();
  for (const rows of perOfferingAssistants.values()) {
    for (const r of rows) {
      const existing = combinedAssistants.get(r.id);
      if (existing) {
        existing.sent += r.sent;
        existing.total += r.total;
      } else {
        combinedAssistants.set(r.id, { id: r.id, name: r.name, initials: r.initials, sent: r.sent, total: r.total });
      }
    }
  }
  const assistants: AssistantRow[] = Array.from(combinedAssistants.values())
    .map((a) => {
      const pct = a.total ? Math.round((a.sent / a.total) * 100) : 0;
      const track = trackInfo(pct);
      return { id: a.id, name: a.name, initials: a.initials, sent: a.sent, total: a.total, pct, badge: { text: track.text, tone: track.tone, icon: track.icon as "check2" | "clock" | "alert" } };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const primaryOffering = offerings[0];
  const offeringLabel = offerings.length > 1 ? `All ${offerings.length} courses` : primaryOffering?.label ?? "";

  const kpis: Kpi[] = [
    { icon: "clipboard-list", value: String(offeringIds.length), label: "My courses", tone: "brand" },
    { icon: "grad", value: String(studentsCount), label: "Students", tone: "neutral" },
    { icon: "user-check", value: String(distinctAssistants.size), label: "Assistants", tone: "neutral" },
    { icon: "clock", value: String(Math.max(0, pendingMessages)), label: "Pending messages", tone: pendingMessages > 0 ? "warn" : "ok" },
  ];

  return { kpis, offeringLabel, assistants, statusBreakdown, completionPct };
}

export type RecentEnrollment = { name: string; initials: string; offering: string; enrolledAt: string };
export type UnassignedSummary = { offering: string; count: number };

export type RegistrationDashboard = {
  kpis: Kpi[];
  recentEnrollments: RecentEnrollment[];
  unassigned: UnassignedSummary[];
};

export async function getRegistrationDashboard(): Promise<RegistrationDashboard> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return { kpis: [], recentEnrollments: [], unassigned: [] };
  const supabase = await createClient();

  const { data: offeringRows } = await supabase
    .from("course_offerings")
    .select("id, session, unit, courses(name)")
    .eq("org_id", orgId);
  const offeringIds = (offeringRows ?? []).map((o) => o.id);
  const labelById = new Map((offeringRows ?? []).map((o) => [o.id, offeringLabelOf(o)]));

  const [{ count: studentsCount }, studentTrend] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    getStudentCountTrend(),
  ]);

  if (!offeringIds.length) {
    return {
      kpis: [
        { icon: "user-plus", value: "0", label: "New this week", tone: "brand" },
        { icon: "grad", value: String(studentsCount ?? 0), label: "Total students", tone: "neutral", trend: studentTrend },
        { icon: "clipboard-list", value: "0", label: "Active courses", tone: "neutral" },
        { icon: "alert", value: "0", label: "Unassigned students", tone: "ok" },
      ],
      recentEnrollments: [],
      unassigned: [],
    };
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  // Counts only — fetching every enrollment row just to count/filter them
  // client-side silently truncates at Supabase's default 1000-row cap once
  // an org has more enrollments than that.
  const [{ count: newThisWeek }, { data: unassignedRows }, { data: recentRows }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .in("offering_id", offeringIds)
      .gte("created_at", weekAgo),
    supabase.from("enrollments").select("offering_id").in("offering_id", offeringIds).is("assistant_id", null).limit(2000),
    supabase
      .from("enrollments")
      .select("offering_id, created_at, students(name, initials)")
      .in("offering_id", offeringIds)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const unassignedByOffering = new Map<string, number>();
  for (const e of unassignedRows ?? []) {
    unassignedByOffering.set(e.offering_id, (unassignedByOffering.get(e.offering_id) ?? 0) + 1);
  }

  const recentEnrollments: RecentEnrollment[] = (recentRows ?? []).map((e) => {
    const s = Array.isArray(e.students) ? e.students[0] : e.students;
    return {
      name: s?.name ?? "—",
      initials: s?.initials ?? "—",
      offering: labelById.get(e.offering_id) ?? "—",
      enrolledAt: e.created_at,
    };
  });

  const unassigned: UnassignedSummary[] = Array.from(unassignedByOffering.entries()).map(([id, count]) => ({
    offering: labelById.get(id) ?? "—",
    count,
  }));
  const unassignedCount = (unassignedRows ?? []).length;

  const kpis: Kpi[] = [
    { icon: "user-plus", value: String(newThisWeek ?? 0), label: "New this week", tone: "brand" },
    { icon: "grad", value: String(studentsCount ?? 0), label: "Total students", tone: "neutral", trend: studentTrend },
    { icon: "clipboard-list", value: String(offeringIds.length), label: "Active courses", tone: "neutral" },
    { icon: "alert", value: String(unassignedCount), label: "Unassigned students", tone: unassignedCount > 0 ? "warn" : "ok" },
  ];

  return { kpis, recentEnrollments, unassigned };
}

export type SalaryOverviewRow = { name: string; initials: string; offering: string; amount: number; status: "paid" | "pending" };
export type PaymentMethodSlice = { label: string; pct: number };

export type FinanceDashboard = {
  kpis: Kpi[];
  salaryOverview: SalaryOverviewRow[];
  paymentMethods: PaymentMethodSlice[];
  currencySymbol: string;
};

// Payroll runs in arrears — releasing pay on, say, Aug 1 pays out July's
// work, so "this period" for the finance dashboard always means last
// calendar month, not the one still in progress.
function currentPeriod() {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return { kpis: [], salaryOverview: [], paymentMethods: [], currencySymbol: "£" };
  const supabase = await createClient();
  const period = currentPeriod();

  const { data: org } = await supabase.from("organizations").select("currency").eq("id", orgId).single();
  const sym = currencySymbol(org?.currency);

  const { data: lines } = await supabase
    .from("salary_lines")
    .select(
      "payee_id, base, bonus, deduction, status, pay_method, profiles(full_name, initials), course_offerings!salary_lines_offering_id_fkey(session, unit, courses(name))"
    )
    .eq("org_id", orgId)
    .eq("period", period);

  const byPayee = new Map<string, { name: string; initials: string; total: number; status: "paid" | "pending"; offering: string; payMethod: string }>();
  let totalPayroll = 0;
  let bonusCount = 0;
  const methodCounts = new Map<string, number>();

  for (const l of lines ?? []) {
    const payee = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    if (!payee) continue;
    const offering = Array.isArray(l.course_offerings) ? l.course_offerings[0] : l.course_offerings;
    const subtotal = Number(l.base) + Number(l.bonus) - Number(l.deduction);
    totalPayroll += subtotal;
    if (Number(l.bonus) > 0) bonusCount++;
    methodCounts.set(l.pay_method, (methodCounts.get(l.pay_method) ?? 0) + 1);

    const existing = byPayee.get(l.payee_id);
    if (existing) {
      existing.total += subtotal;
      if (l.status !== "paid") existing.status = "pending";
    } else {
      byPayee.set(l.payee_id, {
        name: payee.full_name,
        initials: payee.initials,
        total: subtotal,
        status: l.status as "paid" | "pending",
        offering: offeringLabelOf(offering ?? { session: "", unit: null, courses: null }),
        payMethod: l.pay_method,
      });
    }
  }

  const assistants = Array.from(byPayee.values());
  const paidCount = assistants.filter((a) => a.status === "paid").length;

  const [{ count: pendingEvaluations }, payrollTrend] = await Promise.all([
    supabase.from("evaluations").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "submitted"),
    getFinancePayrollTrend(),
  ]);

  const totalMethodCount = Array.from(methodCounts.values()).reduce((s, n) => s + n, 0);
  const paymentMethods: PaymentMethodSlice[] = Array.from(methodCounts.entries())
    .map(([label, n]) => ({ label, pct: totalMethodCount ? Math.round((n / totalMethodCount) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct);

  const salaryOverview: SalaryOverviewRow[] = assistants
    .map((a) => ({ name: a.name, initials: a.initials, offering: a.offering, amount: Math.round(a.total), status: a.status }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6);

  const kpis: Kpi[] = [
    {
      icon: "wallet",
      value: `${sym}${Math.round(totalPayroll).toLocaleString()}`,
      label: "Payroll this month",
      tone: "brand",
      trend: payrollTrend.points.map((p) => p.total),
    },
    { icon: "card", value: `${paidCount}/${assistants.length}`, label: "Assistants paid", tone: "neutral" },
    { icon: "clock", value: String(pendingEvaluations ?? 0), label: "Pending approvals", tone: (pendingEvaluations ?? 0) > 0 ? "warn" : "ok" },
    { icon: "trend", value: String(bonusCount), label: "Bonuses issued", tone: "ok" },
  ];

  return { kpis, salaryOverview, paymentMethods, currencySymbol: sym };
}
