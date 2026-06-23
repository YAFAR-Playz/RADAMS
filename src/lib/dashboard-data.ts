import type { Role, Tone } from "@/lib/roles";

export type Badge = { text: string; tone: Tone; icon: "check2" | "check" | "clock" | "alert" };

function badge(text: string, tone: Tone, icon: Badge["icon"]): Badge {
  return { text, tone, icon };
}

// ---- HEAD ----
export const HEAD_OFFERINGS = [
  { label: "Physics · June · Unit 1", active: true },
  { label: "Physics · Nov · Unit 1", active: false },
  { label: "Physics · June · Unit 2", active: false },
  { label: "Chemistry · June · Unit 1", active: false },
];

const A_DEFS: [string, string, number, number][] = [
  ["Aisha Rahman", "AR", 46, 48],
  ["Tom Becker", "TB", 38, 52],
  ["Yuki Tanaka", "YT", 48, 48],
  ["Carlos Diaz", "CD", 21, 45],
  ["Nadia Saleh", "NS", 33, 40],
];

export const HEAD_ASSISTANTS = A_DEFS.map(([name, initials, sent, total]) => {
  const pct = Math.round((sent / total) * 100);
  let b: Badge;
  if (pct === 100) b = badge("Complete", "ok", "check2");
  else if (pct >= 80) b = badge("On track", "brand", "check2");
  else if (pct >= 55) b = badge("Behind", "warn", "clock");
  else b = badge("At risk", "danger", "alert");
  return { name, initials, sent, total, pct, badge: b };
});

export const HEAD_STATUS_BREAKDOWN: { label: string; count: string; tone: Tone }[] = [
  { label: "Complete", count: "1", tone: "ok" },
  { label: "On track", count: "2", tone: "brand" },
  { label: "Behind", count: "1", tone: "warn" },
  { label: "At risk", count: "1", tone: "danger" },
];

// ---- ASSISTANT ----
const P_DEFS: [string, string, string, string, Tone, Badge["icon"]][] = [
  ["Liam Carter", "LC", "June · Unit 1", "Pending", "warn", "clock"],
  ["Mei Wong", "MW", "June · Unit 1", "Missing", "danger", "alert"],
  ["Omar Sayed", "OS", "June · Unit 1", "Pending", "warn", "clock"],
  ["Sofia Rossi", "SR", "Nov · Unit 1", "Pending", "warn", "clock"],
  ["Ethan Park", "EP", "Nov · Unit 1", "Missing", "danger", "alert"],
  ["Hana Kim", "HK", "June · Unit 1", "Pending", "warn", "clock"],
];

export const PENDING_STUDENTS = P_DEFS.map(([name, initials, offering, text, tone, icon]) => ({
  name,
  initials,
  offering,
  badge: badge(text, tone, icon),
}));

export const MY_OFFERINGS = [
  { label: "Physics · June · Unit 1", count: "28", pending: "7" },
  { label: "Physics · Nov · Unit 1", count: "14", pending: "3" },
  { label: "Physics · June · Unit 2", count: "6", pending: "2" },
];

// ---- FINANCE ----
const S_DEFS: [string, string, string, string, string, string, Tone, Badge["icon"]][] = [
  ["Aisha Rahman", "AR", "June · Unit 1", "Per paper", "$1,240", "Paid", "ok", "check"],
  ["Tom Becker", "TB", "Nov · Unit 1", "Bracket", "$980", "Pending", "warn", "clock"],
  ["Yuki Tanaka", "YT", "June · Unit 2", "Per paper", "$1,560", "Paid", "ok", "check"],
  ["Carlos Diaz", "CD", "June · Unit 1", "Bracket", "$720", "Pending", "warn", "clock"],
  ["Nadia Saleh", "NS", "Nov · Unit 2", "Per paper", "$1,100", "Paid", "ok", "check"],
];

export const SALARY_ROWS = S_DEFS.map(([name, initials, offering, method, amount, text, tone, icon]) => ({
  name,
  initials,
  offering,
  method,
  amount,
  badge: badge(text, tone, icon),
}));

