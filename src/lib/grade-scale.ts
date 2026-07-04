import type { GradeScaleSetting } from "@/lib/actions/oversight";

export function formatGradeByScale(avgGrade: number | null, scale: GradeScaleSetting): string {
  if (avgGrade == null) return "—";
  if (scale.scale !== "percentage" && scale.bands.length) {
    const sorted = [...scale.bands].sort((a, b) => b.min - a.min);
    const band = sorted.find((b) => avgGrade >= b.min);
    if (band) return band.label;
  }
  return `${avgGrade}%`;
}
