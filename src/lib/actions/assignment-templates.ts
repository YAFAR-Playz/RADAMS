"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type ReportGroup = "homework" | "classwork" | "quiz" | "mock_exam" | "other";
export type AssignmentTemplate = { id: string; label: string; hasGrade: boolean; hasComment: boolean; reportGroup: ReportGroup };

const DEFAULT_TEMPLATES: { label: string; hasGrade: boolean; hasComment: boolean }[] = [
  { label: "Grade + comment", hasGrade: true, hasComment: true },
  { label: "Complete / Missing", hasGrade: false, hasComment: false },
  { label: "Comment only", hasGrade: false, hasComment: true },
];

// Every org starts with these three (matching the app's original fixed
// template set) the first time anyone looks — seeded once, on demand, so
// there's no migration that has to touch every existing org's data.
export async function listAssignmentTemplates(): Promise<AssignmentTemplate[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("assignment_templates")
    .select("id, label, has_grade, has_comment, report_group")
    .eq("org_id", profile.org.id)
    .order("created_at");
  if (data && data.length) {
    return data.map((t) => ({ id: t.id, label: t.label, hasGrade: t.has_grade, hasComment: t.has_comment, reportGroup: t.report_group as ReportGroup }));
  }

  const { data: seeded, error } = await supabase
    .from("assignment_templates")
    .insert(DEFAULT_TEMPLATES.map((t) => ({ org_id: profile.org!.id, label: t.label, has_grade: t.hasGrade, has_comment: t.hasComment })))
    .select("id, label, has_grade, has_comment, report_group");
  if (error || !seeded) return [];
  return seeded.map((t) => ({ id: t.id, label: t.label, hasGrade: t.has_grade, hasComment: t.has_comment, reportGroup: t.report_group as ReportGroup }));
}

export async function createAssignmentTemplate(input: { label: string; hasGrade: boolean; hasComment: boolean; reportGroup: ReportGroup }): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || profile.role !== "admin") throw new Error("Not authorized");
  if (!input.label.trim()) throw new Error("Name is required");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignment_templates")
    .insert({ org_id: profile.org.id, label: input.label.trim(), has_grade: input.hasGrade, has_comment: input.hasComment, report_group: input.reportGroup })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create template");
  return { id: data.id };
}

export async function updateAssignmentTemplate(id: string, input: { label: string; hasGrade: boolean; hasComment: boolean; reportGroup: ReportGroup }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Not authorized");
  if (!input.label.trim()) throw new Error("Name is required");
  const supabase = await createClient();
  const { error } = await supabase
    .from("assignment_templates")
    .update({ label: input.label.trim(), has_grade: input.hasGrade, has_comment: input.hasComment, report_group: input.reportGroup })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Assignments that used this template keep their history — template_id on
// those rows just goes null (ON DELETE SET NULL) rather than the template
// itself being blocked from deletion or the assignments being touched.
export async function deleteAssignmentTemplate(id: string) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("assignment_templates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
