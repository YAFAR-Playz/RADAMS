"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { IconName } from "@/components/icons";
import type { Tone } from "@/lib/roles";

export type NotificationItem = {
  id: string;
  icon: IconName;
  tone: Tone;
  title: string;
  detail: string;
  href: string;
  // Pre-fills the destination list page's search box (via the search
  // handoff mechanism) so clicking through lands the reader directly on
  // the relevant row instead of a generic unfiltered list.
  searchTerm?: string;
  createdAt: string;
};

const RECENT_DAYS = 7;
const RECENT_MESSAGE_DAYS = 14;
const UPCOMING_DAYS = 7;
const MISSING_ASSIGNMENTS_THRESHOLD = 5;

// Students with MISSING_ASSIGNMENTS_THRESHOLD+ assignments logged "missing"
// across the given offerings, scoped to the given assistant if provided.
async function getMissingAssignmentsAlerts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringIds: string[],
  assistantId?: string
): Promise<NotificationItem[]> {
  if (!offeringIds.length) return [];

  let enrollmentQuery = supabase.from("enrollments").select("student_id, students(name)").in("offering_id", offeringIds);
  if (assistantId) enrollmentQuery = enrollmentQuery.eq("assistant_id", assistantId);
  const { data: enrollments } = await enrollmentQuery;
  const studentIds = Array.from(new Set((enrollments ?? []).map((e) => e.student_id)));
  if (!studentIds.length) return [];
  const nameByStudent = new Map(
    (enrollments ?? []).map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      return [e.student_id, s?.name ?? "—"];
    })
  );

  const { data: assignments } = await supabase.from("assignments").select("id").in("offering_id", offeringIds);
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  if (!assignmentIds.length) return [];

  const { data: logs } = await supabase
    .from("assignment_logs")
    .select("student_id")
    .in("assignment_id", assignmentIds)
    .in("student_id", studentIds)
    .eq("status", "missing");

  const missingByStudent = new Map<string, number>();
  for (const l of logs ?? []) {
    missingByStudent.set(l.student_id, (missingByStudent.get(l.student_id) ?? 0) + 1);
  }

  const items: NotificationItem[] = [];
  for (const [studentId, count] of missingByStudent) {
    if (count < MISSING_ASSIGNMENTS_THRESHOLD) continue;
    items.push({
      id: `missing-${studentId}`,
      icon: "alert",
      tone: "danger",
      title: `${nameByStudent.get(studentId) ?? "A student"} has ${count} missing assignments`,
      detail: "Check their assignment log",
      href: "/students",
      createdAt: new Date().toISOString(),
    });
  }
  return items;
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

