// Hands a target profile id (and optionally a draft to prefill) from an
// external "Continue in chat" action (e.g. the Salaries inquiries popup) to
// the Chat page, so it opens straight into that DM instead of landing on the
// plain conversation list. Same one-shot sessionStorage pattern as
// search-handoff.ts, for the same reason — no Suspense wiring just for a
// value that's only ever read once, right after navigation.
//
// `draft` exists because Finance Inquiries (finance_messages) and Chat DMs
// (conversations/messages) are two entirely separate message stores — the
// DM this opens never actually contained the inquiry's text, so there's no
// real history to jump into. Rather than fabricate chat messages under the
// staff member's name to fake that history (an actual integrity problem —
// they never sent those as chat messages), the inquiry's own last message
// is quoted into the compose box instead, so the context carries over into
// the real, correctly-attributed conversation once it's actually sent.
const KEY = "zad-chat-handoff";
const DRAFT_KEY = "zad-chat-handoff-draft";

export function setChatHandoff(profileId: string, draft?: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, profileId);
  if (draft) sessionStorage.setItem(DRAFT_KEY, draft);
  else sessionStorage.removeItem(DRAFT_KEY);
}

export function consumeChatHandoff(): { profileId: string; draft: string | null } | null {
  if (typeof sessionStorage === "undefined") return null;
  const id = sessionStorage.getItem(KEY);
  if (id === null) return null;
  sessionStorage.removeItem(KEY);
  const draft = sessionStorage.getItem(DRAFT_KEY);
  sessionStorage.removeItem(DRAFT_KEY);
  return { profileId: id, draft };
}
