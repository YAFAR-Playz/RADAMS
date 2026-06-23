import type { Tone } from "@/lib/roles";

export function toneColors(tone: Tone): { bg: string; fg: string } {
  const map: Record<Tone, [string, string]> = {
    brand: ["var(--brands)", "var(--brand)"],
    ok: ["var(--oks)", "var(--ok)"],
    warn: ["var(--warns)", "var(--warn)"],
    danger: ["var(--dangers)", "var(--danger)"],
    info: ["var(--infos)", "var(--info)"],
    neutral: ["var(--surface2)", "var(--muted)"],
  };
  const [bg, fg] = map[tone];
  return { bg, fg };
}
