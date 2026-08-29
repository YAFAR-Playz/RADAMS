"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";
import { resolveTemplateFlags } from "@/lib/assignment-template-fallback";

export type AssistantOption = { id: string; name: string; initials: string };

export type AssigneeProgress = {
  assistantId: string;
  name: string;
  initials: string;
  total: number;
  logged: number;
};

export type AssignmentProgress = {
  id: string;
  title: string;
  maxMarks: number;
  gradeScheme: "numeric" | "letter";
  templateLabel: string;
  hasGrade: boolean;
  hasComment: boolean;
  defaultComment: string | null;
  countsSalary: boolean;
  // Mock-exam assignments pay checked papers at a course's mock-exam rate
  // (set in Pay Categories) instead of the assistant's normal per-paper
  // rate — gated org-wide behind the mockExamEnabled feature flag.
  mockExam: boolean;
  dueDate: string | null;
  closedAt: string | null;
  assignees: AssigneeProgress[];
};

export type CreateAssignmentInput = {
  offeringId: string;
  title: string;
  maxMarks: number;
  dueDate: string | null;
  templateId: string;
  gradeScheme: "numeric" | "letter";
  countsSalary: boolean;
  mockExam?: boolean;
  defaultComment?: string;
  assistantIds: string[];
};

export async function listOfferingAssistants(offeringId: string): Promise<AssistantOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offering_assistants")
    .select("profiles!inner(id, full_name, initials)")
    .eq("offering_id", offeringId)
    .is("profiles.left_at", null);
  return (data ?? [])
    .map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!p) return null;
      return { id: p.id, name: p.full_name, initials: p.initials };
    })
    .filter((x): x is AssistantOption => !!x);
}

export async function listAssignmentsWithProgress(offeringId: string): Promise<AssignmentProgress[]> {
  const supabase = await createClient();

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, max_marks, grade_scheme, template, counts_salary, mock_exam, due_date, closed_at, default_comment, assignment_templates(label, has_grade, has_comment)")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: false });
  if (!assignments || assignments.length === 0) return [];

  const assignmentIds = assignments.map((a) => a.id);

  const { data: assignedRows } = await supabase
    .from("assignment_assistants")
    .select("assignment_id, profiles(id, full_name, initials)")
    .in("assignment_id", assignmentIds);

  // Exclude students marked as "left" — they shouldn't count toward
  // expected/logged totals for assignment progress once they're gone.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, assistant_id, students!inner(left_at)")
    .eq("offering_id", offeringId)
    .is("students.left_at", null);

  // A course with several assignment categories easily logs assignments ×
  // roster-size rows across the whole offering — comfortably past
  // PostgREST's default 1000-row cap on a single unbounded select. That cap
  // was already found (and paginated around) for the admin dashboard's
  // enrollment counts; this query had the same shape and needed the same
  // fix — an un-paginated fetch here silently truncated to whichever
  // assignment's logs happened to sort first, leaving every other
  // assignment's progress reading 0 logged despite real data existing.
  const logs: { assignment_id: string; student_id: string; status: string | null }[] = [];
  const LOGS_PAGE_SIZE = 1000;
  for (let from = 0; ; from += LOGS_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("assignment_logs")
      .select("assignment_id, student_id, status")
      .in("assignment_id", assignmentIds)
      .range(from, from + LOGS_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    logs.push(...page);
    if (page.length < LOGS_PAGE_SIZE) break;
  }

  const studentsByAssistant = new Map<string, string[]>();
  for (const e of enrollments ?? []) {
    if (!e.assistant_id) continue;
    const list = studentsByAssistant.get(e.assistant_id) ?? [];
    list.push(e.student_id);
    studentsByAssistant.set(e.assistant_id, list);
  }

  const loggedStudentsByAssignment = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!log.status) continue;
    const set = loggedStudentsByAssignment.get(log.assignment_id) ?? new Set<string>();
    set.add(log.student_id);
    loggedStudentsByAssignment.set(log.assignment_id, set);
  }

  return assignments.map((a) => {
    const assignedToThis = (assignedRows ?? []).filter((r) => r.assignment_id === a.id);
    const loggedSet = loggedStudentsByAssignment.get(a.id) ?? new Set<string>();
    const assignees: AssigneeProgress[] = assignedToThis
      .map((row) => {
        const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        if (!p) return null;
        const studentIds = studentsByAssistant.get(p.id) ?? [];
        const logged = studentIds.filter((id) => loggedSet.has(id)).length;
        return { assistantId: p.id, name: p.full_name, initials: p.initials, total: studentIds.length, logged };
      })
      .filter((x): x is AssigneeProgress => !!x);

    const joinedTemplate = Array.isArray(a.assignment_templates) ? a.assignment_templates[0] : a.assignment_templates;
    const { hasGrade, hasComment } = resolveTemplateFlags(a.template, joinedTemplate);

    return {
      id: a.id,
      title: a.title,
      maxMarks: a.max_marks,
      gradeScheme: a.grade_scheme as "numeric" | "letter",
      templateLabel: joinedTemplate?.label ?? a.template ?? "Grade + comment",
      hasGrade,
      hasComment,
      defaultComment: a.default_comment,
      countsSalary: a.counts_salary,
      mockExam: a.mock_exam,
      dueDate: a.due_date,
      closedAt: a.closed_at,
      assignees,
    };
  });
}

export async function createAssignment(input: CreateAssignmentInput): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data: template } = await supabase.from("assignment_templates").select("label").eq("id", input.templateId).maybeSingle();

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      offering_id: input.offeringId,
      title: input.title,
      max_marks: input.maxMarks,
      due_date: input.dueDate,
      template_id: input.templateId,
      template: template?.label ?? "Grade + comment",
      grade_scheme: input.gradeScheme,
      lettered: input.gradeScheme === "letter",
      counts_salary: input.countsSalary,
      mock_exam: input.mockExam ?? false,
      default_comment: input.defaultComment?.trim() || null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create assignment");

  if (input.assistantIds.length) {
    const { error: linkError } = await supabase
      .from("assignment_assistants")
      .insert(input.assistantIds.map((assistantId) => ({ assignment_id: data.id, assistant_id: assistantId })));
    if (linkError) throw new Error(linkError.message);
  }

  await logActivity("assignments", `Created assignment "${input.title}"`);

  return { id: data.id };
}

export async function updateAssignment(
  id: string,
  patch: { title: string; maxMarks: number; dueDate: string | null; countsSalary: boolean; mockExam?: boolean; defaultComment?: string }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({
      title: patch.title,
      max_marks: patch.maxMarks,
      due_date: patch.dueDate,
      counts_salary: patch.countsSalary,
      mock_exam: patch.mockExam ?? false,
      default_comment: patch.defaultComment?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function toggleAssignmentClosed(id: string, closed: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ closed_at: closed ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// assignment_logs (every student's status/grade/comment/message-tracking
// "sent_at") and assignment_assistants (the assistant assignment) both
// cascade-delete off assignments, so removing the assignment row is enough
// to wipe every related record in one shot.
export async function deleteAssignment(id: string) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();

  const { data: assignment } = await supabase.from("assignments").select("title").eq("id", id).maybeSingle();
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logActivity("assignments", `Deleted assignment "${assignment?.title ?? "Untitled"}" and all its logged records`);
}