export const PAY_METHODS = [
  { label: "Bank transfer", pct: 62, color: "var(--brand)" },
  { label: "Mobile wallet", pct: 26, color: "var(--info)" },
  { label: "Cash", pct: 12, color: "var(--subtle)" },
];

// ---- HR ----
export const ASSISTANT_REQUESTS = [
  { name: "Daniel Cole", initials: "DC", role: "Assistant · June Unit 1", by: "Marcus Bell", date: "Jun 18" },
  { name: "Fatima Noor", initials: "FN", role: "Assistant · Nov Unit 1", by: "Marcus Bell", date: "Jun 17" },
  { name: "Jack Lee", initials: "JL", role: "Assistant · June Unit 2", by: "Elena Voss", date: "Jun 17" },
  { name: "Aria Khan", initials: "AK", role: "Assistant · Nov Unit 2", by: "Elena Voss", date: "Jun 16" },
];

const SBR_DEFS: [string, number][] = [
  ["Assistants", 18],
  ["Heads", 6],
  ["Registration", 5],
  ["Finance", 4],
  ["HR", 3],
];
const SBR_MAX = 18;
export const STAFF_BY_ROLE = SBR_DEFS.map(([role, n]) => ({
  role,
  n,
  barW: `${Math.round((n / SBR_MAX) * 100)}%`,
}));

// ---- OWNER / ADMIN ----
const ORG_DEFS: [string, number, number, string, Tone][] = [
  ["Cambridge Prep Center", 128, 14, "Active", "ok"],
  ["Oxford Tutorials", 96, 11, "Active", "ok"],
  ["Bright Future Academy", 54, 8, "Trial", "info"],
  ["Elite IGCSE Hub", 40, 6, "Active", "ok"],
];
export const ORGS = ORG_DEFS.map(([name, users, courses, text, tone]) => ({
  name,
  users,
  courses,
  badge: { text, tone },
}));

const ACT_DEFS: [string, string, string, Tone][] = [
  ["New course created: Nov · Unit 2", "12m ago", "clipboard-list", "brand"],
  ["Sara Mensah updated org branding", "1h ago", "palette", "neutral"],
  ["14 students imported successfully", "3h ago", "file-up", "ok"],
  ["Assistant request approved by HR", "5h ago", "user-check", "ok"],
];
export const ACTIVITY = ACT_DEFS.map(([text, time, icon, tone]) => ({ text, time, icon, tone }));

// ---- REGISTRATION ----
const RQ_DEFS: [string, string, string, string, string, Tone][] = [
  ["Hannah Mills", "HM", "June · Unit 1", "Online form", "Pending", "warn"],
  ["Raj Patel", "RP", "June · Unit 1", "Bulk import", "New", "brand"],
  ["Lucas Silva", "LS", "Nov · Unit 1", "Walk-in", "Pending", "warn"],
  ["Amara Obi", "AO", "June · Unit 2", "Online form", "New", "brand"],
];
export const REG_QUEUE = RQ_DEFS.map(([name, initials, offering, channel, text, tone]) => ({
  name,
  initials,
  offering,
  channel,
  badge: { text, tone },
}));

export const IMPORT_ERRORS = [
  { row: "Row 14", msg: "Missing phone number" },
  { row: "Row 27", msg: "Invalid session code (NOV-26)" },
  { row: "Row 31", msg: "Duplicate student ID" },
  { row: "Row 42", msg: "Unknown unit reference" },
];

export function dashboardSubtitle(role: Role, orgName: string | null): string {
  const map: Record<Role, string> = {
    owner: "Platform overview across all organizations.",
    admin: `Here's what's happening at ${orgName ?? "your organization"}.`,
    hr: "Requests and staff needing your attention.",
    head: "Your course completion at a glance.",
    assistant: "Your students and logs for today.",
    registration: "Registrations and imports in progress.",
    finance: "Payroll and payments this month.",
  };
  return map[role];
}

export function greetingFor(first: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${part}, ${first}`;
}

export function dateLabel(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${weekday} · ${day} ${month} ${year}`;
}
