"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { getGradeScale, type GradeScaleSetting } from "@/lib/actions/oversight";
import { resolveTemplateFlags } from "@/lib/assignment-template-fallback";

export type ReportAssignmentOption = {
  id: string;
  title: string;
  dueDate: string | null;
  includeInReport: boolean;
  hasGrade: boolean;
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

  const { data } = await supabase
    .from("assignments")
    .select("id, title, due_date, created_at, include_in_report, template, assignment_templates(has_grade, has_comment)")
    .eq("offering_id", offeringId);
  return (data ?? [])
    .filter((a) => {
      const d = a.due_date ?? a.created_at.slice(0, 10);
      return d >= start && d < end;
    })
    .map((a) => {
      const joined = Array.isArray(a.assignment_templates) ? a.assignment_templates[0] : a.assignment_templates;
      const { hasGrade } = resolveTemplateFlags(a.template, joined);
      return { id: a.id, title: a.title, dueDate: a.due_date, includeInReport: a.include_in_report, hasGrade };
    })
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

// Head-facing counterpart to getMyStudentMonthlyComments — every enrolled
// student's comment for the offering, not just the caller's own.
export async function getAllStudentMonthlyComments(offeringId: string, period: string): Promise<Record<string, string>> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin")) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("student_monthly_notes").select("student_id, comment").eq("offering_id", offeringId).eq("period", period);
  return Object.fromEntries((data ?? []).map((n) => [n.student_id, n.comment]));
}

