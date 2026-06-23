import type { Tone } from "@/lib/roles";
import type { IconName } from "@/components/icons";

export type TrackInfo = { text: string; icon: IconName; tone: Tone };

export function trackInfo(pct: number): TrackInfo {
  if (pct === 100) return { text: "Complete", icon: "check2", tone: "ok" };
  if (pct >= 80) return { text: "On track", icon: "check2", tone: "brand" };
  if (pct >= 55) return { text: "Behind", icon: "clock", tone: "warn" };
  return { text: "At risk", icon: "alert", tone: "danger" };
}
