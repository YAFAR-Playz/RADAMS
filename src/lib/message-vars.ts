export function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : ""));
}
