import type { IconName } from "@/components/icons";

export type Role =
  | "owner"
  | "admin"
  | "hr"
  | "head"
  | "assistant"
  | "registration"
  | "finance";

export type NavItem = {
  icon: IconName;
  label: string;
  key: string;
  badge?: number;
  // A plain unread-style indicator, distinct from `badge`'s numeric count —
  // for a one-off "something new here" alert (e.g. newly released pay)
  // rather than a count of pending items.
  dot?: boolean;
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "System Owner",
  admin: "Org Administrator",
  hr: "Human Resources",
  head: "Course Head",
  assistant: "Teaching Assistant",
  registration: "Registration Team",
  finance: "Finance Team",
};

const NAV_DEF: Record<Role, NavItem[]> = {
  owner: [
    { icon: "dashboard", label: "Dashboard", key: "dashboard" },
    { icon: "building", label: "Organizations", key: "orgs" },
    { icon: "users", label: "Users", key: "users" },
    { icon: "palette", label: "Branding", key: "branding" },
    { icon: "mail", label: "Templates", key: "templates" },
    { icon: "shield", label: "System", key: "system" },
    { icon: "message", label: "Chat", key: "chat" },
  ],
  admin: [
    { icon: "dashboard", label: "Dashboard", key: "dashboard" },
    { icon: "grad", label: "Students", key: "students" },
    { icon: "users", label: "Staff", key: "staff" },
    { icon: "book", label: "Courses", key: "courses" },
    { icon: "wallet", label: "Salaries", key: "salaries" },
    { icon: "chart", label: "Evaluations", key: "evaluations" },
    { icon: "settings", label: "Organization settings", key: "payroll" },
    { icon: "mail", label: "Templates", key: "templates" },
    { icon: "palette", label: "Branding", key: "branding" },
    { icon: "trend", label: "Monthly report", key: "report" },
    { icon: "clock", label: "History", key: "history" },
    { icon: "message", label: "Chat", key: "chat" },
  ],
  hr: [
    { icon: "dashboard", label: "Dashboard", key: "dashboard" },
    { icon: "inbox", label: "Requests", key: "requests" },
    { icon: "users", label: "Staff", key: "staff" },
    { icon: "user-plus", label: "Hiring", key: "hiring" },
    { icon: "message", label: "Chat", key: "chat" },
  ],
  head: [
    { icon: "dashboard", label: "Dashboard", key: "dashboard" },
    { icon: "book", label: "Courses", key: "oversight" },
    { icon: "grad", label: "Students", key: "students" },
    { icon: "clipboard-list", label: "Assignments", key: "assignments" },
    { icon: "shield", label: "Checking", key: "checking" },
    { icon: "user-check", label: "Assistants", key: "assistants" },
    { icon: "cal-check", label: "Attendance", key: "attendance" },
    { icon: "chart", label: "Evaluations", key: "evaluations" },
    { icon: "trend", label: "Monthly report", key: "report" },
    { icon: "target", label: "Weak Topics", key: "weak-topics" },
    { icon: "wallet", label: "My Pay", key: "mypay" },
    { icon: "message", label: "Chat", key: "chat" },
  ],
  assistant: [
    { icon: "dashboard", label: "Dashboard", key: "dashboard" },
    { icon: "grad", label: "My Students", key: "students" },
    { icon: "clipboard-list", label: "Assignments", key: "assignments" },
    { icon: "cal-check", label: "Attendance", key: "attendance" },
    { icon: "trend", label: "Monthly Reports", key: "report" },
    { icon: "target", label: "Weak Topics", key: "weak-topics" },
    { icon: "wallet", label: "My Pay", key: "mypay" },
    { icon: "message", label: "Chat", key: "chat" },
  ],
  registration: [
    { icon: "dashboard", label: "Dashboard", key: "dashboard" },
    { icon: "user-plus", label: "Registrations", key: "registrations" },
    { icon: "cal-check", label: "Attendance", key: "attendance" },
    { icon: "file-up", label: "Import", key: "import" },
    { icon: "grad", label: "Students", key: "students" },
    { icon: "message", label: "Chat", key: "chat" },
  ],
  finance: [
    { icon: "dashboard", label: "Dashboard", key: "dashboard" },
    { icon: "wallet", label: "Salaries", key: "salaries" },
    { icon: "card", label: "Payments", key: "payments" },
    { icon: "chart", label: "Categories", key: "categories" },
    { icon: "chart", label: "Evaluations", key: "evaluations" },
    { icon: "settings", label: "Settings", key: "payroll" },
    { icon: "message", label: "Chat", key: "chat" },
  ],
};

