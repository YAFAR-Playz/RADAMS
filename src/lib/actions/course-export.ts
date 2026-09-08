"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { resolveTemplateFlags } from "@/lib/assignment-template-fallback";
import { statusDef, type AssignmentStatus } from "@/lib/assignments-data";

export type CourseExportData = {
  courseLabel: string;
  assignmentTitles: string[];
  rows: { assistantName: string; studentName: string; studentCode: string; cells: string[]; comment: string; weakTopics: string }[];
};

// One row per student, grouped by assistant, columns in the order
// assignments were created — mirrors what assistants actually see in
// Assignment logging. Comment and weak topics are read for the current
// calendar month, matching the period the Weak Topics tab writes to.
export async function getCourseExport(offeringId: string): Promise<CourseExportData> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || profile.role !== "admin") throw new Error("Not authorized");
  const supabase = await createClient();

  const { data: offering } = await supabase.from("course_offerings").select("session, unit, courses(name)").eq("id", offeringId).maybeSingle();
  const course = offering ? (Array.isArray(offering.courses) ? offering.courses[0] : offering.courses) : null;
  const courseLabel = offering ? [course?.name, offering.session, offering.unit].filter(Boolean).join(" · ") : "Course";

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title, max_marks, template, assignment_templates(has_grade, has_comment)")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: true });
  const assignments = (assignmentRows ?? []).map((a) => {
    const joined = Array.isArray(a.assignment_templates) ? a.assignment_templates[0] : a.assignment_templates;
    const { hasGrade } = resolveTemplateFlags(a.template, joined);
    return { id: a.id, title: a.title, hasGrade, maxMarks: a.max_marks };
  });

  // Paginated: a course's enrollments can clear Postgrest's default
  // 1000-row cap on their own (one offering in this org has 1,039 active
  // enrollments), which a single unpaginated select silently truncated.
  type EnrollmentRow = {
    student_id: string;
    students: { name: string; student_code: string } | { name: string; student_code: string }[] | null;
    profiles: { full_name: string } | { full_name: string }[] | null;
  };
  const enrollments: EnrollmentRow[] = [];
  const ENROLLMENT_PAGE_SIZE = 1000;
  for (let from = 0; ; from += ENROLLMENT_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("enrollments")
      .select("student_id, students(name, student_code), profiles(full_name)")
      .eq("offering_id", offeringId)
      .range(from, from + ENROLLMENT_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    enrollments.push(...page);
    if (page.length < ENROLLMENT_PAGE_SIZE) break;
  }

  const assignmentIds = assignments.map((a) => a.id);
  const safeAssignmentIds = assignmentIds.length ? assignmentIds : ["00000000-0000-0000-0000-000000000000"];

  // Cross-join of every assignment × every enrolled student — for this
  // course's size (1,000+ students × several assignments) a single
  // unpaginated select here silently truncated, and adding
  // `.in("student_id", studentIds)` on top of `.in("assignment_id", ...)`
  // would also risk a URL-length failure with one UUID per enrolled
  // student — so this is scoped to assignment_id alone (already exact,
  // since only assignments from this offering are ever looked up below)
  // and paginated.
  const logs: { assignment_id: string; student_id: string; status: string | null; grade: string | null }[] = [];
  const LOGS_PAGE_SIZE = 1000;
  for (let from = 0; ; from += LOGS_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("assignment_logs")
      .select("assignment_id, student_id, status, grade")
      .in("assignment_id", safeAssignmentIds)
      .range(from, from + LOGS_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    logs.push(...page);
    if (page.length < LOGS_PAGE_SIZE) break;
  }

  const period = new Date().toISOString().slice(0, 7);

  // Scoping to offering_id + period is already exact for this offering's
  // roster — `commentMap`/`topicsMap` below are only ever read by student
  // ids drawn from `enrollments`, so a `.in("student_id", studentIds)` on
  // top was both redundant and, for a large course, a URL-length risk
  // (same class of bug as getSessionRoster in attendance.ts).
  const { data: notes } = await supabase.from("student_monthly_notes").select("student_id, comment").eq("offering_id", offeringId).eq("period", period);

  const { data: topics } = await supabase
    .from("student_topic_submissions")
    .select("student_id, topic_catalog(label)")
    .eq("offering_id", offeringId)
    .eq("period", period)
    .eq("status", "approved");

  const logMap = new Map<string, { status: string | null; grade: string | null }>();
  for (const l of logs) logMap.set(`${l.assignment_id}:${l.student_id}`, { status: l.status, grade: l.grade });

  const commentMap = new Map<string, string>();
  for (const n of notes ?? []) commentMap.set(n.student_id, n.comment ?? "");

  const topicsMap = new Map<string, string[]>();
  for (const t of topics ?? []) {
    const topic = Array.isArray(t.topic_catalog) ? t.topic_catalog[0] : t.topic_catalog;
    if (!topic?.label) continue;
    const arr = topicsMap.get(t.student_id) ?? [];
    arr.push(topic.label);
    topicsMap.set(t.student_id, arr);
  }

  const rows = (enrollments ?? [])
    .map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      if (!s) return null;
      const cells = assignments.map((a) => {
        const log = logMap.get(`${a.id}:${e.student_id}`);
        if (!log?.status) return "";
        const label = statusDef(log.status as AssignmentStatus)?.label ?? log.status;
        return a.hasGrade && log.grade ? `${label} (${log.grade}/${a.maxMarks})` : label;
      });
      return {
        assistantName: assistant?.full_name ?? "Unassigned",
        studentName: s.name,
        studentCode: s.student_code,
        cells,
        comment: commentMap.get(e.student_id) ?? "",
        weakTopics: (topicsMap.get(e.student_id) ?? []).join(", "),
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.assistantName.localeCompare(b.assistantName) || a.studentName.localeCompare(b.studentName));

  return { courseLabel, assignmentTitles: assignments.map((a) => a.title), rows };
}
