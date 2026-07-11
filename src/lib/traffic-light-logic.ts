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