export function navForRole(role: Role): NavItem[] {
  return NAV_DEF[role];
}

export function findNavItem(role: Role, key: string): NavItem | undefined {
  return NAV_DEF[role].find((n) => n.key === key);
}

export type Tone = "brand" | "ok" | "warn" | "danger" | "info" | "neutral";

export type Kpi = {
  icon: IconName;
  value: string;
  label: string;
  tone: Tone;
  delta?: string;
  dir?: "up" | "down";
  // Optional recent-history series for a small sparkline under the tile —
  // only ever set from real historical data (see dashboard-charts.ts);
  // never fabricated, so most KPIs simply don't have one.
  trend?: number[];
};

// Mock KPIs from the design, used until each module (courses, assignments,
// payroll, etc.) has a real table to query. Counts backed by data we do have
// today (organizations, profiles) are overridden in getDashboardKpis below.
const MOCK_KPIS: Record<Role, Kpi[]> = {
  owner: [
    { icon: "building", value: "12", label: "Organizations", tone: "brand", delta: "+2", dir: "up" },
    { icon: "users", value: "318", label: "Active users", tone: "neutral", delta: "+14", dir: "up" },
    { icon: "clipboard-list", value: "47", label: "Active courses", tone: "neutral" },
    { icon: "shield", value: "Healthy", label: "System status", tone: "ok" },
  ],
  admin: [
    { icon: "grad", value: "842", label: "Students", tone: "brand", delta: "+23", dir: "up" },
    { icon: "users", value: "36", label: "Staff members", tone: "neutral", delta: "+1", dir: "up" },
    { icon: "clipboard-list", value: "18", label: "Active courses", tone: "neutral" },
    { icon: "alert", value: "5", label: "Pending tasks", tone: "warn" },
  ],
  hr: [
    { icon: "inbox", value: "7", label: "Pending requests", tone: "warn", delta: "+3", dir: "up" },
    { icon: "users", value: "36", label: "Active staff", tone: "neutral" },
    { icon: "user-plus", value: "4", label: "New this month", tone: "brand", delta: "+4", dir: "up" },
    { icon: "clock", value: "3", label: "Awaiting review", tone: "warn" },
  ],
  head: [
    { icon: "clipboard-list", value: "4", label: "My courses", tone: "brand" },
    { icon: "grad", value: "142", label: "Students", tone: "neutral", delta: "+8", dir: "up" },
    { icon: "user-check", value: "12", label: "Assistants", tone: "neutral" },
    { icon: "clock", value: "57", label: "Pending messages", tone: "warn" },
  ],
  assistant: [
    { icon: "grad", value: "48", label: "My students", tone: "brand" },
    { icon: "clipboard-list", value: "12", label: "Pending logs", tone: "warn" },
    { icon: "check", value: "6", label: "Logged today", tone: "ok", delta: "+6", dir: "up" },
    { icon: "message", value: "3", label: "Unread", tone: "neutral" },
  ],
  registration: [
    { icon: "user-plus", value: "23", label: "New registrations", tone: "brand", delta: "+9", dir: "up" },
    { icon: "clock", value: "9", label: "Pending review", tone: "warn" },
    { icon: "file-up", value: "120", label: "Imported this week", tone: "neutral" },
    { icon: "alert", value: "4", label: "Import errors", tone: "danger" },
  ],
  finance: [
    { icon: "wallet", value: "$42,300", label: "Payroll this month", tone: "brand" },
    { icon: "card", value: "28/36", label: "Assistants paid", tone: "neutral" },
    { icon: "clock", value: "6", label: "Pending approvals", tone: "warn" },
    { icon: "trend", value: "4", label: "Bonuses issued", tone: "ok" },
  ],
};

export function mockKpisForRole(role: Role): Kpi[] {
  return MOCK_KPIS[role];
}