// Lets a head create or override a student's monthly comment directly,
// instead of only the enrolled assistant being able to write it. The note
// is still attributed to that student's actual assigned assistant (not the
// head), matching how submitStudentTopic attributes head-added weak topics —
// this is "who this note is about", not "who last typed it".
export async function setStudentMonthlyCommentAsHead(studentId: string, offeringId: string, period: string, comment: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("assistant_id")
    .eq("student_id", studentId)
    .eq("offering_id", offeringId)
    .maybeSingle();
  if (!enrollment?.assistant_id) throw new Error("This student has no assistant assigned yet.");

  const { error } = await supabase.from("student_monthly_notes").upsert(
    {
      org_id: profile.org.id,
      student_id: studentId,
      offering_id: offeringId,
      period,
      assistant_id: enrollment.assistant_id,
      comment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,offering_id,period" }
  );
  if (error) throw new Error(error.message);
}

export type ReportAssignmentDetail = {
  title: string;
  status: string | null;
  grade: string | null;
  maxMarks: number | null;
  reportGroup: "homework" | "classwork" | "quiz" | "mock_exam" | "other";
};
export type ReportWeakTopicMaterial = { kind: "video" | "notes" | "tricky_question"; label: string | null; link: string; duration: string | null };
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

  const { data: assignmentMeta } = assignmentIds.length
    ? await supabase.from("assignments").select("id, max_marks, assignment_templates(report_group)").in("id", assignmentIds)
    : { data: [] as { id: string; max_marks: number | null; assignment_templates: { report_group: string } | { report_group: string }[] | null }[] };
  const maxMarksByAssignment = new Map((assignmentMeta ?? []).map((a) => [a.id, a.max_marks]));
  const reportGroupByAssignment = new Map(
    (assignmentMeta ?? []).map((a) => {
      const tpl = Array.isArray(a.assignment_templates) ? a.assignment_templates[0] : a.assignment_templates;
      return [a.id, (tpl?.report_group as "homework" | "classwork" | "quiz" | "mock_exam" | "other") ?? "homework"];
    })
  );

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(id, name, student_code)")
    .eq("offering_id", offeringId);
  if (!enrollments || enrollments.length === 0) return [];

  const studentIds = enrollments.map((e) => e.student_id);

  const { data: logs } = assignmentIds.length
    ? await supabase.from("assignment_logs").select("assignment_id, student_id, status, grade").in("assignment_id", assignmentIds).in("student_id", studentIds)
    : { data: [] as { assignment_id: string; student_id: string; status: string | null; grade: string | null }[] };

  const { data: topics } = await supabase
    .from("student_topic_submissions")
    .select("student_id, topic_catalog(label, topic_materials(kind, label, link, duration, sort_order))")
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
        return {
          title: a.title,
          status: log?.status ?? null,
          grade: log?.grade ?? null,
          maxMarks: maxMarksByAssignment.get(a.id) ?? null,
          reportGroup: reportGroupByAssignment.get(a.id) ?? "homework",
        };
      });

      const weakTopics: ReportWeakTopic[] = (topics ?? [])
        .filter((t) => t.student_id === e.student_id)
        .map((t) => {
          const topic = Array.isArray(t.topic_catalog) ? t.topic_catalog[0] : t.topic_catalog;
          const materials = (topic ? (Array.isArray(topic.topic_materials) ? topic.topic_materials : []) : []).slice().sort((a, b) => a.sort_order - b.sort_order);
          return {
            label: topic?.label ?? "",
            materials: materials.map((m) => ({ kind: m.kind as "video" | "notes" | "tricky_question", label: m.label, link: m.link, duration: m.duration })),
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

// ---------------------------------------------------------------------------
// Monthly report generation — freezes a point-in-time snapshot per
// (offering, period) so the overview table doesn't shift under a head as
// assistants keep logging grades/comments after the fact, and so past
// months stay browsable exactly as they were generated.

export type AssignmentReportMode = "grade" | "status_only";
export type AssignmentSelectionInput = { assignmentId: string; mode: AssignmentReportMode };

export type GeneratedReportMeta = {
  id: string;
  period: string;
  createdAt: string;
  createdByName: string | null;
  studentCount: number;
  gradeScale: GradeScaleSetting;
};

export type GeneratedStudentReport = {
  studentId: string;
  studentName: string;
  studentCode: string;
  assistantName: string | null;
  avgGrade: number | null;
  assignments: ReportAssignmentDetail[];
  weakTopics: ReportWeakTopic[];
  assistantComment: string;
};

function requireHeadOrAdminForReports(role: string | undefined) {
  if (role !== "head" && role !== "admin") throw new Error("Not authorized");
}

export async function listReportGenerations(offeringId: string): Promise<{ period: string; createdAt: string }[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_report_generations")
    .select("period, created_at")
    .eq("offering_id", offeringId)
    .order("period", { ascending: false });
  return (data ?? []).map((r) => ({ period: r.period, createdAt: r.created_at }));
}

export async function generateMonthlyAcademicReport(
  offeringId: string,
  period: string,
  selection: AssignmentSelectionInput[]
): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  requireHeadOrAdminForReports(profile.role);
  const supabase = await createClient();

  const gradeScale = await getGradeScale(offeringId);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(id, name, student_code)")
    .eq("offering_id", offeringId);
  if (!enrollments || enrollments.length === 0) throw new Error("No students enrolled in this course.");

  const studentIds = enrollments.map((e) => e.student_id);
  const assignmentIds = selection.map((s) => s.assignmentId);
  const modeByAssignment = new Map(selection.map((s) => [s.assignmentId, s.mode]));

  const { data: assignmentRows } = assignmentIds.length
    ? await supabase
        .from("assignments")
        .select("id, title, max_marks, assignment_templates(report_group)")
        .in("id", assignmentIds)
    : { data: [] as { id: string; title: string; max_marks: number | null; assignment_templates: { report_group: string } | { report_group: string }[] | null }[] };
  const titleByAssignment = new Map((assignmentRows ?? []).map((a) => [a.id, a.title]));
  const maxMarksByAssignment = new Map((assignmentRows ?? []).map((a) => [a.id, a.max_marks]));
  const reportGroupByAssignment = new Map(
    (assignmentRows ?? []).map((a) => {
      const tpl = Array.isArray(a.assignment_templates) ? a.assignment_templates[0] : a.assignment_templates;
      return [a.id, (tpl?.report_group as "homework" | "classwork" | "quiz" | "mock_exam" | "other") ?? "homework"];
    })
  );

  const { data: logs } = assignmentIds.length
    ? await supabase
        .from("assignment_logs")
        .select("assignment_id, student_id, status, grade")
        .in("assignment_id", assignmentIds)
        .in("student_id", studentIds)
    : { data: [] as { assignment_id: string; student_id: string; status: string | null; grade: string | null }[] };

  const { data: topics } = await supabase
    .from("student_topic_submissions")
    .select("student_id, topic_catalog(label, topic_materials(kind, label, link, duration, sort_order))")
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

  const { data: existingGen } = await supabase
    .from("monthly_report_generations")
    .select("id")
    .eq("offering_id", offeringId)
    .eq("period", period)
    .maybeSingle();

  const payload = {
    org_id: profile.org.id,
    offering_id: offeringId,
    period,
    created_by: profile.id,
    created_at: new Date().toISOString(),
    assignment_selection: selection,
    grade_scale: gradeScale,
  };

  let generationId: string;
  if (existingGen) {
    const { error } = await supabase.from("monthly_report_generations").update(payload).eq("id", existingGen.id);
    if (error) throw new Error(error.message);
    generationId = existingGen.id;
    await supabase.from("monthly_report_students").delete().eq("generation_id", generationId);
  } else {
    const { data, error } = await supabase.from("monthly_report_generations").insert(payload).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create report");
    generationId = data.id;
  }

  const rows = enrollments.map((e) => {
    const studentLogs = (logs ?? []).filter((l) => l.student_id === e.student_id);

    const assignments: ReportAssignmentDetail[] = selection.map((s) => {
      const log = studentLogs.find((l) => l.assignment_id === s.assignmentId);
      const mode = modeByAssignment.get(s.assignmentId) ?? "grade";
      return {
        title: titleByAssignment.get(s.assignmentId) ?? "",
        status: log?.status ?? null,
        grade: mode === "grade" ? log?.grade ?? null : null,
        maxMarks: maxMarksByAssignment.get(s.assignmentId) ?? null,
        reportGroup: reportGroupByAssignment.get(s.assignmentId) ?? "homework",
      };
    });

    // Number(null) is 0, not NaN — filter out ungraded/status-only entries
    // before converting, so they don't silently drag the average down.
    const numericGrades = assignments
      .filter((a) => a.grade != null && a.grade.trim() !== "")
      .map((a) => Number(a.grade))
      .filter((n) => !Number.isNaN(n));
    const avgGrade = numericGrades.length ? Math.round(numericGrades.reduce((s, n) => s + n, 0) / numericGrades.length) : null;

    const weakTopics: ReportWeakTopic[] = (topics ?? [])
      .filter((t) => t.student_id === e.student_id)
      .map((t) => {
        const topic = Array.isArray(t.topic_catalog) ? t.topic_catalog[0] : t.topic_catalog;
        const materials = (topic ? (Array.isArray(topic.topic_materials) ? topic.topic_materials : []) : []).slice().sort((a, b) => a.sort_order - b.sort_order);
        return {
          label: topic?.label ?? "",
          materials: materials.map((m) => ({ kind: m.kind as "video" | "notes" | "tricky_question", label: m.label, link: m.link, duration: m.duration })),
        };
      });

    return {
      generation_id: generationId,
      student_id: e.student_id,
      avg_grade: avgGrade,
      assignments,
      weak_topics: weakTopics,
      assistant_comment: noteByStudent.get(e.student_id) ?? null,
    };
  });

  if (rows.length) {
    const { error } = await supabase.from("monthly_report_students").insert(rows);
    if (error) throw new Error(error.message);
  }

  return { id: generationId };
}

export async function getGeneratedReport(offeringId: string, period: string): Promise<{ meta: GeneratedReportMeta | null; students: GeneratedStudentReport[] }> {
  const profile = await getCurrentProfile();
  if (!profile) return { meta: null, students: [] };
  const supabase = await createClient();

  const { data: gen } = await supabase
    .from("monthly_report_generations")
    .select("id, period, created_at, grade_scale, profiles(full_name)")
    .eq("offering_id", offeringId)
    .eq("period", period)
    .maybeSingle();
  if (!gen) return { meta: null, students: [] };

  const { data: rows } = await supabase
    .from("monthly_report_students")
    .select("student_id, avg_grade, assignments, weak_topics, assistant_comment, students(name, student_code)")
    .eq("generation_id", gen.id);

  const creator = Array.isArray(gen.profiles) ? gen.profiles[0] : gen.profiles;

  // Current assistant, not the one at generation time — enrollments.assistant_id
  // can change (reassignment) after a report was generated, and showing who's
  // actually on the course now is more useful than freezing a stale name.
  const studentIds = (rows ?? []).map((r) => r.student_id);
  const { data: enrollmentRows } = studentIds.length
    ? await supabase.from("enrollments").select("student_id, profiles(full_name)").eq("offering_id", offeringId).in("student_id", studentIds)
    : { data: [] as { student_id: string; profiles: { full_name: string } | { full_name: string }[] | null }[] };
  const assistantNameByStudent = new Map(
    (enrollmentRows ?? []).map((e) => {
      const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      return [e.student_id, assistant?.full_name ?? null];
    })
  );

  const students: GeneratedStudentReport[] = (rows ?? [])
    .map((r) => {
      const student = Array.isArray(r.students) ? r.students[0] : r.students;
      if (!student) return null;
      return {
        studentId: r.student_id,
        studentName: student.name,
        studentCode: student.student_code,
        assistantName: assistantNameByStudent.get(r.student_id) ?? null,
        avgGrade: r.avg_grade == null ? null : Number(r.avg_grade),
        assignments: (r.assignments as ReportAssignmentDetail[]) ?? [],
        weakTopics: (r.weak_topics as ReportWeakTopic[]) ?? [],
        assistantComment: r.assistant_comment ?? "",
      };
    })
    .filter((x): x is GeneratedStudentReport => !!x)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  return {
    meta: {
      id: gen.id,
      period: gen.period,
      createdAt: gen.created_at,
      createdByName: creator?.full_name ?? null,
      studentCount: students.length,
      gradeScale: (gen.grade_scale as GradeScaleSetting) ?? { scale: "percentage", bands: [] },
    },
    students,
  };
}

// Assistant-facing counterpart to getGeneratedReport — same generated
// snapshot, scoped down to just the students currently enrolled under this
// assistant for this offering. Returns an empty student list (with meta
// still set) if the report exists but this assistant has none of its
// students in it; meta stays null if the head hasn't generated it yet.
export async function getMyGeneratedReport(offeringId: string, period: string): Promise<{ meta: GeneratedReportMeta | null; students: GeneratedStudentReport[] }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "assistant") return { meta: null, students: [] };
  const supabase = await createClient();

  const [{ meta, students }, { data: myEnrollments }] = await Promise.all([
    getGeneratedReport(offeringId, period),
    supabase.from("enrollments").select("student_id").eq("offering_id", offeringId).eq("assistant_id", profile.id),
  ]);
  const myStudentIds = new Set((myEnrollments ?? []).map((e) => e.student_id));

  return { meta, students: students.filter((s) => myStudentIds.has(s.studentId)) };
}
