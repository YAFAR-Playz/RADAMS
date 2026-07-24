import type { GradeScaleSetting } from "@/lib/actions/oversight";

// Bands are opt-in for every scale, including percentage — a course can
// leave them empty and just show the raw number, or define thresholds to
// show a label (a letter, a number, "Distinction", anything) once an
// average crosses one. The `scale` field only picks the band editor's
// default label convention; it no longer gates whether bands apply.
export function formatGradeByScale(avgGrade: number | null, scale: GradeScaleSetting): string {
  if (avgGrade == null) return "—";
  if (scale.bands.length) {
    const sorted = [...scale.bands].sort((a, b) => b.min - a.min);
    const band = sorted.find((b) => avgGrade >= b.min);
    if (band) return band.label;
  }
  return `${avgGrade}%`;
}
