export const PRIMARIES = ["#2563eb", "#0d9488", "#4f46e5", "#db2777", "#ea580c", "#16a34a", "#0891b2", "#1e293b"];
export const SECONDARIES = ["#7c3aed", "#0d9488", "#f59e0b", "#e11d48", "#2563eb", "#64748b"];
export const FONTS = [
  { value: "geist", label: "Geist", stack: "'Geist', system-ui, sans-serif" },
  { value: "inter", label: "Inter", stack: "'Inter', system-ui, sans-serif" },
  { value: "system", label: "System UI", stack: "system-ui, -apple-system, sans-serif" },
  { value: "mono", label: "IBM Plex Mono", stack: "'Geist Mono', ui-monospace, monospace" },
];
export const CORNERS: { value: "soft" | "sharp"; label: string; demo: string }[] = [
  { value: "soft", label: "Soft", demo: "12px" },
  { value: "sharp", label: "Sharp", demo: "4px" },
];

export function mixHex(hex: string, pct: number, light: boolean) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const t = light ? 255 : 0;
  const f = (v: number) => Math.round(v * (pct / 100) + t * (1 - pct / 100));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
