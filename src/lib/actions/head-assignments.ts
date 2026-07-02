"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";

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
  template: "grade" | "checkbox" | "rubric" | "comment";
  countsSalary: boolean;
  dueDate: string | null;
  closedAt: string | null;
  messageTemplate: string | null;
  assignees: AssigneeProgress[];
};

export type CreateAssignmentInput = {
  offeringId: string;
  title: string;
  maxMarks: number;
  dueDate: string | null;
  template: "grade" | "checkbox" | "rubric" | "comment";
  gradeScheme: "numeric" | "letter";
  countsSalary: boolean;
  messageTemplate: string;
  assistantIds: string[];
};

export async function listOfferingAssistants(offeringId: string): Promise<AssistantOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offering_assistants")
    .select("profiles(id, full_name, initials)")
    .eq("offering_id", offeringId);
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
    .select("id, title, max_marks, grade_scheme, template, counts_salary, due_date, closed_at, message_template")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: false });
  if (!assignments || assignments.length === 0) return [];

  const assignmentIds = assignments.map((a) => a.id);

  const { data: assignedRows } = await supabase
    .from("assignment_assistants")
    .select("assignment_id, profiles(id, full_name, initials)")
    .in("assignment_id", assignmentIds);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, assistant_id")
    .eq("offering_id", offeringId);

  const { data: logs } = await supabase
    .from("assignment_logs")
    .select("assignment_id, student_id, status")
    .in("assignment_id", assignmentIds);

  const studentsByAssistant = new Map<string, string[]>();
  for (const e of enrollments ?? []) {
    if (!e.assistant_id) continue;
    const list = studentsByAssistant.get(e.assistant_id) ?? [];
    list.push(e.student_id);
    studentsByAssistant.set(e.assistant_id, list);
  }

  const loggedStudentsByAssignment = new Map<string, Set<string>>();
  for (const log of logs ?? []) {
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

    return {
      id: a.id,
      title: a.title,
      maxMarks: a.max_marks,
      gradeScheme: a.grade_scheme as "numeric" | "letter",
      template: a.template as AssignmentProgress["template"],
      countsSalary: a.counts_salary,
      dueDate: a.due_date,
      closedAt: a.closed_at,
      messageTemplate: a.message_template,
      assignees,
    };
  });
}

export async function createAssignment(input: CreateAssignmentInput): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      offering_id: input.offeringId,
      title: input.title,
      max_marks: input.maxMarks,
      due_date: input.dueDate,
      template: input.template,
      grade_scheme: input.gradeScheme,
      lettered: input.gradeScheme === "letter",
      counts_salary: input.countsSalary,
      message_template: input.messageTemplate,
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
  patch: { title: string; maxMarks: number; dueDate: string | null; countsSalary: boolean }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({ title: patch.title, max_marks: patch.maxMarks, due_date: patch.dueDate, counts_salary: patch.countsSalary })
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
