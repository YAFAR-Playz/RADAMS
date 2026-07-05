// Student IDs are stored as plain digits (e.g. "1001"), but the UI and the
// welcome-message {id} variable both show them with a leading "#" — let any
// student search box match either form, on top of matching by name.
export function normalizeStudentQuery(query: string): string {
  return query.trim().toLowerCase().replace(/#/g, "");
}

export function matchesStudentQuery(query: string, name: string, code: string): boolean {
  const q = normalizeStudentQuery(query);
  if (!q) return true;
  return name.toLowerCase().includes(q) || code.toLowerCase().includes(q);
}
