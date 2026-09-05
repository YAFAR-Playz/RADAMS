import type { Role } from "@/lib/roles";

// Every dashboard (Admin, Head, Assistant, Registration, Finance, HR, Owner)
// is backed by real data — see src/lib/actions/dashboard.ts,
// src/lib/actions/dashboard-charts.ts, src/lib/actions/hr.ts,
// src/lib/actions/owner.ts and src/lib/actions/activity-log.ts.

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
