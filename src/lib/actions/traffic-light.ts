"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { DEFAULT_TRAFFIC_LIGHT_BANDS, computeTrafficLight, type GradeBand, type TrafficLightResult } from "@/lib/traffic-light-logic";

export type { GradeBand, TrafficLightTier, TrafficLightResult } from "@/lib/traffic-light-logic";

export async function getTrafficLightBands(): Promise<GradeBand[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return DEFAULT_TRAFFIC_LIGHT_BANDS;
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("traffic_light_bands").eq("id", orgId).single();
  const bands = data?.traffic_light_bands as GradeBand[] | null;
  return bands && bands.length ? bands : DEFAULT_TRAFFIC_LIGHT_BANDS;
}

export async function setTrafficLightBands(bands: GradeBand[]) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || profile.role !== "admin") throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ traffic_light_bands: bands }).eq("id", profile.org.id);
  if (error) throw new Error(error.message);
}

export async function setStudentTargetGrade(enrollmentId: string, targetGrade: number | null) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "assistant" && profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").update({ target_grade: targetGrade }).eq("id", enrollmentId);
  if (error) throw new Error(error.message);
}

export type StudentTrafficLight = TrafficLightResult & { studentId: string };

// One pass over the offering's assignments/logs — safe for courses with
// hundreds of students, matching the batching pattern already used in
// getStudentsForOffering (2 queries total, no per-student round trips).
export async function getTrafficLightForOffering(offeringId: string): Promise<Record<string, StudentTrafficLight>> {
  const supabase = await createClient();
  const bands = await getTrafficLightBands();

  const { data: enrollments } = await supabase.from("enrollments").select("student_id, target_grade").eq("offering_id", offeringId);
  if (!enrollments || !enrollments.length) return {};

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, max_marks, lettered, due_date, created_at")
    .eq("offering_id", offeringId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  const totalAssignments = assignments?.length ?? 0;
  if (!totalAssignments) {
    return Object.fromEntries(
      enrollments.map((e) => [e.student_id, { studentId: e.student_id, tier: "green" as const, reasons: [] }])
    );
  }
  const assignmentOrder = new Map(assignments!.map((a, i) => [a.id, i]));
  const assignmentById = new Map(assignments!.map((a) => [a.id, a]));

  const studentIds = enrollments.map((e) => e.student_id);
  const { data: logs } = await supabase
    .from("assignment_logs")
    .select("student_id, assignment_id, status, grade")
    .in("assignment_id", Array.from(assignmentOrder.keys()))
    .in("student_id", studentIds);

  const missedByStudent = new Map<string, number>();
  const gradesByStudent = new Map<string, { order: number; pct: number }[]>();
  for (const l of logs ?? []) {
    if (l.status === "missing") {
      missedByStudent.set(l.student_id, (missedByStudent.get(l.student_id) ?? 0) + 1);
      continue;
    }
    if (l.status === "excused" || l.grade == null || l.grade.trim() === "") continue;
    const assignment = assignmentById.get(l.assignment_id);
    if (!assignment || assignment.lettered) continue; // letter grades aren't percentage-comparable
    const numeric = Number(l.grade);
    if (Number.isNaN(numeric) || !assignment.max_marks) continue;
    const list = gradesByStudent.get(l.student_id) ?? [];
    list.push({ order: assignmentOrder.get(l.assignment_id)!, pct: (numeric / assignment.max_marks) * 100 });
    gradesByStudent.set(l.student_id, list);
  }

  const result: Record<string, StudentTrafficLight> = {};
  for (const e of enrollments) {
    const recentGrades = (gradesByStudent.get(e.student_id) ?? [])
      .sort((a, b) => a.order - b.order)
      .slice(-2)
      .map((g) => g.pct);
    const tl = computeTrafficLight({
      targetGrade: e.target_grade != null ? Number(e.target_grade) : null,
      totalAssignments,
      missedAssignments: missedByStudent.get(e.student_id) ?? 0,
      recentGrades,
      bands,
    });
    result[e.student_id] = { studentId: e.student_id, ...tl };
  }
  return result;
}
