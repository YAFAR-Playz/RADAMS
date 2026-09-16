// Hands a target profile id from an external "Continue in chat" action (e.g.
// the Salaries inquiries popup) to the Chat page, so it opens straight into
// that DM instead of landing on the plain conversation list. Same one-shot
// sessionStorage pattern as search-handoff.ts, for the same reason — no
// Suspense wiring just for a value that's only ever read once, right after
// navigation.
const KEY = "zad-chat-handoff";

export function setChatHandoff(profileId: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, profileId);
}

export function consumeChatHandoff(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const id = sessionStorage.getItem(KEY);
  if (id !== null) sessionStorage.removeItem(KEY);
  return id;
}
