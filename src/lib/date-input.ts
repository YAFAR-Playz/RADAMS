import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";

// Native date/month inputs let you type digits by hand, which lets malformed
// or accidental values slip through. Every date/month field in the app should
// only be set by picking from the browser's calendar UI — these handlers
// block keyboard/paste entry and make a plain click open the picker (Chrome
// otherwise only opens it when you hit the small calendar icon).
//
// Do NOT also block "beforeinput": Chromium's native date/month calendar
// dropdown commits the value you click through a beforeinput event on the
// host input, not just "input"/"change" — blocking it unconditionally blocks
// the picker itself on desktop (confirmed: this exact addition broke desktop
// while leaving mobile's OS-level date sheet, which doesn't route through
// beforeinput, unaffected).
export function blockFreeTyping(e: KeyboardEvent<HTMLInputElement>) {
  e.preventDefault();
}

export function blockPaste(e: ClipboardEvent<HTMLInputElement>) {
  e.preventDefault();
}

export function openPickerOnClick(e: MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    // Some browsers throw if the input is disabled or not yet focusable — the
    // native click-to-focus behavior still lets the calendar icon work.
  }
}

export const pickerOnlyDateProps = {
  onKeyDown: blockFreeTyping,
  onPaste: blockPaste,
  onClick: openPickerOnClick,
};
