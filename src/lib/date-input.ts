import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";

// Firefox (and older Safari) never implemented a native picker UI for
// <input type="month"> or type="week"> — they silently render it as a plain
// text box instead, while still reporting `.type` as "month". If we block
// all keyboard entry unconditionally on those browsers, the field becomes
// completely dead: no picker to click, no typing allowed, no way to ever
// change the value. Detect real native support per input type (a browser
// with a genuine picker rejects/clears an invalid string value instead of
// just storing it) and only enforce picker-only behavior where a picker
// actually exists to fall back on.
const nativeSupportCache = new Map<string, boolean>();

function supportsNativePicker(type: string): boolean {
  if (typeof document === "undefined") return true;
  const cached = nativeSupportCache.get(type);
  if (cached !== undefined) return cached;
  const probe = document.createElement("input");
  probe.setAttribute("type", type);
  probe.value = "__invalid__";
  const supported = probe.value !== "__invalid__";
  nativeSupportCache.set(type, supported);
  return supported;
}

// Native date/month inputs let you type digits by hand, which lets malformed
// or accidental values slip through. Every date/month field in the app should
// only be set by picking from the browser's calendar UI — these handlers
// block keyboard/paste entry and make a plain click open the picker (Chrome
// otherwise only opens it when you hit the small calendar icon). On browsers
// with no native picker for this input type, typing is left enabled instead
// of blocking the field entirely.
//
// Do NOT also block "beforeinput": Chromium's native date/month calendar
// dropdown commits the value you click through a beforeinput event on the
// host input, not just "input"/"change" — blocking it unconditionally blocks
// the picker itself on desktop (confirmed: this exact addition broke desktop
// while leaving mobile's OS-level date sheet, which doesn't route through
// beforeinput, unaffected).
export function blockFreeTyping(e: KeyboardEvent<HTMLInputElement>) {
  if (!supportsNativePicker(e.currentTarget.type)) return;
  e.preventDefault();
}

export function blockPaste(e: ClipboardEvent<HTMLInputElement>) {
  if (!supportsNativePicker(e.currentTarget.type)) return;
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
