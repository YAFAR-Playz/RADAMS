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

export type AssignmentStudent = {
  id: number;
  name: string;
  initials: string;
  status: AssignmentStatus | null;
  grade: string;
  comment: string;
  guardianPhone: string;
};

const FIRST_NAMES = [
  "Aria", "Ben", "Ethan", "Hana", "Liam", "Mei", "Noah", "Omar", "Sofia", "Yara",
  "Chloe", "Diego", "Fatima", "Grace", "Henry", "Isla", "Jack", "Karim", "Lucy", "Marco",
  "Nadia", "Oscar", "Priya", "Quinn", "Rana", "Sam", "Tara", "Uma", "Victor", "Wendy",
];
const LAST_NAMES = [
  "Khan", "Cohen", "Park", "Kim", "Carter", "Wong", "Bauer", "Sayed", "Rossi", "Haddad",
  "Adeyemi", "Luna", "Zahra", "Owusu", "Walsh", "Murphy", "Lee", "Adel", "Brennan", "Ricci",
  "Petrov", "Reyes", "Menon", "Foster", "Saleh", "Okonkwo", "Vidal", "Desai", "Hugo", "Tan",
];
const STATUS_CYCLE: (AssignmentStatus | null)[] = [null, "checked", "submitted", "late", "missing", "excused"];
const COMMENTS: Record<AssignmentStatus, string> = {
  checked: "Strong work",
  submitted: "Good attempt",
  late: "Handed in late",
  missing: "No submission yet",
  excused: "Approved absence",
};

export const COURSE_OFFERINGS = ["June · Unit 1", "Nov · Unit 1", "June · Unit 2"];

export function mockAssignmentStudents(count = 30): AssignmentStudent[] {
  const out: AssignmentStudent[] = [];
  for (let k = 1; k <= count; k++) {
    const first = FIRST_NAMES[(k - 1) % FIRST_NAMES.length];
    const last = LAST_NAMES[(k * 13) % LAST_NAMES.length];
    const status = STATUS_CYCLE[(k * 3) % STATUS_CYCLE.length];
    const hasGrade = status === "checked" || status === "submitted" || status === "late";
    out.push({
      id: k,
      name: `${first} ${last}`,
      initials: (first[0] + last[0]).toUpperCase(),
      status,
      grade: hasGrade ? String(55 + ((k * 7) % 44)) : "",
      comment: status ? COMMENTS[status] : "",
      guardianPhone: `+44 7700 900${100 + k}`,
    });
  }
  return out;
}
