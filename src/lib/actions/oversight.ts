"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { AssignmentStatus } from "@/lib/assignments-data";

export type OfferingOption = { id: string; label: string };

export type AssistantSummary = {
  id: string;
  name: string;
  initials: string;
  students: number;
  sent: number;
  total: number;
};

export type OversightStats = {
  assistants: number;
  sent: number;
  pending: number;
  completionPct: number;
};

export type OversightComment = {
  studentId: string;
  studentName: string;
  initials: string;
  assignment: string;
  status: AssignmentStatus | null;
  grade: string | null;
  comment: string | null;
  sent: boolean;
};

export type FullExportRow = {
  studentCode: string;
  studentName: string;
  assistantName: string;
  enrolledAt: string;
  leftAt: string | null;
  assignmentsChecked: number;
  assignmentsTotal: number;
  attendancePct: number;
};

export async function getFullExport(offeringId: string): Promise<FullExportRow[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "head") return [];
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, created_at, students(student_code, name, left_at), profiles(full_name)")
    .eq("offering_id", offeringId);
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = enrollments.map((e) => e.student_id);

  const { data: assignments } = await supabase.from("assignments").select("id").eq("offering_id", offeringId);
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: logs } = assignmentIds.length
    ? await supabase.from("assignment_logs").select("student_id, status").in("assignment_id", assignmentIds).in("student_id", studentIds)
    : { data: [] as { student_id: string; status: string | null }[] };
  const checkedByStudent = new Map<string, number>();
  for (const l of logs ?? []) {
    if (l.status === "checked") checkedByStudent.set(l.student_id, (checkedByStudent.get(l.student_id) ?? 0) + 1);
  }

  const { data: sessions } = await supabase.from("attendance_sessions").select("id").eq("offering_id", offeringId);
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: attendance } = sessionIds.length
    ? await supabase.from("attendance_records").select("student_id, status").in("session_id", sessionIds).in("student_id", studentIds)
    : { data: [] as { student_id: string; status: string }[] };
  const attendanceTotal = new Map<string, number>();
  const attendancePresent = new Map<string, number>();
  for (const a of attendance ?? []) {
    attendanceTotal.set(a.student_id, (attendanceTotal.get(a.student_id) ?? 0) + 1);
    if (a.status === "present" || a.status === "late") attendancePresent.set(a.student_id, (attendancePresent.get(a.student_id) ?? 0) + 1);
  }

  return enrollments
    .map((e) => {
      const student = Array.isArray(e.students) ? e.students[0] : e.students;
      const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      if (!student) return null;
      const total = attendanceTotal.get(e.student_id) ?? 0;
      const present = attendancePresent.get(e.student_id) ?? 0;
      return {
        studentCode: student.student_code,
        studentName: student.name,
        assistantName: assistant?.full_name ?? "—",
        enrolledAt: e.created_at,
        leftAt: student.left_at,
        assignmentsChecked: checkedByStudent.get(e.student_id) ?? 0,
        assignmentsTotal: assignmentIds.length,
        attendancePct: total ? Math.round((present / total) * 100) : 0,
      };
    })
    .filter((x): x is FullExportRow => !!x)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export type GradeBand = { label: string; min: number };
export type GradeScaleSetting = { scale: "percentage" | "letter" | "numeric"; bands: GradeBand[] };

export async function getGradeScale(offeringId: string): Promise<GradeScaleSetting> {
  const supabase = await createClient();
  const { data } = await supabase.from("course_offerings").select("grade_scale, grade_bands").eq("id", offeringId).single();
  return {
    scale: (data?.grade_scale as GradeScaleSetting["scale"]) ?? "percentage",
    bands: (data?.grade_bands as GradeBand[] | null) ?? [],
  };
}

export async function setGradeScale(offeringId: string, setting: GradeScaleSetting) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_offerings")
    .update({ grade_scale: setting.scale, grade_bands: setting.scale !== "percentage" ? setting.bands : null })
    .eq("id", offeringId);
  if (error) throw new Error(error.message);
}

