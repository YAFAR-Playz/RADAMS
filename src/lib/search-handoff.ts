// Hands a search term from the header's global search to whichever list page
// it navigates to, without relying on the URL (avoids Suspense wiring just
// for a one-shot value). Read once on mount, then cleared immediately so it
// doesn't leak into a later unrelated visit to the same page.
const KEY = "zad-search-handoff";

export function setSearchHandoff(q: string) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(KEY, q);
}

export function consumeSearchHandoff(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const q = sessionStorage.getItem(KEY);
  if (q !== null) sessionStorage.removeItem(KEY);
  return q;
}
