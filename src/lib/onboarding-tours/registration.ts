import type { TourStep } from "./types";

// Build order: Registration is fourth (see the onboarding-tour plan — Head,
// Assistant, Finance, Registration, HR, Admin). Same deep, scenario-based
// style as the earlier tours: the user clicks real nav links/buttons himself,
// and every requireRealClick step really writes into his disposable demo
// clone for the rest of the session.
export const REGISTRATION_TOUR: TourStep[] = [
  // ── Registrations: enroll a new student ───────────────────────────────
  {
    path: "/registrations",
    selector: "registrations-course",
    title: "Pick a course offering",
    body: "The student you register below gets enrolled into whichever course, session and unit is selected here.",
    placement: "right",
  },
  {
    path: "/registrations",
    selector: "registrations-name",
    title: "Student name",
    body: "The only required field — everything else can be filled in later from the Students tab.",
    placement: "top",
  },
  {
    path: "/registrations",
    selector: "registrations-phone",
    title: "Phone number",
    body: "If a phone number is entered, it's checked against existing students first — so you never accidentally create a duplicate.",
    placement: "top",
  },
  {
    path: "/registrations",
    selector: "registrations-plan-installments",
    title: "Choose a payment plan",
    body: "Full payment, or split into installments — try switching to Installments now, it's just a selection, nothing is charged.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/registrations",
    selector: "registrations-submit",
    title: "Register the student",
    body: "This really enrolls them for real, right into your disposable demo clone. Fill in a name above and press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/registrations",
    selector: "registrations-search",
    title: "Find a recent registration",
    body: "Everyone you or a colleague has registered shows up in this list — search by name or student ID.",
    placement: "left",
  },

  // ── Installments: manage a student's payment plan ─────────────────────
  // There's no nav link or button to this screen yet anywhere in the app —
  // it's a real, working page, just not linked from Registrations yet. So
  // we jump straight there.
  {
    path: "/installments",
    selector: "installments-search",
    title: "Every payment plan, in one place",
    body: "This isn't linked from anywhere yet, but it's a real, fully working screen — search any student's plan by name or ID here.",
    placement: "bottom",
  },
  {
    path: "/installments",
    selector: "installments-filter",
    title: "Filter by status",
    body: "Jump straight to everyone still paying in installments. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/installments",
    selector: "installments-row-expand",
    title: "Open a plan",
    body: "See the full breakdown — plan type, discount, and every individual installment. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/installments",
    selector: "installments-plan-type",
    title: "Change the plan type",
    body: "Switch between full payment and installments — locked once a payment has actually been made, to keep the numbers consistent.",
    placement: "top",
  },
  {
    path: "/installments",
    selector: "installments-discount",
    title: "Apply a discount",
    body: "A percentage knocked off this student's total — saves the moment you click away.",
    placement: "top",
  },
  {
    path: "/installments",
    selector: "installments-mark-paid",
    title: "Mark an installment paid",
    body: "This really records the payment. Press it now — it's a toggle, so you can press it again to undo.",
    placement: "left",
    requireRealClick: true,
  },

  // ── Attendance: the one place Registration can actually take it ──────
  {
    path: "/attendance",
    selector: "attendance-course-select",
    title: "Pick a course",
    body: "Attendance is tracked separately per course — pick one here.",
    placement: "bottom",
  },
  {
    path: "/attendance",
    selector: "attendance-new-session",
    title: "Create a session",
    body: "Heads and assistants can only view attendance — creating and editing sessions is your job. Press this now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "attendance-new-session-title",
    title: "Name the session",
    body: "e.g. \"Week 7 — Lecture\" — whatever helps you tell sessions apart later.",
    placement: "top",
  },
  {
    path: "/attendance",
    selector: "attendance-new-session-create",
    title: "Create it",
    body: "This really creates the session, with every enrolled student added to its roster. Press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "myattendance-session-row",
    title: "Open a session",
    body: "Click any session to see and mark its roster. Try it now.",
    placement: "right",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "attendance-mark-status",
    title: "Mark attendance",
    body: "Present, late, or absent — per student, saved instantly. Try marking one now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "attendance-all-present",
    title: "Or mark everyone at once",
    body: "Overwrites the whole roster to Present in one click — handy when nobody was absent. Press it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "attendance-all-present-confirm",
    title: "Confirm",
    body: "This really overwrites every student's status for this session. Press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Import: bulk-enroll from a CSV ────────────────────────────────────
  {
    path: "/import",
    selector: "import-course",
    title: "Bulk-enroll from a spreadsheet",
    body: "Pick the course offering every row will be enrolled into — same as registering one at a time, just for many students at once.",
    placement: "bottom",
  },
  {
    path: "/import",
    selector: "import-browse",
    title: "Upload a CSV",
    body: "Browse for a file to see the rest of the wizard: mapping your columns to ZAD-AMS fields, a full preview with duplicate detection, then the real import. Feel free to try it with a real file later.",
    placement: "top",
  },

  // ── Students: enrollment & payment status, org-wide ───────────────────
  {
    path: "/students",
    selector: "students-unassigned-toggle",
    title: "Unassigned students",
    body: "Filter to students nobody's been assigned to yet — useful right after a head auto-assigns and something's left over. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "students-payment-filter",
    title: "Filter by payment status",
    body: "Your own view of every student, org-wide — filtered by how they're paying. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "students-edit",
    title: "Edit a student",
    body: "Contact details, enrollment, and their active/left status — all editable from here. Press it now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "students-add-course",
    title: "Enroll them in another course",
    body: "Add them to a second course offering right from here — no need to go back to Registrations.",
    placement: "top",
  },
  {
    path: "/students",
    selector: "students-add-course-confirm",
    title: "Add it",
    body: "This really enrolls them. Pick a course above and press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "students-mark-left",
    title: "Mark as left",
    body: "Removes them from this one course's active roster while keeping their history — they stay active in any other course they're enrolled in.",
    placement: "top",
  },
  {
    path: "/students",
    selector: "students-save-edit",
    title: "Save your changes",
    body: "This really saves everything above. Press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Chat: staff DMs only — no course channels for Registration ────────
  {
    path: "/chat",
    selector: "chat-new-message",
    title: "Start a conversation",
    body: "Registration doesn't have course channels — every conversation here is a direct message with another staff member. Press this now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/chat",
    selector: "chat-dm-directory-row",
    title: "Pick a coworker",
    body: "Every head, assistant, and fellow staff member in the organization shows up here. Pick one to start messaging them.",
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

  // ── Settings: password + theme ────────────────────────────────────────
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