export async function listHeadOfferings(): Promise<OfferingOption[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "head") return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("offering_heads")
    .select("course_offerings(id, session, unit, active, courses(name))")
    .eq("head_id", profile.id);

  return (data ?? [])
    .map((row) => {
      const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
      if (!o || !o.active) return null;
      const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
      return { id: o.id, label: [course?.name, o.session, o.unit].filter(Boolean).join(" · ") };
    })
    .filter((x): x is OfferingOption => !!x);
}

export async function getOversightSummary(
  offeringId: string
): Promise<{ stats: OversightStats; assistants: AssistantSummary[] }> {
  const supabase = await createClient();

  const { data: assistantLinks } = await supabase
    .from("offering_assistants")
    .select("profiles(id, full_name, initials)")
    .eq("offering_id", offeringId);

  const { data: assignmentRows } = await supabase.from("assignments").select("id").eq("offering_id", offeringId);
  const assignmentIds = (assignmentRows ?? []).map((a) => a.id);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, assistant_id")
    .eq("offering_id", offeringId);

  const { data: logs } = assignmentIds.length
    ? await supabase.from("assignment_logs").select("student_id, sent_at").in("assignment_id", assignmentIds)
    : { data: [] as { student_id: string; sent_at: string | null }[] };

  const sentByStudent = new Map<string, number>();
  for (const log of logs ?? []) {
    if (log.sent_at) sentByStudent.set(log.student_id, (sentByStudent.get(log.student_id) ?? 0) + 1);
  }

  const expectedPerStudent = Math.max(1, assignmentIds.length);

  const assistants: AssistantSummary[] = (assistantLinks ?? [])
    .map((row) => {
      const a = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!a) return null;
      const myStudents = (enrollments ?? []).filter((e) => e.assistant_id === a.id);
      const total = myStudents.length * expectedPerStudent;
      const sent = myStudents.reduce((sum, e) => sum + (sentByStudent.get(e.student_id) ?? 0), 0);
      return { id: a.id, name: a.full_name, initials: a.initials, students: myStudents.length, sent, total };
    })
    .filter((x): x is AssistantSummary => !!x);

  const totalSent = assistants.reduce((sum, a) => sum + a.sent, 0);
  const totalMessages = assistants.reduce((sum, a) => sum + a.total, 0);
  const pending = totalMessages - totalSent;
  const completionPct = totalMessages ? Math.round((totalSent / totalMessages) * 100) : 0;

  return {
    stats: { assistants: assistants.length, sent: totalSent, pending, completionPct },
    assistants,
  };
}

export async function getAssistantComments(offeringId: string, assistantId: string): Promise<OversightComment[]> {
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(id, name, initials)")
    .eq("offering_id", offeringId)
    .eq("assistant_id", assistantId);

  const studentIds = (enrollments ?? []).map((e) => e.student_id);
  if (!studentIds.length) return [];

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title")
    .eq("offering_id", offeringId);
  const titleById = new Map((assignmentRows ?? []).map((a) => [a.id, a.title]));
  const assignmentIds = (assignmentRows ?? []).map((a) => a.id);

  if (!assignmentIds.length) return [];

  const { data: logs } = await supabase
    .from("assignment_logs")
    .select("assignment_id, student_id, status, grade, comment, sent_at")
    .in("assignment_id", assignmentIds)
    .in("student_id", studentIds);

  const studentById = new Map(
    (enrollments ?? []).map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      return [e.student_id, s];
    })
  );

  return (logs ?? [])
    .map((log) => {
      const student = studentById.get(log.student_id);
      if (!student) return null;
      return {
        studentId: log.student_id,
        studentName: student.name,
        initials: student.initials,
        assignment: titleById.get(log.assignment_id) ?? "—",
        status: log.status as AssignmentStatus | null,
        grade: log.grade,
        comment: log.comment,
        sent: !!log.sent_at,
      };
    })
    .filter((x): x is OversightComment => !!x)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}
