// Opens a blank tab synchronously, in direct response to a click, so it can
// later be pointed at a URL that's only known after an async fetch (e.g. a
// signed storage URL) without the browser silently blocking it as a popup -
// window.open() called only after that fetch resolves is no longer treated
// as a fresh user gesture, and gets blocked with no error surfaced.
//
// Deliberately no "noopener" here (unlike a normal same-tick external link)
// - per spec that makes window.open() return null instead of a handle, so
// there'd be nothing left to redirect once the fetch resolves. Spec-compliant
// browsers enforce this correctly (confirmed on iOS Safari: the blank tab
// opened, but with no handle to it, so it could only ever stay blank, while
// this file's `resolvePendingTab` fell through to its "not found" branch
// regardless of what the fetch actually returned - Chromium was more lenient
// about handing back a handle anyway, which is why this bug didn't show up
// everywhere). The destination is always our own signed storage URL, never
// arbitrary content, so the reverse-tabnabbing risk noopener guards against
// doesn't apply.
export function openPendingTab(): Window | null {
  return window.open("", "_blank");
}

// Points a tab opened by openPendingTab at its real destination once ready,
// or shows `fallbackMessage` in it instead of trying to close it. Closing a
// regular tab (as opposed to a true popup window) from script is unreliable
// on mobile browsers - notably iOS Safari, which silently ignores
// window.close() there - which previously left an unexplained blank tab
// behind whenever the fetch turned up nothing (or failed) after already
// opening one via openPendingTab.
export function resolvePendingTab(win: Window | null, url: string | null, fallbackMessage: string) {
  if (!win) return;
  if (url) {
    win.location.href = url;
    return;
  }
  win.document.write(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font:15px system-ui;padding:24px;color:#333">${fallbackMessage}</body></html>`
  );
  win.document.close();
}
