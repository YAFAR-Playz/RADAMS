import type { TourStep } from "./types";

// Build order: Head is written first (see the onboarding-tour plan).
// Deep, scenario-based walkthrough — the user drives every step by pressing
// the real button/tab himself; the tour only describes what a step does and
// (for the handful marked requireRealClick) waits for the real click before
// advancing, since that write really persists into his disposable demo
// clone for the rest of the session.
export const HEAD_TOUR: TourStep[] = [
  // ── Orientation ──────────────────────────────────────────────────────
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
    body: "See how many logged assignments have actually been messaged to a parent or student for this course, and how many are still pending — the same numbers you'll be working through in Checking later on.",
    placement: "top",
  },

  // ── Students: unassigned + auto-assign + traffic light ──────────────
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
    body: "This spreads any unassigned students evenly across your course's assistants — no need to assign them one by one. Click it to open it.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "students-auto-assign-confirm",
    title: "Confirm the distribution",
    body: "Pick round-robin or alphabetical blocks, choose which assistants are included, then confirm — this really assigns them. Press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "students-traffic-light",
    title: "The traffic light system",
    body: "Every student gets a Green / Yellow / Red dot based on their recent grades — green is on track, yellow is a caution, red needs attention. Finance sets the grade thresholds for these in Organization settings; you just read them here.",
    placement: "right",
  },

  // ── Assistants: add / replace / remove / reassign ────────────────────
  {
    path: "/assistants",
    selector: "assistants-request",
    title: "Request more staff",
    body: "Need another assistant on a course? Press this to open the request form — go ahead and open it.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/assistants",
    selector: "assistants-request-name",
    title: "Candidate details",
    body: "Type the candidate's name here — this is who HR will review for the new assistant slot.",
    placement: "bottom",
  },
  {
    path: "/assistants",
    selector: "assistants-request-reason",
    title: "Why you need them",
    body: "Give HR some context — course load, an assistant leaving, extra students. This shows up on their side of the request.",
    placement: "top",
  },
  {
    path: "/assistants",
    selector: "assistants-request-submit",
    title: "Send it to HR",
    body: "This really submits the request — it'll show up in HR's queue for the rest of your session. Press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/assistants",
    selector: "assistants-replace-btn",
    title: "Replacing an assistant",
    body: "The exact same form opens here when an assistant is leaving and you already have their replacement lined up — outgoing leave date, incoming start date, and the same HR handoff.",
    placement: "bottom",
  },
  {
    path: "/assistants",
    selector: "assistants-remove-btn",
    title: "Removing an assistant",
    body: "And here for removing one outright — no replacement, just an off-boarding date and a reason for HR's records.",
    placement: "bottom",
  },
  {
    path: "/assistants",
    selector: "assistants-group-toggle",
    title: "See who's assigned to whom",
    body: "Each assistant has a group of students under them. Click here to expand it and see the roster.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/assistants",
    selector: "assistants-reassign-select",
    title: "Reassign a student",
    body: "Pick a different assistant here to move a single student across — useful when one assistant is overloaded or leaving.",
    placement: "left",
  },

  // ── Assignments: create ──────────────────────────────────────────────
  {
    path: "/assignments",
    selector: "assignments-new",
    title: "Create an assignment",
    body: "This is where it all starts — press it to open the new assignment form.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/assignments",
    selector: "assignment-form-title",
    title: "Name the assignment",
    body: "Give it a clear title — this is what assistants and, later, parents/students will see.",
    placement: "bottom",
  },
  {
    path: "/assignments",
    selector: "assignment-form-template",
    title: "Pick a type",
    body: "Homework, classwork, quiz, mock exam — the type controls where it's grouped on reports and whether a grade is expected.",
    placement: "bottom",
  },
  {
    path: "/assignments",
    selector: "assignment-form-save",
    title: "Save it",
    body: "This really creates the assignment in your course — it'll immediately show up for your assistants to log. Press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Checking: log → notify → follow up ───────────────────────────────
  {
    path: "/checking",
    selector: "checking-status-select",
    title: "Log a result",
    body: "This is exactly what your assistants use to log each student's result — checked, submitted, late, missing, or excused. You can log or correct one yourself here too.",
    placement: "right",
  },
  {
    path: "/checking",
    selector: "checking-send",
    title: "Notify home",
    body: "Once a result is logged, send it straight to a parent or student over WhatsApp — press it to see the message before it goes out.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/checking",
    selector: "checking-modal-recipient",
    title: "Choose who gets it",
    body: "Switch between messaging the student directly or their parent/guardian — the phone number and message wording update to match.",
    placement: "bottom",
  },
  {
    path: "/checking",
    selector: "checking-modal-preview",
    title: "Review before sending",
    body: "This is exactly what they'll receive — the assignment, the status, and the grade or comment if there is one.",
    placement: "top",
  },
  {
    path: "/checking",
    selector: "checking-modal-send",
    title: "Open WhatsApp",
    body: "This marks it sent and opens WhatsApp with the message pre-filled, ready to go. Feel free to close this and try it for real.",
    placement: "top",
  },
  {
    path: "/checking",
    selector: "checking-followup-filter",
    title: "Follow up on what's missing",
    body: "Filter down to Missing to see exactly who still needs checking or a nudge — this is how you follow up on everything you've sent so far. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },

  // ── Evaluations: monthly assistant review ────────────────────────────
  {
    path: "/evaluations",
    selector: "evaluations-assistant-select",
    title: "Evaluate an assistant",
    body: "Pick who you're evaluating for this month — the form and salary impact on the right update to match them.",
    placement: "bottom",
  },
  {
    path: "/evaluations",
    selector: "evaluations-add-extra",
    title: "Extra work & bonuses",
    body: "Add a line here for anything beyond their normal load — covering another assistant's class, running an extra session, and so on. Press it to add one.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/evaluations",
    selector: "evaluations-notes",
    title: "Write up your notes",
    body: "Summarize how they did this month — punctuality, quality of feedback, responsiveness with parents.",
    placement: "top",
  },
  {
    path: "/evaluations",
    selector: "evaluations-rating",
    title: "Overall rating",
    body: "Give an overall rating for the month. Press one now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/evaluations",
    selector: "evaluations-submit",
    title: "Submit to Finance",
    body: "This sends your evaluation — and its effect on their pay — to Finance for this month. Press it to submit for real.",
    placement: "top",
    requireRealClick: true,
  },

  // ── My Pay: understanding your own compensation ──────────────────────
  {
    path: "/mypay",
    selector: "mypay-breakdown",
    title: "Your pay, broken down",
    body: "This is your own compensation for the month — per course, with any bonuses or deductions Finance has applied and why.",
    placement: "bottom",
  },
  {
    path: "/mypay",
    selector: "mypay-total",
    title: "Total & payment method",
    body: "Your total for the month and how it's paid out — this only appears once Finance has released the period.",
    placement: "top",
  },

  // ── Chat: capabilities ────────────────────────────────────────────────
  {
    path: "/chat",
    selector: "chat-new-message",
    title: "Start a conversation",
    body: "Press this to start a new conversation — with a course channel or a direct message to another staff member.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/chat",
    selector: "chat-open-channel",
    title: "Course channels",
    body: "Every course you head has its own group channel — everyone assigned to it (you, your assistants) can see it. Open one now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/chat",
    selector: "chat-message-input",
    title: "Say something",
    body: "Type a message here — Enter sends it, Shift+Enter makes a new line.",
    placement: "top",
  },
  {
    path: "/chat",
    selector: "chat-send",
    title: "Send it",
    body: "This really posts to the conversation — try sending a message if you'd like.",
    placement: "top",
  },

  // ── Attendance ────────────────────────────────────────────────────────
  {
    path: "/attendance",
    selector: "attendance-sessions",
    title: "Review attendance",
    body: "Registration logs attendance per session — you can review it here anytime for any of your courses.",
    placement: "right",
  },

  // ── Weak Topics: create a topic, assign it, comment ──────────────────
  {
    path: "/weak-topics",
    selector: "weaktopics-tab-catalog",
    title: "The topic catalog",
    body: "This is your library of weak-topic remediation material — reusable across every student and every month.",
    placement: "bottom",
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-label-input",
    title: "Name the topic",
    body: "Give the topic a clear label — e.g. \"Quadratic equations\" — then attach notes, tricky questions, or a video link below it.",
    placement: "bottom",
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-create",
    title: "Add it to the catalog",
    body: "This really saves the topic — it'll immediately be available to assign to students. Press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-tab-manage",
    title: "Assign topics to students",
    body: "Switch to Manage submissions to attach a weak topic to a specific student for this month. Click the tab.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-assign-select",
    title: "Pick a weak topic",
    body: "Choose which topic this student needs to work on this month.",
    placement: "bottom",
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-assign-submit",
    title: "Add it",
    body: "This attaches the topic to the student for this month — it'll show up in their monthly report. Press it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-comment",
    title: "Write a monthly comment",
    body: "This overall comment about the student's month also appears on their monthly report, right alongside their weak topics.",
    placement: "top",
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-comment-save",
    title: "Save the comment",
    body: "Press Save to attach it — this is the exact comment Weak Topics contributes to the report you'll generate next.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Monthly report: generate, grade scale, send to Drive ─────────────
  {
    path: "/report",
    selector: "report-generate",
    title: "Generate the monthly report",
    body: "This pulls together every logged assignment, weak topic, and comment for the month. Press it to open the generation options.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/report",
    selector: "report-generate-confirm",
    title: "Choose what's included",
    body: "Pick how each assignment appears — excluded, status only, or status plus grade — then confirm. This really builds the report. Press it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/report",
    selector: "report-grade-scale",
    title: "The grade scale",
    body: "This controls how each student's average grade is displayed on their report — raw percentage, a lettered scale, or a numeric one. Press it to open it.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/report",
    selector: "report-scale-type",
    title: "Pick a scale",
    body: "Percentage, letter, or numeric — this decides the format every student's average is shown in.",
    placement: "bottom",
  },
  {
    path: "/report",
    selector: "report-scale-add-band",
    title: "Add a band",
    body: "Optionally add bands like \"Distinction\" or \"A*\" that kick in once a student's average crosses a minimum percentage.",
    placement: "top",
  },
  {
    path: "/report",
    selector: "report-scale-save",
    title: "Save the scale",
    body: "This really saves it for the course — press it now to apply it.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/report",
    selector: "report-send-drive",
    title: "Send to Drive",
    body: "This generates every student's branded PDF and delivers it to their Drive folder — safe to try here, it's simulated for this demo and won't touch a real Drive. Press it now.",
    placement: "bottom",
    requireRealClick: true,
  },

  // ── Settings: password + theme ────────────────────────────────────────
  {
    path: "/report",
    selector: "user-menu-toggle",
    title: "Your account menu",
    body: "Everything account-related — your settings and light/dark mode — lives behind your avatar, top right. Open it now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/report",
    selector: "theme-toggle",
    title: "Light or dark mode",
    body: "Switch the whole app's theme right from here. Try it now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/settings",
    selector: "settings-password-section",
    title: "Changing your password",
    body: "And this is where you'd update your password any time — your name, avatar, and email are also managed on this page. That wraps up the tour!",
    placement: "top",
  },
];
