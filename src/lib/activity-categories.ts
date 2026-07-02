export const ACTIVITY_CATEGORIES = ["staff", "students", "payments", "assignments", "attendance", "requests"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
