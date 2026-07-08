export function applyTemplateVars(template: string, vars: Record<string, string>): string {
  // A line is only a candidate for dropping if EVERY variable on it resolved
  // empty — that's what distinguishes a genuinely dangling label ("Grade:",
  // "Comment:" with nothing else) from a line like `Update on {assignment}:`
  // whose static wording just happens to end in a colon but always carries
  // real content. Checking the substituted text alone (without this gate)
  // used to drop that header line unconditionally, since {assignment} is
  // never actually empty but the line still ends in ":".
  const lines = template.split("\n").filter((line) => {
    const tokens = [...line.matchAll(/\{(\w+)\}/g)];
    if (!tokens.length) return true;
    const allTokensEmpty = tokens.every((m) => !vars[m[1]]);
    if (!allTokensEmpty) return true;
    const withoutVars = line.replace(/\{(\w+)\}/g, "").trim();
    return !(withoutVars.length === 0 || /[:\-–—]\s*$/.test(withoutVars));
  });

  return lines
    .join("\n")
    .replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : ""))
    .replace(/\n{3,}/g, "\n\n");
}
