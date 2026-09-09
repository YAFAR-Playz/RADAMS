import type { TourStep } from "./types";

// Build order: Head is written first (see the onboarding-tour plan).
// Order: oversight -> students -> assistants -> assignments -> checking -> attendance.
export const HEAD_TOUR: TourStep[] = [
  {
    path: "/oversight",
    selector: "oversight-offering-picker",
    title: "Your courses",
    body: "This is Course oversight — switch between the courses you head here. Everything on this page updates to match whichever one is selected.",
    placement: "bottom",
  },
  {
    path: "/oversight",
    selector: "oversight-stats",
    title: "Message tracking at a glance",
    body: "See how many logged assignments have actually been messaged to a parent or student for this course, and how many are still pending.",
    placement: "top",
  },
  {
    path: "/students",
    selector: "students-unassigned-toggle",
    title: "Find unassigned students",
    body: "Click this to filter down to students who don't have an assistant assigned yet — go ahead, try it.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "students-auto-assign",
    title: "Auto-assign in one click",
    body: "This spreads any unassigned students evenly across your course's assistants — no need to assign them one by one.",
    placement: "bottom",
  },
  {
    path: "/assistants",
    selector: "assistants-request",
    title: "Request more staff",
    body: "Need another assistant on a course? Request one here — it goes to HR for approval.",
    placement: "bottom",
  },
  {
    path: "/assignments",
    selector: "assignments-new",
    title: "Create an assignment",
    body: "Set up a new assignment here — each one is scoped to a course offering and shows up for that course's assistants to log.",
    placement: "bottom",
  },
  {
    path: "/checking",
    selector: "checking-send",
    title: "Review and message home",
    body: "Once an assistant logs a result, you can review it and send an update straight to a parent or student — try clicking it now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "attendance-sessions",
    title: "Review attendance",
    body: "Registration logs attendance per session — you can review it here anytime for any of your courses.",
    placement: "right",
  },
];
