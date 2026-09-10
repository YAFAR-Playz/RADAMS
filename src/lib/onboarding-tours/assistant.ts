import type { TourStep } from "./types";

// Build order: Assistant is second (see the onboarding-tour plan — Head,
// Assistant, Finance, Registration, HR, Admin). Same deep, scenario-based
// style as the Head tour: the user clicks real nav links/buttons himself,
// and every requireRealClick step really writes into his disposable demo
// clone for the rest of the session.
export const ASSISTANT_TOUR: TourStep[] = [
  // ── My Students: view a student, set a target grade, share the report
  //    folder, send a welcome message ──────────────────────────────────
  {
    path: "/students",
    selector: "mystudents-view-more",
    title: "See everything about a student",
    body: "This opens their full picture — traffic light status, attendance, assignment history, target grade, and their report folder. Press it now.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "mystudents-target-grade",
    title: "Set a target grade",
    body: "Give this student something to aim for — it shows up alongside their actual average wherever their progress is displayed.",
    placement: "top",
  },
  {
    path: "/students",
    selector: "mystudents-target-grade-save",
    title: "Save it",
    body: "This really saves the target — press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "mystudents-drive-link",
    title: "Share their report folder",
    body: "Paste the Google Drive folder link for this student's reports here — once saved, you can send it to their guardian anytime with one click.",
    placement: "top",
  },
  {
    path: "/students",
    selector: "mystudents-drive-save",
    title: "Save the link",
    body: "This really saves it to the student's record. Press it now.",
    placement: "top",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "mystudents-drive-send",
    title: "Send it over WhatsApp",
    body: "Now that the link is saved, this opens WhatsApp with it pre-filled for their guardian. Feel free to close this and try it for real.",
    placement: "top",
  },
  {
    path: "/students",
    selector: "mystudents-welcome",
    title: "Send a welcome message",
    body: "This is yours alone — a quick WhatsApp intro to a student or their guardian when they first land in your group. Press it to see the preview.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/students",
    selector: "mystudents-welcome-recipient",
    title: "Choose who gets it",
    body: "Switch between messaging the student directly or their parent/guardian.",
    placement: "bottom",
  },
  {
    path: "/students",
    selector: "mystudents-welcome-send",
    title: "Open WhatsApp",
    body: "This opens WhatsApp with the welcome message pre-filled. Try it for real if you'd like.",
    placement: "top",
  },

  // ── Assignments: log a result, message home about it ─────────────────
  {
    path: "/assignments",
    selector: "myassignments-course",
    title: "Your courses",
    body: "Switch between the courses you're assisting on here.",
    placement: "bottom",
  },
  {
    path: "/assignments",
    selector: "myassignments-picker",
    title: "Pick an assignment",
    body: "Every assignment your head creates for this course shows up here, ready for you to log.",
    placement: "bottom",
  },
  {
    path: "/assignments",
    selector: "myassignments-status",
    title: "Log the result",
    body: "Checked, submitted, late, missing, or excused — this is the core of your daily work. Change it and it saves immediately.",
    placement: "right",
  },
  {
    path: "/assignments",
    selector: "myassignments-grade",
    title: "Enter a grade",
    body: "When the assignment counts a grade, type it here — it saves the moment you click away.",
    placement: "top",
  },
  {
    path: "/assignments",
    selector: "myassignments-comment",
    title: "Add a comment",
    body: "A short note on this student's result — it's what gets sent home and shows up on their monthly report.",
    placement: "top",
  },
  {
    path: "/assignments",
    selector: "myassignments-send",
    title: "Notify home",
    body: "Once you've logged a result, send it straight to a parent or student over WhatsApp. Press it to see the message first.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/assignments",
    selector: "myassignments-modal-recipient",
    title: "Choose who gets it",
    body: "Switch between messaging the student directly or their parent/guardian — the phone number and wording update to match.",
    placement: "bottom",
  },
  {
    path: "/assignments",
    selector: "myassignments-modal-send",
    title: "Open WhatsApp",
    body: "This marks it sent and opens WhatsApp with the message ready to go. Feel free to close this and try it for real.",
    placement: "top",
  },

  // ── Attendance: view-only, but you can still follow up ───────────────
  {
    path: "/attendance",
    selector: "myattendance-course",
    title: "Your courses",
    body: "Switch courses here too — attendance is tracked separately per course.",
    placement: "bottom",
  },
  {
    path: "/attendance",
    selector: "myattendance-session-row",
    title: "Pick a session",
    body: "Registration logs attendance per session — click one to see who was marked present, late, or absent. Try it now.",
    placement: "right",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "myattendance-send",
    title: "Follow up on attendance",
    body: "You can't change attendance yourself — that's Registration's job — but you can message home about it. Press it to see the preview.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/attendance",
    selector: "myattendance-modal-recipient",
    title: "Choose who gets it",
    body: "Same choice as everywhere else — student directly, or their parent/guardian.",
    placement: "bottom",
  },
  {
    path: "/attendance",
    selector: "myattendance-modal-send",
    title: "Open WhatsApp",
    body: "Opens WhatsApp with the message ready. Feel free to try it for real.",
    placement: "top",
  },

  // ── Monthly Reports: what your students see, and when it appears ─────
  {
    path: "/report",
    selector: "myreport-course",
    title: "Your students' reports",
    body: "Pick a course and month here to see that group's monthly report.",
    placement: "bottom",
  },
  {
    path: "/report",
    selector: "myreport-not-generated",
    title: "Waiting on your head",
    body: "This is exactly what you'll see until your head generates the report for the month — once they do, every student here gets a real report you can view, download, print, or send home.",
    placement: "top",
  },

  // ── Weak Topics: tag a student's monthly weak spot ────────────────────
  {
    path: "/weak-topics",
    selector: "weaktopics-assign-select",
    title: "Tag a weak topic",
    body: "Your head sets these up in advance — pick one that matches where this student is struggling this month.",
    placement: "bottom",
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-assign-submit",
    title: "Add it",
    body: "This attaches the topic to the student for this month — it'll show up on their monthly report alongside your comment. Press it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-comment",
    title: "Write a monthly comment",
    body: "An overall note on how this student's month went — this appears on their report right next to their weak topics.",
    placement: "top",
  },
  {
    path: "/weak-topics",
    selector: "weaktopics-comment-save",
    title: "Save the comment",
    body: "Press Save to attach it for real.",
    placement: "top",
    requireRealClick: true,
  },

  // ── My Pay: understanding your own compensation ──────────────────────
  {
    path: "/mypay",
    selector: "mypay-breakdown",
    title: "Your pay, broken down",
    body: "This is your own compensation for the month — per course, with any bonuses or deductions your head applied and why.",
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
    body: "Every course you assist on has its own group channel — everyone on it (your head, and any other assistants) can see it. Open one now.",
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
