"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { AssignmentStatus } from "@/lib/assignments-data";
import { resolveTemplateFlags } from "@/lib/assignment-template-fallback";

export type OfferingOption = { id: string; label: string };
export type AssignmentOption = {
  id: string;
  title: string;
  maxMarks: number;
  lettered: boolean;
  dueDate: string | null;
  hasGrade: boolean;
  hasComment: boolean;
};

export type RosterStudent = {
  enrollmentId: string;
  studentId: string;
  name: string;
  initials: string;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  assistantName: string | null;
  status: AssignmentStatus | null;
  grade: string | null;
  comment: string | null;
  sentAt: string | null;
};

export async function listMyOfferings(): Promise<OfferingOption[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  if (profile.role === "head") {
    const { data } = await supabase
      .from("offering_heads")
      .select("course_offerings(id, session, unit, courses(name))")
      .eq("head_id", profile.id);
    return (data ?? [])
      .map((row) => {
        const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
        if (!o) return null;
        const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
        return { id: o.id, label: [course?.name, o.session, o.unit].filter(Boolean).join(" · ") };
      })
      .filter((x): x is OfferingOption => !!x);
  }

  if (profile.role === "assistant") {
    const { data } = await supabase
      .from("offering_assistants")
      .select("course_offerings(id, session, unit, courses(name))")
      .eq("assistant_id", profile.id);
    return (data ?? [])
      .map((row) => {
        const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
        if (!o) return null;
        const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
        return { id: o.id, label: [course?.name, o.session, o.unit].filter(Boolean).join(" · ") };
      })
      .filter((x): x is OfferingOption => !!x);
  }

  if ((profile.role === "admin" || profile.role === "registration") && profile.org) {
    const { data } = await supabase
      .from("course_offerings")
      .select("id, session, unit, courses(name)")
      .eq("org_id", profile.org.id);
    return (data ?? [])
      .map((o) => {
        const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
        return { id: o.id, label: [course?.name, o.session, o.unit].filter(Boolean).join(" · ") };
      })
      .filter((x): x is OfferingOption => !!x);
  }

  return [];
}

export async function listAssignmentsForOffering(offeringId: string): Promise<AssignmentOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("id, title, max_marks, lettered, due_date, template, assignment_templates(has_grade, has_comment)")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map((a) => {
    const joined = Array.isArray(a.assignment_templates) ? a.assignment_templates[0] : a.assignment_templates;
    const { hasGrade, hasComment } = resolveTemplateFlags(a.template, joined);
    return {
      id: a.id,
      title: a.title,
      maxMarks: a.max_marks,
      lettered: a.lettered,
      dueDate: a.due_date,
      hasGrade,
      hasComment,
    };
  });
}

export async function getRoster(assignmentId: string): Promise<RosterStudent[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("offering_id")
    .eq("id", assignmentId)
    .single();
  if (!assignment) return [];

  let enrollmentQuery = supabase
    .from("enrollments")
    .select("id, student_id, assistant_id, students(id, name, initials, phone, guardian_name, guardian_phone), profiles(full_name)")
    .eq("offering_id", assignment.offering_id);

  if (profile.role === "assistant") {
    enrollmentQuery = enrollmentQuery.eq("assistant_id", profile.id);
  }

  const { data: enrollments, error } = await enrollmentQuery;
  if (error || !enrollments) return [];

  const studentIds = enrollments.map((e) => e.student_id);
  const { data: logs } = await supabase
    .from("assignment_logs")
    .select("student_id, status, grade, comment, sent_at")
    .eq("assignment_id", assignmentId)
    .in("student_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);

  const logByStudent = new Map((logs ?? []).map((l) => [l.student_id, l]));

  return enrollments
    .map((e) => {
      const student = Array.isArray(e.students) ? e.students[0] : e.students;
      if (!student) return null;
      const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      const log = logByStudent.get(e.student_id);
      return {
        enrollmentId: e.id,
        studentId: e.student_id,
        name: student.name,
        initials: student.initials,
        phone: student.phone,
        guardianName: student.guardian_name,
        guardianPhone: student.guardian_phone,
        assistantName: assistant?.full_name ?? null,
        status: (log?.status as AssignmentStatus | null) ?? null,
        grade: log?.grade ?? null,
        comment: log?.comment ?? null,
        sentAt: log?.sent_at ?? null,
      };
    })
    .filter((x): x is RosterStudent => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function upsertLog(
  assignmentId: string,
  studentId: string,
  patch: { status?: AssignmentStatus | null; grade?: string | null; comment?: string | null; sentAt?: string | null }
) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const supabase = await createClient();

  const row: Record<string, unknown> = {
    assignment_id: assignmentId,
    student_id: studentId,
    logged_by: profile.id,
    updated_at: new Date().toISOString(),
  };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.grade !== undefined) row.grade = patch.grade;
  if (patch.comment !== undefined) row.comment = patch.comment;
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt;

  const { error } = await supabase.from("assignment_logs").upsert(row, { onConflict: "assignment_id,student_id" });
  if (error) throw new Error(error.message);
}

export async function setStatus(assignmentId: string, studentId: string, status: AssignmentStatus | null) {
  await upsertLog(assignmentId, studentId, { status });
}

export async function setGrade(assignmentId: string, studentId: string, grade: string) {
  if (grade.trim()) {
    const supabase = await createClient();
    const { data: assignment } = await supabase.from("assignments").select("max_marks, lettered").eq("id", assignmentId).single();
    if (assignment && !assignment.lettered) {
      const numeric = Number(grade);
      if (Number.isFinite(numeric) && numeric > assignment.max_marks) {
        throw new Error(`Grade can't exceed ${assignment.max_marks} for this assignment.`);
      }
    }
  }
  await upsertLog(assignmentId, studentId, { grade: grade || null });
}

export async function setComment(assignmentId: string, studentId: string, comment: string) {
  await upsertLog(assignmentId, studentId, { comment: comment || null });
}

export async function markSent(assignmentId: string, studentId: string) {
  await upsertLog(assignmentId, studentId, { sentAt: new Date().toISOString() });
}
