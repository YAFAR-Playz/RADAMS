"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type ReportAssignmentOption = {
  id: string;
  title: string;
  dueDate: string | null;
  includeInReport: boolean;
};

function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const start = `${period}-01`;
  const end = new Date(y, m, 1).toISOString().slice(0, 10);
  return { start, end };
}

// Assignments "in" a given month are ones due (or, if undated, created)
// within it — the same rule used for papers-checked/salary calculations
// elsewhere, so a head's report month lines up with what Finance already
// counts for that period.
export async function getReportAssignments(offeringId: string, period: string): Promise<ReportAssignmentOption[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { start, end } = monthRange(period);

  const { data } = await supabase.from("assignments").select("id, title, due_date, created_at, include_in_report").eq("offering_id", offeringId);
  return (data ?? [])
    .filter((a) => {
      const d = a.due_date ?? a.created_at.slice(0, 10);
      return d >= start && d < end;
    })
    .map((a) => ({ id: a.id, title: a.title, dueDate: a.due_date, includeInReport: a.include_in_report }))
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
}

export async function setAssignmentIncludeInReport(assignmentId: string, include: boolean) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").update({ include_in_report: include }).eq("id", assignmentId);
  if (error) throw new Error(error.message);
}

export async function getStudentMonthlyComment(studentId: string, offeringId: string, period: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_monthly_notes")
    .select("comment")
    .eq("student_id", studentId)
    .eq("offering_id", offeringId)
    .eq("period", period)
    .maybeSingle();
  return data?.comment ?? "";
}

export async function getMyStudentMonthlyComments(offeringId: string, period: string): Promise<Record<string, string>> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "assistant") return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_monthly_notes")
    .select("student_id, comment")
    .eq("offering_id", offeringId)
    .eq("period", period)
    .eq("assistant_id", profile.id);
  return Object.fromEntries((data ?? []).map((n) => [n.student_id, n.comment]));
}

export async function setStudentMonthlyComment(studentId: string, offeringId: string, period: string, comment: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || profile.role !== "assistant") throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("student_monthly_notes").upsert(
    {
      org_id: profile.org.id,
      student_id: studentId,
      offering_id: offeringId,
      period,
      assistant_id: profile.id,
      comment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,offering_id,period" }
  );
  if (error) throw new Error(error.message);
}

export type ReportAssignmentDetail = { title: string; status: string | null; grade: string | null; comment: string | null };
export type ReportWeakTopicMaterial = { kind: "video" | "drive"; link: string; duration: string | null };
export type ReportWeakTopic = { label: string; materials: ReportWeakTopicMaterial[] };

export type StudentAcademicReport = {
  studentId: string;
  studentName: string;
  studentCode: string;
  assignments: ReportAssignmentDetail[];
  weakTopics: ReportWeakTopic[];
  assistantComment: string;
};

export async function getAcademicMonthlyReport(offeringId: string, period: string): Promise<StudentAcademicReport[]> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin")) return [];
  const supabase = await createClient();

  const includedAssignments = (await getReportAssignments(offeringId, period)).filter((a) => a.includeInReport);
  const assignmentIds = includedAssignments.map((a) => a.id);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(id, name, student_code)")
    .eq("offering_id", offeringId);
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = enrollments.map((e) => e.student_id);

  const { data: logs } = assignmentIds.length
    ? await supabase.from("assignment_logs").select("assignment_id, student_id, status, grade, comment").in("assignment_id", assignmentIds).in("student_id", studentIds)
    : { data: [] as { assignment_id: string; student_id: string; status: string | null; grade: string | null; comment: string | null }[] };

  const { data: topics } = await supabase
    .from("student_topic_submissions")
    .select("student_id, topic_catalog(label, topic_materials(kind, link, duration, sort_order))")
    .eq("offering_id", offeringId)
    .eq("period", period)
    .eq("status", "approved")
    .in("student_id", studentIds);

  const { data: notes } = await supabase
    .from("student_monthly_notes")
    .select("student_id, comment")
    .eq("offering_id", offeringId)
    .eq("period", period)
    .in("student_id", studentIds);
  const noteByStudent = new Map((notes ?? []).map((n) => [n.student_id, n.comment]));

  return enrollments
    .map((e) => {
      const student = Array.isArray(e.students) ? e.students[0] : e.students;
      if (!student) return null;

      const assignments: ReportAssignmentDetail[] = includedAssignments.map((a) => {
        const log = (logs ?? []).find((l) => l.assignment_id === a.id && l.student_id === e.student_id);
        return { title: a.title, status: log?.status ?? null, grade: log?.grade ?? null, comment: log?.comment ?? null };
      });

      const weakTopics: ReportWeakTopic[] = (topics ?? [])
        .filter((t) => t.student_id === e.student_id)
        .map((t) => {
          const topic = Array.isArray(t.topic_catalog) ? t.topic_catalog[0] : t.topic_catalog;
          const materials = (topic ? (Array.isArray(topic.topic_materials) ? topic.topic_materials : []) : []).slice().sort((a, b) => a.sort_order - b.sort_order);
          return {
            label: topic?.label ?? "",
            materials: materials.map((m) => ({ kind: m.kind as "video" | "drive", link: m.link, duration: m.duration })),
          };
        });

      return {
        studentId: e.student_id,
        studentName: student.name,
        studentCode: student.student_code,
        assignments,
        weakTopics,
        assistantComment: noteByStudent.get(e.student_id) ?? "",
      };
    })
    .filter((x): x is StudentAcademicReport => !!x)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}