// Payroll runs in arrears — releasing pay on, say, Aug 1 pays out July's
// work, so "this payroll period" always means last calendar month, not the
// one still in progress.
function currentPeriod() {
  const d = new Date();
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

async function getAssistantNotifications(orgId: string, assistantId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const since = daysAgoIso(RECENT_DAYS);
  const items: NotificationItem[] = [];

  const { data: myOfferings } = await supabase.from("offering_assistants").select("offering_id").eq("assistant_id", assistantId);
  const offeringIds = (myOfferings ?? []).map((o) => o.offering_id);

  if (offeringIds.length) {
    const { data: assignments } = await supabase
      .from("assignments")
      .select("id, title, created_at, course_offerings(session, unit, courses(name))")
      .in("offering_id", offeringIds)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const a of assignments ?? []) {
      const o = Array.isArray(a.course_offerings) ? a.course_offerings[0] : a.course_offerings;
      items.push({
        id: `assignment-${a.id}`,
        icon: "clipboard-list",
        tone: "brand",
        title: `New assignment: ${a.title}`,
        detail: offeringLabel(o),
        href: "/assignments",
        createdAt: a.created_at,
      });
    }
  }

  const { data: newStudents } = await supabase
    .from("enrollments")
    .select("id, created_at, students(name), course_offerings(session, unit, courses(name))")
    .eq("assistant_id", assistantId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  for (const e of newStudents ?? []) {
    const student = Array.isArray(e.students) ? e.students[0] : e.students;
    const o = Array.isArray(e.course_offerings) ? e.course_offerings[0] : e.course_offerings;
    items.push({
      id: `student-${e.id}`,
      icon: "grad",
      tone: "ok",
      title: `New student: ${student?.name ?? "—"}`,
      detail: offeringLabel(o),
      href: "/students",
      createdAt: e.created_at,
    });
  }

  items.push(...(await getMissingAssignmentsAlerts(supabase, offeringIds, assistantId)));

  return items;
}

async function getHeadNotifications(orgId: string, headId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const since = daysAgoIso(RECENT_DAYS);
  const items: NotificationItem[] = [];

  const { data: myOfferings } = await supabase.from("offering_heads").select("offering_id").eq("head_id", headId);
  const offeringIds = (myOfferings ?? []).map((o) => o.offering_id);
  if (!offeringIds.length) return items;

  const { data: newStudents } = await supabase
    .from("enrollments")
    .select("id, created_at, students(name), course_offerings(session, unit, courses(name))")
    .in("offering_id", offeringIds)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5);
  for (const e of newStudents ?? []) {
    const student = Array.isArray(e.students) ? e.students[0] : e.students;
    const o = Array.isArray(e.course_offerings) ? e.course_offerings[0] : e.course_offerings;
    items.push({
      id: `student-${e.id}`,
      icon: "grad",
      tone: "ok",
      title: `New student: ${student?.name ?? "—"}`,
      detail: offeringLabel(o),
      href: "/students",
      createdAt: e.created_at,
    });
  }

  const { data: assignments } = await supabase.from("assignments").select("id, title, offering_id").in("offering_id", offeringIds);
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const assignmentById = new Map((assignments ?? []).map((a) => [a.id, a]));

  if (assignmentIds.length) {
    const { data: logs } = await supabase
      .from("assignment_logs")
      .select("assignment_id, status, sent_at, updated_at")
      .in("assignment_id", assignmentIds)
      .gte("updated_at", since);

    const checkedByAssignment = new Map<string, number>();
    const sentByAssignment = new Map<string, number>();
    for (const l of logs ?? []) {
      if (l.status === "checked") checkedByAssignment.set(l.assignment_id, (checkedByAssignment.get(l.assignment_id) ?? 0) + 1);
    }
    const { data: allLogs } = await supabase.from("assignment_logs").select("assignment_id, sent_at").in("assignment_id", assignmentIds);
    const totalByAssignment = new Map<string, number>();
    for (const l of allLogs ?? []) {
      totalByAssignment.set(l.assignment_id, (totalByAssignment.get(l.assignment_id) ?? 0) + 1);
      if (l.sent_at) sentByAssignment.set(l.assignment_id, (sentByAssignment.get(l.assignment_id) ?? 0) + 1);
    }

    for (const [assignmentId, checkedCount] of checkedByAssignment) {
      const a = assignmentById.get(assignmentId);
      if (!a) continue;
      items.push({
        id: `checked-${assignmentId}`,
        icon: "check2",
        tone: "ok",
        title: `${checkedCount} paper${checkedCount === 1 ? "" : "s"} checked`,
        detail: a.title,
        href: "/checking",
        createdAt: new Date().toISOString(),
      });
    }
    for (const [assignmentId, total] of totalByAssignment) {
      const a = assignmentById.get(assignmentId);
      const sent = sentByAssignment.get(assignmentId) ?? 0;
      if (a && total > 0 && sent === total) {
        items.push({
          id: `sent-${assignmentId}`,
          icon: "send",
          tone: "ok",
          title: `All updates sent for "${a.title}"`,
          detail: `${sent} of ${total} guardians messaged`,
          href: "/checking",
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  items.push(...(await getMissingAssignmentsAlerts(supabase, offeringIds)));

  return items;
}

async function getHrNotifications(orgId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staffing_requests")
    .select("id, kind, status, created_at, candidate_name, course_offerings(session, unit, courses(name))")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(8);

  return (data ?? []).map((r) => {
    const o = Array.isArray(r.course_offerings) ? r.course_offerings[0] : r.course_offerings;
    const kindLabel = r.kind === "add" ? "New staffing request" : r.kind === "remove" ? "Removal request" : "Replacement request";
    return {
      id: `request-${r.id}`,
      icon: "inbox" as const,
      tone: "warn" as const,
      title: kindLabel,
      detail: `${r.candidate_name ?? "—"} · ${offeringLabel(o)}`,
      href: "/requests",
      createdAt: r.created_at,
    };
  });
}

async function getFinanceNotifications(orgId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const period = currentPeriod();
  const items: NotificationItem[] = [];

  const { count: linesThisPeriod } = await supabase
    .from("salary_lines")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("period", period);
  if (!linesThisPeriod) {
    items.push({
      id: "new-month",
      icon: "wallet",
      tone: "brand",
      title: "New payroll period",
      detail: `${period} hasn't been run yet`,
      href: "/salaries",
      createdAt: new Date().toISOString(),
    });
  }

  const { count: pendingCount } = await supabase
    .from("salary_lines")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("period", period)
    .eq("status", "pending");
  if (pendingCount) {
    items.push({
      id: "pending-payments",
      icon: "clock",
      tone: "warn",
      title: `${pendingCount} pending payment${pendingCount === 1 ? "" : "s"}`,
      detail: `For ${period}`,
      href: "/salaries",
      createdAt: new Date().toISOString(),
    });
  }

  const since = daysAgoIso(RECENT_MESSAGE_DAYS);
  const { data: messages } = await supabase
    .from("finance_messages")
    .select("id, from_id, payee_id, body, created_at, profiles!finance_messages_from_id_fkey(full_name)")
    .eq("org_id", orgId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(8);
  for (const m of messages ?? []) {
    // Only the original inquiry (sent by the payee themselves) is
    // notification-worthy here — otherwise Finance/Admin's own replies would
    // show up as a "Salary inquiry from [themselves]" notification.
    if (m.from_id !== m.payee_id) continue;
    const sender = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    items.push({
      id: `inquiry-${m.id}`,
      icon: "message",
      tone: "info",
      title: `Salary inquiry from ${sender?.full_name ?? "staff"}`,
      detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
      // /payments is finance-only and has no message UI anyway — /salaries
      // is shared by finance and admin and now has the actual reply panel.
      href: "/salaries",
      searchTerm: sender?.full_name,
      createdAt: m.created_at,
    });
  }

  return items;
}

async function getRegistrationNotifications(orgId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const soonStr = new Date(Date.now() + UPCOMING_DAYS * 86400000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("course_offerings")
    .select("id, session, unit, start_date, end_date, courses(name)")
    .eq("org_id", orgId)
    .eq("active", true);

  const items: NotificationItem[] = [];
  for (const o of data ?? []) {
    const label = offeringLabel(o);
    if (o.start_date && o.start_date >= todayStr && o.start_date <= soonStr) {
      items.push({
        id: `start-${o.id}`,
        icon: "cal-check",
        tone: "info",
        title: `${label} starts soon`,
        detail: `Starts ${new Date(o.start_date).toLocaleDateString()}`,
        href: "/registrations",
        createdAt: new Date().toISOString(),
      });
    }
    if (o.end_date && o.end_date >= todayStr && o.end_date <= soonStr) {
      items.push({
        id: `end-${o.id}`,
        icon: "cal-check",
        tone: "warn",
        title: `${label} ending soon`,
        detail: `Ends ${new Date(o.end_date).toLocaleDateString()}`,
        href: "/registrations",
        createdAt: new Date().toISOString(),
      });
    }
  }
  return items;
}

// Unread chat messages surface in the same bell dropdown as everything else
// — nobody should have to separately remember to check the Chat tab.
async function getChatNotifications(profileId: string): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("chat_conversation_members").select("conversation_id, last_read_at").eq("profile_id", profileId);
  if (!memberships?.length) return [];

  const convIds = memberships.map((m) => m.conversation_id);
  const readByConv = new Map(memberships.map((m) => [m.conversation_id, m.last_read_at as string | null]));

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("conversation_id, body, created_at, sender_id, profiles(full_name)")
    .in("conversation_id", convIds)
    .neq("sender_id", profileId)
    .order("created_at", { ascending: false });

  const seenConv = new Set<string>();
  const items: NotificationItem[] = [];
  for (const m of messages ?? []) {
    const lastRead = readByConv.get(m.conversation_id);
    if (lastRead && m.created_at <= lastRead) continue;
    if (seenConv.has(m.conversation_id)) continue;
    seenConv.add(m.conversation_id);
    const sender = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    items.push({
      id: `chat-${m.conversation_id}`,
      icon: "message",
      tone: "brand",
      title: `New message from ${sender?.full_name ?? "a colleague"}`,
      detail: m.body.length > 80 ? `${m.body.slice(0, 80)}…` : m.body,
      href: "/chat",
      createdAt: m.created_at,
    });
  }
  return items;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  if (profile.role === "owner") {
    const supabase = await createClient();
    const items: NotificationItem[] = [];
    const { count: pendingOrgs } = await supabase.from("organizations").select("id", { count: "exact", head: true }).eq("status", "trial");
    if (pendingOrgs) {
      items.push({
        id: "trial-orgs",
        icon: "building",
        tone: "info",
        title: `${pendingOrgs} organization${pendingOrgs === 1 ? "" : "s"} on trial`,
        detail: "Review and activate when ready",
        href: "/orgs",
        createdAt: new Date().toISOString(),
      });
    }
    return items;
  }

  const orgId = profile.org?.id;
  if (!orgId) return [];

  const chat = await getChatNotifications(profile.id);

  if (profile.role === "assistant") return [...(await getAssistantNotifications(orgId, profile.id)), ...chat];
  if (profile.role === "head") return [...(await getHeadNotifications(orgId, profile.id)), ...chat];
  if (profile.role === "hr") return [...(await getHrNotifications(orgId)), ...chat];
  if (profile.role === "finance") return [...(await getFinanceNotifications(orgId)), ...chat];
  if (profile.role === "registration") return [...(await getRegistrationNotifications(orgId)), ...chat];

  if (profile.role === "admin") {
    const supabase = await createClient();
    const [hr, finance, registration] = await Promise.all([
      getHrNotifications(orgId),
      getFinanceNotifications(orgId),
      getRegistrationNotifications(orgId),
    ]);
    const items = [...hr, ...finance, ...registration, ...chat];

    const { count: unassigned } = await supabase
      .from("enrollments")
      .select("id, course_offerings!inner(org_id)", { count: "exact", head: true })
      .is("assistant_id", null)
      .eq("course_offerings.org_id", orgId);
    if (unassigned) {
      items.push({
        id: "system-unassigned",
        icon: "alert",
        tone: "warn",
        title: `${unassigned} unassigned student${unassigned === 1 ? "" : "s"}`,
        detail: "Org-wide overview",
        href: "/students",
        createdAt: new Date().toISOString(),
      });
    }

    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  return [];
}
