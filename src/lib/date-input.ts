import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";

// Native date/month inputs let you type digits by hand, which lets malformed
// or accidental values slip through. Every date/month field in the app should
// only be set by picking from the browser's calendar UI — these two handlers
// block keyboard/paste entry and make a plain click open the picker (Chrome
// otherwise only opens it when you hit the small calendar icon).
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
