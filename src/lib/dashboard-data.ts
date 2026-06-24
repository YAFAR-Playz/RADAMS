import type { Role, Tone } from "@/lib/roles";

// Head, Assistant, Registration and Finance dashboards are backed by real
// data — see src/lib/actions/dashboard.ts. Owner/HR below remain mock until
// their backend phase.

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

// Registration dashboard is backed by real data — see
// src/lib/actions/dashboard.ts (getRegistrationDashboard).

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
