"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { Kpi, Tone } from "@/lib/roles";
import { trackInfo } from "@/lib/oversight-data";

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
    supabase.from("profiles").select("role").eq("org_id", orgId),
    supabase.from("course_offerings").select("id, session, unit, courses(name)").eq("org_id", orgId),
  ]);

  const offeringIds = (offeringRows ?? []).map((o) => o.id);
  const { data: assignmentRows } = offeringIds.length
    ? await supabase.from("assignments").select("id, due_date, closed_at, offering_id").in("offering_id", offeringIds)
    : { data: [] as { id: string; due_date: string | null; closed_at: string | null; offering_id: string }[] };

  const today = new Date().toISOString().slice(0, 10);
  const pendingTasks = (assignmentRows ?? []).filter((a) => !a.closed_at && a.due_date && a.due_date < today).length;

  const { data: enrollmentRows } = offeringIds.length
    ? await supabase.from("enrollments").select("offering_id, student_id").in("offering_id", offeringIds)
    : { data: [] as { offering_id: string; student_id: string }[] };

  const studentsByOffering = new Map<string, number>();
  for (const e of enrollmentRows ?? []) {
    studentsByOffering.set(e.offering_id, (studentsByOffering.get(e.offering_id) ?? 0) + 1);
  }

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

  const kpis: Kpi[] = [
    { icon: "grad", value: String(studentsCount ?? 0), label: "Students", tone: "brand" },
    { icon: "users", value: String((staff ?? []).length), label: "Staff members", tone: "neutral" },
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

  const { data: assignedRows } = await supabase
    .from("assignment_assistants")
    .select("assignment_id")
    .eq("assistant_id", profile.id);
  const assignedAssignmentIds = (assignedRows ?? []).map((r) => r.assignment_id);

  const { data: assignments } = assignedAssignmentIds.length
    ? await supabase.from("assignments").select("id, title, offering_id, closed_at").in("id", assignedAssignmentIds)
    : { data: [] as { id: string; title: string; offering_id: string; closed_at: string | null }[] };

  const openAssignments = (assignments ?? []).filter((a) => !a.closed_at);

  const { data: logs } = assignedAssignmentIds.length
    ? await supabase.from("assignment_logs").select("assignment_id, student_id, status").in("assignment_id", assignedAssignmentIds)
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

  const [{ data: enrollments }, { data: assistantLinksRaw }, { data: assignmentRows }] = await Promise.all([
    supabase.from("enrollments").select("offering_id, student_id, assistant_id").in("offering_id", offeringIds),
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

  const primaryOffering = offerings[0];
  const assistants = primaryOffering ? perOfferingAssistants.get(primaryOffering.id) ?? [] : [];

  const kpis: Kpi[] = [
    { icon: "clipboard-list", value: String(offeringIds.length), label: "My courses", tone: "brand" },
    { icon: "grad", value: String(studentsCount), label: "Students", tone: "neutral" },
    { icon: "user-check", value: String(distinctAssistants.size), label: "Assistants", tone: "neutral" },
    { icon: "clock", value: String(Math.max(0, pendingMessages)), label: "Pending messages", tone: pendingMessages > 0 ? "warn" : "ok" },
  ];

  return { kpis, offeringLabel: primaryOffering?.label ?? "", assistants, statusBreakdown, completionPct };
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

  const { count: studentsCount } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("org_id", orgId);

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
  const { data: enrollments } = offeringIds.length
    ? await supabase
        .from("enrollments")
        .select("offering_id, assistant_id, created_at, students(name, initials)")
        .in("offering_id", offeringIds)
        .order("created_at", { ascending: false })
    : { data: [] as { offering_id: string; assistant_id: string | null; created_at: string; students: { name: string; initials: string } | { name: string; initials: string }[] | null }[] };

  const newThisWeek = (enrollments ?? []).filter((e) => e.created_at >= weekAgo).length;
  const unassignedRows = (enrollments ?? []).filter((e) => !e.assistant_id);

  const unassignedByOffering = new Map<string, number>();
  for (const e of unassignedRows) {
    unassignedByOffering.set(e.offering_id, (unassignedByOffering.get(e.offering_id) ?? 0) + 1);
  }

  const recentEnrollments: RecentEnrollment[] = (enrollments ?? []).slice(0, 6).map((e) => {
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

  const kpis: Kpi[] = [
    { icon: "user-plus", value: String(newThisWeek), label: "New this week", tone: "brand" },
    { icon: "grad", value: String(studentsCount ?? 0), label: "Total students", tone: "neutral" },
    { icon: "clipboard-list", value: String(offeringIds.length), label: "Active courses", tone: "neutral" },
    { icon: "alert", value: String(unassignedRows.length), label: "Unassigned students", tone: unassignedRows.length > 0 ? "warn" : "ok" },
  ];

  return { kpis, recentEnrollments, unassigned };
}
