export const ACTIVITY_CATEGORIES = ["staff", "students", "payments", "assignments", "attendance", "requests"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  staff: "Staff",
  students: "Students",
  payments: "Payments",
  assignments: "Assignments",
  attendance: "Attendance",
  requests: "Requests",
};

export const CATEGORY_ICON: Record<ActivityCategory, "users" | "grad" | "wallet" | "clipboard-list" | "cal-check" | "inbox"> = {
  staff: "users",
  students: "grad",
  payments: "wallet",
  assignments: "clipboard-list",
  attendance: "cal-check",
  requests: "inbox",
};
