"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { AssignmentStatus, MessageRecipient } from "@/lib/assignments-data";
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
  defaultComment: string | null;
};

export type RosterStudent = {
  enrollmentId: string;
  studentId: string;
  name: string;
  studentCode: string;
  initials: string;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  assistantName: string | null;
  status: AssignmentStatus | null;
  grade: string | null;
  comment: string | null;
  sentAt: string | null;
  recipient: MessageRecipient | null;
};

export async function listMyOfferings(): Promise<OfferingOption[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  // A deactivated course-offering must disappear from every role's picker —
  // it's still fully queryable by id for historical records (reports, salary
  // lines, etc.), it just stops being something anyone can newly select.
  if (profile.role === "head") {
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

  if (profile.role === "assistant") {
    const { data } = await supabase
      .from("offering_assistants")
      .select("course_offerings(id, session, unit, active, courses(name))")
      .eq("assistant_id", profile.id);
    return (data ?? [])
      .map((row) => {
        const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
        if (!o || !o.active) return null;
        const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
        return { id: o.id, label: [course?.name, o.session, o.unit].filter(Boolean).join(" · ") };
      })
      .filter((x): x is OfferingOption => !!x);
  }

  if ((profile.role === "admin" || profile.role === "registration") && profile.org) {
    const { data } = await supabase
      .from("course_offerings")
      .select("id, session, unit, courses(name)")
      .eq("org_id", profile.org.id)
      .eq("active", true);
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
    .select("id, title, max_marks, lettered, due_date, template, default_comment, assignment_templates(has_grade, has_comment)")
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
      defaultComment: a.default_comment,
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

  // A student marked as "left" should stop appearing anywhere an assistant
  // or head logs/checks assignment work for them — they still show up
  // (greyed out) on the Students tab as a historical record, but there's
  // nothing left to log here. Paginated: this offering's own roster can
  // clear Postgrest's default 1000-row cap on its own (one offering in this
  // org has 1,039 active enrollments), which a single unpaginated select
  // silently truncated.
  type RosterEnrollmentRow = {
    id: string;
    student_id: string;
    assistant_id: string | null;
    students:
      | { id: string; name: string; student_code: string; initials: string; phone: string | null; guardian_name: string | null; guardian_phone: string | null }
      | { id: string; name: string; student_code: string; initials: string; phone: string | null; guardian_name: string | null; guardian_phone: string | null }[]
      | null;
    profiles: { full_name: string } | { full_name: string }[] | null;
  };
  const enrollments: RosterEnrollmentRow[] = [];
  const ENROLLMENT_PAGE_SIZE = 1000;
  for (let from = 0; ; from += ENROLLMENT_PAGE_SIZE) {
    let page = supabase
      .from("enrollments")
      .select("id, student_id, assistant_id, students!inner(id, name, student_code, initials, phone, guardian_name, guardian_phone), profiles(full_name)")
      .eq("offering_id", assignment.offering_id)
      .is("left_at", null)
      .range(from, from + ENROLLMENT_PAGE_SIZE - 1);
    if (profile.role === "assistant") page = page.eq("assistant_id", profile.id);
    const { data } = await page;
    if (!data || data.length === 0) break;
    enrollments.push(...data);
    if (data.length < ENROLLMENT_PAGE_SIZE) break;
  }
  if (!enrollments.length) return [];

  // Scoping to assignment_id alone is already exact — the map below only
  // ever looks up students present in `enrollments`, so a
  // `.in("student_id", studentIds)` on top risked a URL-length failure for
  // this course's size (same class of bug fixed in attendance.ts).
  // Paginated as a backstop since a large course's log rows can also clear
  // the 1000-row cap on their own.
  const logs: { student_id: string; status: string | null; grade: string | null; comment: string | null; sent_at: string | null; recipient: string | null }[] = [];
  const LOGS_PAGE_SIZE = 1000;
  for (let from = 0; ; from += LOGS_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("assignment_logs")
      .select("student_id, status, grade, comment, sent_at, recipient")
      .eq("assignment_id", assignmentId)
      .range(from, from + LOGS_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    logs.push(...page);
    if (page.length < LOGS_PAGE_SIZE) break;
  }

  const logByStudent = new Map(logs.map((l) => [l.student_id, l]));

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
        studentCode: student.student_code,
        initials: student.initials,
        phone: student.phone,
        guardianName: student.guardian_name,
        guardianPhone: student.guardian_phone,
        assistantName: assistant?.full_name ?? null,
        status: (log?.status as AssignmentStatus | null) ?? null,
        grade: log?.grade ?? null,
        comment: log?.comment ?? null,
        sentAt: log?.sent_at ?? null,
        recipient: (log?.recipient as MessageRecipient | null) ?? null,
      };
    })
    .filter((x): x is RosterStudent => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function upsertLog(
  assignmentId: string,
  studentId: string,
  patch: {
    status?: AssignmentStatus | null;
    grade?: string | null;
    comment?: string | null;
    sentAt?: string | null;
    recipient?: MessageRecipient | null;
  }
) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const supabase = await createClient();

  const row: Record<string, unknown> = {
    assignment_id: assignmentId,
    student_id: studentId,
    updated_at: new Date().toISOString(),
  };
  // logged_by is who actually performed the check, and payroll pays by it
  // specifically so a mid-month reassignment doesn't move credit between
  // assistants (see the comment on countCheckedPapers in finance-salaries.ts).
  // Only a call that sets/changes status is a checking action — stamping it
  // on every save meant a later grade fix, comment edit, or "mark sent" by
  // whoever the student's CURRENT assistant happens to be (after a
  // reassignment) silently reassigned credit for a paper someone else
  // already checked, undermining that exact guarantee.
  if (patch.status !== undefined) row.logged_by = profile.id;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.grade !== undefined) row.grade = patch.grade;
  if (patch.comment !== undefined) row.comment = patch.comment;
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt;
  if (patch.recipient !== undefined) row.recipient = patch.recipient;

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

// Deliberately does NOT collapse "" to null. A null comment means "the
// assistant never touched this field" (falls back to the assignment's
// default comment when building a message); an explicit "" means "the
// assistant cleared it on purpose" and must stay empty. Collapsing both to
// null made an intentionally-cleared comment indistinguishable from an
// untouched one, so the head's default comment kept reappearing in the
// WhatsApp message even after an assistant deleted it.
export async function setComment(assignmentId: string, studentId: string, comment: string) {
  await upsertLog(assignmentId, studentId, { comment });
}

export async function markSent(assignmentId: string, studentId: string, recipient: MessageRecipient) {
  await upsertLog(assignmentId, studentId, { sentAt: new Date().toISOString(), recipient });
}
