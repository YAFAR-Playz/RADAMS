import type { Tone } from "@/lib/roles";
import type { IconName } from "@/components/icons";

export type AssignmentStatus = "checked" | "submitted" | "late" | "missing" | "excused";

export type StatusDef = {
  key: AssignmentStatus;
  label: string;
  tone: Tone;
  icon: IconName;
};

export const STATUS_DEFS: StatusDef[] = [
  { key: "checked", label: "Checked", tone: "ok", icon: "check2" },
  { key: "submitted", label: "Submitted", tone: "ok", icon: "check" },
  { key: "late", label: "Late", tone: "warn", icon: "clock" },
  { key: "missing", label: "Missing", tone: "danger", icon: "alert" },
  { key: "excused", label: "Excused", tone: "neutral", icon: "minus" },
];

export function statusDef(key: AssignmentStatus | null): StatusDef | null {
  if (!key) return null;
  return STATUS_DEFS.find((s) => s.key === key) ?? null;
}
