import type { Tone } from "@/lib/roles";
import type { IconName } from "@/components/icons";
import type { AssignmentStatus } from "@/lib/assignments-data";

export type OversightComment = {
  student: string;
  initials: string;
  assignment: string;
  status: AssignmentStatus;
  grade: string;
  comment: string;
  sent: boolean;
};

export type OversightAssistant = {
  id: number;
  name: string;
  initials: string;
  students: number;
  sent: number;
  total: number;
  comments: OversightComment[];
};

export type OversightOffering = {
  label: string;
  assistants: OversightAssistant[];
};

export type TrackInfo = { text: string; icon: IconName; tone: Tone };

const FIRST = [
  "Liam", "Mei", "Omar", "Sofia", "Ethan", "Hana", "Noah", "Yara", "Aria", "Ben",
  "Chloe", "Diego", "Fatima", "Grace", "Henry", "Isla", "Jack", "Karim", "Lucy", "Marco",
  "Nadia", "Oscar", "Priya", "Quinn", "Rana", "Sam", "Tara", "Uma", "Victor", "Wendy",
];
const LAST = [
  "Carter", "Wong", "Sayed", "Rossi", "Park", "Kim", "Bauer", "Haddad", "Khan", "Cohen",
  "Adeyemi", "Luna", "Zahra", "Owusu", "Walsh", "Murphy", "Lee", "Adel", "Brennan", "Ricci",
  "Petrov", "Reyes", "Menon", "Foster", "Saleh", "Okonkwo", "Vidal", "Desai", "Hugo", "Park",
];
const STATUS_CYCLE: AssignmentStatus[] = ["checked", "submitted", "late", "missing", "excused"];
const ASSIGNMENTS = ["Paper 3 — Mechanics", "Paper 1 — MCQ", "Paper 2 — Structured", "Homework — Forces"];
const COMMENTS_BY_STATUS: Record<AssignmentStatus, string[]> = {
  checked: ["Strong work this round", "Consistent performer", "Exemplar answer", "Solid reasoning shown", "Top of the group"],
  submitted: ["Good attempt — minor revisions", "Needs work on units", "Decent, watch algebra slips", "Improving steadily", "Review key topic"],
  late: ["Handed in late; flag timing", "Late again — encourage earlier", "Improving but slow", "Time management to watch"],
  missing: ["No submission — parent contacted", "Awaiting submission", "No contact yet", ""],
  excused: ["Approved absence, will resit", "Medical absence", "Excused — family reason", ""],
};
const ASSISTANT_NAMES = [
  "Aisha Rahman", "Tom Becker", "Yuki Tanaka", "Carlos Diaz", "Nadia Saleh",
  "Elena Voss", "Marco Bianchi", "Priya Nair", "Hassan Ali", "Sara Mensah",
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase();
}

function mkRoster(seed: number, count: number) {
  const out: string[] = [];
  for (let k = 0; k < count; k++) {
    const f = FIRST[(seed * 7 + k * 13) % FIRST.length];
    const l = LAST[(seed * 11 + k * 5) % LAST.length];
    out.push(`${f} ${l}`);
  }
  return out;
}

function mkComments(seed: number, count: number): OversightComment[] {
  const names = mkRoster(seed, count);
  return names.map((student, idx) => {
    const status = STATUS_CYCLE[(seed * 3 + idx) % STATUS_CYCLE.length];
    const sent = (seed * 7 + idx) % 5 !== 0;
    const hasGrade = status === "checked" || status === "submitted" || status === "late";
    const grade = hasGrade ? String(55 + ((seed * 13 + idx * 7) % 44)) : "";
    const pool = COMMENTS_BY_STATUS[status];
    const comment = pool[(seed + idx) % pool.length];
    return {
      student,
      initials: initials(student),
      status,
      grade,
      comment,
      sent,
      assignment: ASSIGNMENTS[idx % ASSIGNMENTS.length],
    };
  });
}

export function mockOversightOfferings(): OversightOffering[] {
  const STUDENTS_PER_ASSISTANT = 30;
  const ASSISTANT_COUNT = 10;
  const build = (label: string, base: number): OversightOffering => ({
    label,
    assistants: Array.from({ length: ASSISTANT_COUNT }, (_, idx) => {
      const seed = base * 100 + idx;
      const total = STUDENTS_PER_ASSISTANT;
      const sent = Math.max(0, total - ((seed * 3 + idx * 5) % 14));
      const name = ASSISTANT_NAMES[idx % ASSISTANT_NAMES.length];
      return {
        id: idx + 1,
        name,
        initials: initials(name),
        students: STUDENTS_PER_ASSISTANT,
        sent,
        total,
        comments: mkComments(seed, STUDENTS_PER_ASSISTANT),
      };
    }),
  });
  return [
    build("Physics · June · Unit 1", 1),
    build("Physics · Nov · Unit 1", 2),
    build("Physics · June · Unit 2", 3),
    build("Chemistry · June · Unit 1", 4),
  ];
}

export function trackInfo(pct: number): TrackInfo {
  if (pct === 100) return { text: "Complete", icon: "check2", tone: "ok" };
  if (pct >= 80) return { text: "On track", icon: "check2", tone: "brand" };
  if (pct >= 55) return { text: "Behind", icon: "clock", tone: "warn" };
  return { text: "At risk", icon: "alert", tone: "danger" };
}
