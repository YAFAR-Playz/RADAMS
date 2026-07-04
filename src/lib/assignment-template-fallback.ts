// Assignments created before admin-configurable templates existed only have
// the old fixed `template` text column (grade/checkbox/rubric/comment) and
// no `template_id`. Anything created since picks a real assignment_templates
// row instead — this derives the same {hasGrade, hasComment} shape from
// whichever one is present so every read path can treat old and new rows
// identically.
export function resolveTemplateFlags(
  legacyTemplate: string | null,
  joined?: { has_grade: boolean; has_comment: boolean } | null
): { hasGrade: boolean; hasComment: boolean } {
  if (joined) return { hasGrade: joined.has_grade, hasComment: joined.has_comment };
  switch (legacyTemplate) {
    case "checkbox":
      return { hasGrade: false, hasComment: false };
    case "comment":
      return { hasGrade: false, hasComment: true };
    case "grade":
    case "rubric":
    default:
      return { hasGrade: true, hasComment: true };
  }
}
