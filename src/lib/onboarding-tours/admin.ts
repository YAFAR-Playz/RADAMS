import type { TourStep } from "./types";

// Built last — Admin is the superset role (see the onboarding-tour plan:
// Head, Assistant, Finance, Registration, HR, Admin). Many screens below
// reuse data-tour selectors already added for other roles' equivalent
// tabs (Salaries, Evaluations, Students, the shared half of Organization
// settings, Chat, Settings) — this file is mostly sequencing those plus the
// admin-only screens (Staff, Courses, Templates, Branding, Branding-adjacent
// Report action, History).
//
// Two honest callouts baked into the copy, same spirit as HR's tour:
// - Login-as really swaps your own browser session into the other person's
//   identity — it's shown but never required to click, since it could strand
//   the tourer outside their own "Exit demo" recovery path.
// - "Delete from Drive" is destructive, so it's described but never required.
export const ADMIN_TOUR: TourStep[] = [
  // ── Staff: the roster, hiring, and staffing requests ──────────────────
  {
    path: "/staff",
    selector: "staff-search",
    title: "Every user in the organization",
    body: "Search and filter the whole roster by role here. One honest note: since this is a disposable demo, the only real colleague listed right now is you — add one for real below and they'll show up here too.",
    placement: "bottom",
  },
  {
    path: "/staff",
    selector: "staff-add-user",
    title: "Add a user",
    body: "Admin can hire into any role — even another Admin or HR account. Press this to add someone for real, into your disposable demo clone.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/staff",
    selector: "staff-modal-name",
    title: "Their name",
    body: "Fill this in — it's what shows up everywhere they're referenced.",
    placement: "top",
  },
  {
    path: "/staff",
    selector: "staff-modal-email",
    title: "Their email",
    body: "This is what they'll sign in with, so it needs to be a real, unique address.",
    placement: "top",
  },
  {
    path: "/staff",
    selector: "staff-modal-role",
    title: "Their role",
    body: "Pick any role in the organization — this is the one hiring screen that isn't restricted.",
    placement: "top",
  },
  {
    path: "/staff",
    selector: "staff-modal-save",
    title: "Add them",
    body: "This really creates the staff member. Fill in a name and email above, then press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/staff",
    selector: "staff-requests-view",
    title: "Staffing requests from Heads",
    body: "Every add, remove, or replace request a course head raises lands right here on the roster, above the search bar. Open one to see the full detail.",
    placement: "bottom",
  },
  {
    path: "/staff",
    selector: "staff-requests-decline",
    title: "Approve or decline it",
    body: "Approving really makes the staffing change; declining just closes the request with no changes. This really declines it — press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/staff",
    selector: "staff-login-as",
    title: "Login as",
    body: "This really switches your own browser session into that person's account — useful for troubleshooting what they see. We won't press it during the tour, since it would swap you out of this demo entirely; use Exit demo (not this button) whenever you're ready to leave.",
    placement: "left",
  },

  // ── Students: a quick look, reusing the same tab every role shares ────
  {
    path: "/students",
    selector: "students-unassigned-toggle",
    title: "Unassigned students",
    body: "Same Students tab every role sees — Admin gets the full org view. This filter narrows to students nobody's teaching yet.",
    placement: "bottom",
  },
  {
    path: "/students",
    selector: "students-traffic-light",
    title: "At-a-glance status",
    body: "Green, yellow, or red per student, based on grades, attendance, and payment — the bands are configurable in Organization settings, coming up shortly.",
    placement: "right",
  },

  // ── Courses: create an offering and assign a head ─────────────────────
  {
    path: "/courses",
    selector: "courses-search",
    title: "Every course offering",
    body: "Every course your organization runs, with its heads and enrollment at a glance. Search here.",
    placement: "bottom",
  },
  {
    path: "/courses",
    selector: "courses-add",
    title: "Create a new course offering",
    body: "This is Admin-only. Press it to open the form.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/courses",
    selector: "courses-modal-name",
    title: "Course name",
    body: "e.g. \"Physics\" — session and unit fields alongside it describe which run this is.",
    placement: "top",
  },
  {
    path: "/courses",
    selector: "courses-modal-fee",
    title: "Full-payment price",
    body: "What a student pays if they pay in one go — Registration sets up installment plans against this elsewhere.",
    placement: "top",
  },
  {
    path: "/courses",
    selector: "courses-modal-head",
    title: "Assign a course head",
    body: "Pick who's responsible for this offering — heads manage assistants, assignments and checking for the courses assigned to them.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/courses",
    selector: "courses-modal-save",
    title: "Create it",
    body: "This really creates the course offering. Fill in a name and session above, then press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/courses",
    selector: "courses-view-students",
    title: "See who's enrolled",
    body: "Toggle any row to its enrolled-students view right here in the table.",
    placement: "bottom",
  },
  {
    path: "/courses",
    selector: "courses-toggle-active",
    title: "Active or inactive",
    body: "Deactivating hides a course from new-registration pickers without deleting any of its history.",
    placement: "left",
  },

  // ── Salaries: admin-only add/remove, plus the shared payroll workflow ──
  {
    path: "/salaries",
    selector: "salaries-add-payee",
    title: "Add someone not on this period's list",
    body: "Admin-only — useful for a manual backfill line. Press it to open the picker.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/salaries",
    selector: "salaries-add-payee-person",
    title: "Pick who",
    body: "Anyone active who isn't already on this period's list shows up here.",
    placement: "top",
  },
  {
    path: "/salaries",
    selector: "salaries-add-payee-confirm",
    title: "Add them",
    body: "This really adds a blank line for them, starting at zero — edit it afterward like any other line. Press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/salaries",
    selector: "salaries-row-expand",
    title: "Open a person's breakdown",
    body: "Tap anyone's row to see and edit their per-course adjustments. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/salaries",
    selector: "salaries-bonus",
    title: "Bonus & deduction",
    body: "Add a bonus or deduction for this course this month — pair it with a reason so it's clear on their payslip.",
    placement: "top",
  },
  {
    path: "/salaries",
    selector: "salaries-release-row",
    title: "Release their pay",
    body: "Nobody sees anything in My Pay until you release it — try it now, it's reversible.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/salaries",
    selector: "salaries-mark-paid",
    title: "Mark as paid",
    body: "Once you've actually paid someone, mark it here — try it now, you can attach a receipt or skip that.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/salaries",
    selector: "salaries-remove-payee",
    title: "Remove from this period",
    body: "Admin-only, and it's a real delete of their line for this period — we'll just point it out rather than press it.",
    placement: "left",
  },

  // ── Evaluations: read-only view into what heads submitted ─────────────
  {
    path: "/evaluations",
    selector: "evaluations-period",
    title: "Every evaluation a head has submitted",
    body: "Filter by month, course or assistant to see exactly what a head chose — extras, deductions, rating and notes, read-only here.",
    placement: "bottom",
  },
  {
    path: "/evaluations",
    selector: "evaluations-row-expand",
    title: "See the full detail",
    body: "Open a row to see every line item behind the totals. To change a payable amount, that happens in Salaries instead. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },

  // ── Organization settings: shared payroll defaults + admin-only blocks ─
  {
    path: "/payroll",
    selector: "settings-feature-toggle",
    title: "Feature toggles",
    body: "Admin-only. Off by default — nothing changes for your organization until you turn one on. Try flipping one now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/payroll",
    selector: "settings-report-toggle",
    title: "Monthly report look",
    body: "Admin-only. Controls what a generated monthly report includes, for PDFs viewed on the site and sent to Drive alike.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/payroll",
    selector: "settings-notify-email-input",
    title: "Staffing request notifications",
    body: "Admin-only. HR and Admin accounts are already emailed automatically on every staffing change — add an address here to loop in anyone without an account.",
    placement: "top",
  },
  {
    path: "/payroll",
    selector: "settings-notify-email-add",
    title: "Add it",
    body: "This really saves it. Type an email above, then press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/payroll",
    selector: "settings-currency",
    title: "Organization currency",
    body: "Used everywhere money is shown — salaries, evaluations, payslips. Changing it re-labels every amount, it doesn't convert values.",
    placement: "bottom",
  },
  {
    path: "/payroll",
    selector: "settings-org-default-method",
    title: "Org-wide default calc method",
    body: "Admin-only. Applies now to every current head and assistant, and becomes the automatic default for anyone hired later.",
    placement: "top",
  },
  {
    path: "/payroll",
    selector: "settings-org-default-apply",
    title: "Set it & apply now",
    body: "This really applies the method to everyone currently active — anyone already on a fixed salary is left untouched. Press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Templates: WhatsApp messages + assignment logging types ───────────
  {
    path: "/templates",
    selector: "templates-select-category",
    title: "One message per category, per recipient",
    body: "Each notification category has a separate message for the student and for the parent. Pick one to load it below.",
    placement: "right",
  },
  {
    path: "/templates",
    selector: "templates-editor",
    title: "Edit the message",
    body: "This overrides the built-in default for your organization only. Variables like {student} get filled in automatically when it's sent.",
    placement: "top",
  },
  {
    path: "/templates",
    selector: "templates-insert-var",
    title: "Insert a variable",
    body: "Click one to drop it into the message at the end — try it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/templates",
    selector: "templates-save",
    title: "Save it",
    body: "This really saves your override. Press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/templates",
    selector: "templates-tab-assignment-types",
    title: "Assignment logging types",
    body: "A separate tab, still under Templates — controls which columns an assistant fills in when logging an assignment. Switch to it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/templates",
    selector: "assignment-types-new",
    title: "Add a new type",
    body: "Heads pick one of these when creating an assignment. Press this to open the form.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/templates",
    selector: "assignment-types-name",
    title: "Name it",
    body: "e.g. \"Mock quiz\" — the toggles below it control whether a grade and/or comment column shows up alongside status.",
    placement: "top",
  },
  {
    path: "/templates",
    selector: "assignment-types-save",
    title: "Save it",
    body: "This really creates the type. Fill in a name above, then press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Branding: how your organization looks ─────────────────────────────
  {
    path: "/branding",
    selector: "branding-name",
    title: "Brand name",
    body: "Shown wherever your organization's name appears across the app.",
    placement: "bottom",
  },
  {
    path: "/branding",
    selector: "branding-color-primary",
    title: "Primary color",
    body: "Every screen in your organization updates automatically. Try picking one now — it's reversible with Reset below.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/branding",
    selector: "branding-font",
    title: "Font family",
    body: "Changes the typeface across your whole organization's screens.",
    placement: "right",
  },
  {
    path: "/branding",
    selector: "branding-corner",
    title: "Corner radius",
    body: "Sharp or rounded — a small detail that carries through every card and button.",
    placement: "top",
  },
  {
    path: "/branding",
    selector: "branding-staff-report-toggle",
    title: "Staff report branding",
    body: "Choose whose logo and colors appear on generated staff pay/workload report PDFs — this one saves instantly. Try it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/branding",
    selector: "branding-save",
    title: "Save your changes",
    body: "This really saves your name, colors, font and shape for your organization. Press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Monthly report: generate, grade scale, send to Drive ──────────────
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
    body: "Controls how each student's average grade is displayed — raw percentage, a lettered scale, or a numeric one. Press it to open it.",
    placement: "bottom",
    requireRealClick: true,
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
    body: "Generates every student's branded PDF and delivers it to their Drive folder. Safe to try here, it's simulated for this demo and won't touch a real Drive. Press it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/report",
    selector: "report-delete-drive",
    title: "Delete from Drive",
    body: "Admin-only, and it's a real delete of this course's PDFs for the month from Drive — folders are left in place. We'll just point it out rather than press it.",
    placement: "left",
  },

  // ── History: read-only activity log ────────────────────────────────────
  {
    path: "/history",
    selector: "history-filter-all",
    title: "Every logged action, in one place",
    body: "Every add, edit, release, and delete across your organization for the last 30 days — filter by category with these pills.",
    placement: "bottom",
  },

  // ── Chat: staff DMs, plus course channels for courses you head ────────
  {
    path: "/chat",
    selector: "chat-new-message",
    title: "Start a conversation",
    body: "Message any staff member directly. Press this now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/chat",
    selector: "chat-dm-directory-row",
    title: "Pick a coworker",
    body: "Every head, assistant, and fellow staff member in the organization shows up here — including the person you just hired. Pick one to start messaging them.",
    placement: "right",
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

  // ── Settings: password + theme ─────────────────────────────────────────
  {
    path: "/chat",
    selector: "user-menu-toggle",
    title: "Your account menu",
    body: "Everything account-related — your settings and light/dark mode — lives behind your avatar, top right. Open it now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/chat",
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
