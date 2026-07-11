"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { GradeBand } from "@/lib/actions/oversight";

export type { GradeBand };

// Used until an admin defines their own bands: B = 70-84%, C-or-below = under 70%.
export const DEFAULT_TRAFFIC_LIGHT_BANDS: GradeBand[] = [
  { label: "A", min: 85 },
  { label: "B", min: 70 },
  { label: "C", min: 55 },
  { label: "D", min: 40 },
  { label: "F", min: 0 },
];

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

export type TrafficLightTier = "green" | "yellow" | "red";
export type TrafficLightResult = { tier: TrafficLightTier; reasons: string[] };

// Bands are sorted highest-min-first — rank 0 is the top band ("A"-equivalent),
// rank 1 the next ("B"-equivalent), rank 2+ ("C or below"-equivalent). This
// lets the tier rules below talk about "B" / "C or below" without assuming
// the admin actually used literal A-F labels.
function bandRank(pct: number, bands: GradeBand[]): number {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  const idx = sorted.findIndex((b) => pct >= b.min);
  return idx === -1 ? sorted.length : idx;
}

// Implements the Traffic Light Tracker's tier rules:
// - RED (Critical): >40% of assignments missed, OR the latest grade sits in
//   the C-or-below band, OR the grade fell 2+ bands between the last two
//   graded assignments.
// - YELLOW (Caution): an unforced drop between the last two graded
//   assignments, or the latest grade fell below the student's target.
// - GREEN (On track): none of the above — submitting consistently, holding
//   at/above a B, and at/above target when one's set.
export function computeTrafficLight(input: {
  targetGrade: number | null;
  totalAssignments: number;
  missedAssignments: number;
  recentGrades: number[]; // chronological ascending (oldest first), percentages, graded entries only
  bands: GradeBand[];
}): TrafficLightResult {
  const { targetGrade, totalAssignments, missedAssignments, recentGrades, bands } = input;
  const missedRate = totalAssignments > 0 ? missedAssignments / totalAssignments : 0;
  const last = recentGrades.length ? recentGrades[recentGrades.length - 1] : null;
  const prev = recentGrades.length > 1 ? recentGrades[recentGrades.length - 2] : null;
  const lastRank = last != null ? bandRank(last, bands) : null;
  const prevRank = prev != null ? bandRank(prev, bands) : null;
  const dropRanks = lastRank != null && prevRank != null ? lastRank - prevRank : 0;

  const redReasons: string[] = [];
  if (missedRate > 0.4) redReasons.push(`${Math.round(missedRate * 100)}% of assignments missed this module (over the 40% limit)`);
  if (lastRank != null && lastRank >= 2) redReasons.push(`Latest grade (${Math.round(last!)}%) is in the C-or-below band`);
  if (dropRanks >= 2) redReasons.push(`Grade fell ${dropRanks} bands between the last two assignments`);
  if (redReasons.length) return { tier: "red", reasons: redReasons };

  const yellowReasons: string[] = [];
  if (last != null && prev != null && last < prev) yellowReasons.push(`Grade dropped from ${Math.round(prev)}% to ${Math.round(last)}% across the last two assignments`);
  if (targetGrade != null && last != null && last < targetGrade) yellowReasons.push(`Latest grade (${Math.round(last)}%) is below the ${Math.round(targetGrade)}% target`);
  if (yellowReasons.length) return { tier: "yellow", reasons: yellowReasons };

  return { tier: "green", reasons: [] };
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
