import type { ClipboardEvent, FormEvent, KeyboardEvent, MouseEvent } from "react";

// Native date/month inputs let you type digits by hand, which lets malformed
// or accidental values slip through. Every date/month field in the app should
// only be set by picking from the browser's calendar UI.
//
// blockFreeTyping alone isn't enough: mobile virtual keyboards and IME
// composition commit their value through the "beforeinput" event rather than
// a preventable "keydown", so a keydown-only block still lets typing through
// on phones/tablets (and in some desktop browsers for month/year segments).
// blockBeforeInput closes that gap; blockPaste covers paste/drag-drop.
export function blockFreeTyping(e: KeyboardEvent<HTMLInputElement>) {
  e.preventDefault();
}

export function blockBeforeInput(e: FormEvent<HTMLInputElement>) {
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
  onBeforeInput: blockBeforeInput,
  onPaste: blockPaste,
  onClick: openPickerOnClick,
};
