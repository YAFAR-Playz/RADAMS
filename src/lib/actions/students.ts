"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type ProgressCell = { assignmentTitle: string; status: string | null };

export type StudentRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  assistantId: string | null;
  assistantName: string | null;
  enrolledAt: string;
  leftAt: string | null;
  avgGrade: number | null;
  cells: ProgressCell[];
};

export type AssistantOption = { id: string; name: string };

export async function getStudentsForOffering(offeringId: string): Promise<StudentRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  let query = supabase
    .from("enrollments")
    .select(
      "id, student_id, assistant_id, created_at, students(id, name, initials, email, phone, guardian_name, guardian_phone, left_at), profiles(id, full_name)"
    )
    .eq("offering_id", offeringId);

  if (profile.role === "assistant") {
    query = query.eq("assistant_id", profile.id);
  }

  const { data: enrollments, error } = await query;
  if (error || !enrollments) return [];

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title, created_at")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: true })
    .limit(5);
  const assignments = assignmentRows ?? [];
  const assignmentIds = assignments.map((a) => a.id);

  const studentIds = enrollments.map((e) => e.student_id);
  const { data: logs } = assignmentIds.length && studentIds.length
    ? await supabase
        .from("assignment_logs")
        .select("assignment_id, student_id, status, grade")
        .in("assignment_id", assignmentIds)
        .in("student_id", studentIds)
    : { data: [] as { assignment_id: string; student_id: string; status: string | null; grade: string | null }[] };

  const logsByStudent = new Map<string, { assignment_id: string; status: string | null; grade: string | null }[]>();
  for (const log of logs ?? []) {
    const list = logsByStudent.get(log.student_id) ?? [];
    list.push(log);
    logsByStudent.set(log.student_id, list);
  }

  return enrollments
    .map((e) => {
      const student = Array.isArray(e.students) ? e.students[0] : e.students;
      const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      if (!student) return null;
      const studentLogs = logsByStudent.get(e.student_id) ?? [];
      const cells: ProgressCell[] = assignments.map((a) => {
        const log = studentLogs.find((l) => l.assignment_id === a.id);
        return { assignmentTitle: a.title, status: log?.status ?? null };
      });
      const numericGrades = studentLogs.map((l) => Number(l.grade)).filter((n) => !Number.isNaN(n));
      const avgGrade = numericGrades.length ? Math.round(numericGrades.reduce((s, n) => s + n, 0) / numericGrades.length) : null;
      return {
        enrollmentId: e.id,
        studentId: e.student_id,
        name: student.name,
        initials: student.initials,
        email: student.email,
        phone: student.phone,
        guardianName: student.guardian_name,
        guardianPhone: student.guardian_phone,
        assistantId: e.assistant_id,
        assistantName: assistant?.full_name ?? null,
        enrolledAt: e.created_at,
        leftAt: student.left_at,
        avgGrade,
        cells,
      };
    })
    .filter((x): x is StudentRow => !!x);
}

export async function reassignStudentAssistant(enrollmentId: string, assistantId: string | null) {
  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").update({ assistant_id: assistantId }).eq("id", enrollmentId);
  if (error) throw new Error(error.message);
}

export async function updateStudent(
  studentId: string,
  patch: {
    name: string;
    email: string;
    phone: string;
    guardianName: string;
    guardianPhone: string;
    left: boolean;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      name: patch.name,
      email: patch.email || null,
      phone: patch.phone || null,
      guardian_name: patch.guardianName || null,
      guardian_phone: patch.guardianPhone || null,
      left_at: patch.left ? new Date().toISOString() : null,
    })
    .eq("id", studentId);
  if (error) throw new Error(error.message);
}
