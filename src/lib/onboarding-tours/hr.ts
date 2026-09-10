import type { TourStep } from "./types";

// Build order: HR is fifth (see the onboarding-tour plan — Head, Assistant,
// Finance, Registration, HR, Admin). Same deep, scenario-based style as the
// earlier tours: the user clicks real nav links/buttons himself, and every
// requireRealClick step really writes into his disposable demo clone for
// the rest of the session.
//
// One honest caveat baked into this tour: colleague profiles in a cloned
// demo org keep the TEMPLATE org's org_id (they're shared across every
// clone, never duplicated — see start_onboarding_demo in migration 0059).
// Screens that resolve a colleague via a relational join (offering_heads,
// staffing_requests, staffing_log) show real, rich data. But Staff's main
// roster is a direct `profiles WHERE org_id = <clone>` query, so it only
// ever shows the tourer themself until they add someone — the tour says
// so plainly rather than pretending a populated team roster exists.
export const HR_TOUR: TourStep[] = [
  // ── Requests: review what course heads have asked for ─────────────────
  {
    path: "/requests",
    selector: "hr-requests-expand",
    title: "Staffing requests from Heads",
    body: "Every add, remove, or replace request a course head has raised lands here. Open one to see the full detail. Try it now.",
    placement: "bottom",
    requireRealClick: true,
  },
  {
    path: "/requests",
    selector: "hr-requests-approve",
    title: "Approve it",
    body: "Approving an \"add\" request really creates the new assistant and assigns them to the course. Approving a removal really takes them off it.",
    placement: "top",
  },
  {
    path: "/requests",
    selector: "hr-requests-decline",
    title: "Or decline it",
    body: "This really marks the request declined — no staff or course changes happen. Press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Staff: your organization's roster ─────────────────────────────────
  {
    path: "/staff",
    selector: "staff-search",
    title: "Every user in the organization",
    body: "Search and filter by role here. One honest note: since this is a disposable demo, the only real colleague listed right now is you — add one for real over in Hiring and they'll show up here too.",
    placement: "bottom",
  },
  {
    path: "/staff",
    selector: "staff-add-user",
    title: "Add a user directly",
    body: "This does the same thing as Hiring's \"Add staff\" — useful when you're already here managing the roster. We'll do the real add over in Hiring next.",
    placement: "left",
  },

  // ── Hiring: add or remove a staff member for real ─────────────────────
  {
    path: "/hiring",
    selector: "hiring-add-staff",
    title: "Add a new staff member",
    body: "This is HR's dedicated hire/fire screen. Press this to add someone for real, right into your disposable demo clone.",
    placement: "left",
    requireRealClick: true,
  },
  {
    path: "/hiring",
    selector: "hiring-name",
    title: "Their name",
    body: "Fill this in — it's what shows up everywhere they're referenced.",
    placement: "top",
  },
  {
    path: "/hiring",
    selector: "hiring-email",
    title: "Their email",
    body: "This is what they'll sign in with, so it needs to be a real, unique address.",
    placement: "top",
  },
  {
    path: "/hiring",
    selector: "hiring-role",
    title: "Their role",
    body: "HR can hire into any non-admin role — head, assistant, registration, finance, or another HR account.",
    placement: "top",
  },
  {
    path: "/hiring",
    selector: "hiring-submit",
    title: "Add them",
    body: "This really creates the staff member. Fill in a name and email above, then press it now.",
    placement: "top",
    requireRealClick: true,
  },

  // ── Chat: staff DMs only — no course channels for HR ──────────────────
  {
    path: "/chat",
    selector: "chat-new-message",
    title: "Start a conversation",
    body: "HR doesn't have course channels — every conversation here is a direct message with another staff member. Press this now.",
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
