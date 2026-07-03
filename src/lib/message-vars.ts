export function applyTemplateVars(template: string, vars: Record<string, string>): string {
  const substituted = template.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : ""));

  // A line whose only real content was a label for a variable that isn't
  // available for this assignment type (e.g. {grade} on a comment-only
  // assignment) collapses down to just "Label:" with nothing after —
  // drop that dangling line rather than send it as-is.
  const lines = substituted.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.length > 0 && /[:\-–—]\s*$/.test(trimmed));
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
