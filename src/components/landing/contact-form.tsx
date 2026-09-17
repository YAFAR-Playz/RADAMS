"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { submitLead } from "@/lib/actions/leads";
import { STUDENT_RANGES, type LandingCopy } from "@/lib/landing-copy";
import { COUNTRY_CODES, flagEmoji } from "@/lib/country-codes";

// Egypt first (this product's primary market) as the sane default, rather
// than forcing every visitor to hunt for their country in the dropdown.
const DEFAULT_DIAL = COUNTRY_CODES[0].dial;

const emptyForm = { firstName: "", lastName: "", organization: "", email: "", dial: DEFAULT_DIAL, phone: "", studentRange: "", message: "" };
// A field real visitors never see or fill (moved off-screen, not just
// display:none — some bots specifically skip hidden-via-display fields) but
// a scripted bot filling every input on the page will. Non-empty on submit
// means don't insert anything, but still show success so the bot can't tell
// it was caught and adjust.
const HONEYPOT_FIELD = "website";

export function ContactForm({ copy, brand }: { copy: LandingCopy; brand: string }) {
  const [form, setForm] = useState(emptyForm);
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit =
    form.firstName.trim() && form.lastName.trim() && form.organization.trim() && form.email.trim() && form.phone.trim() && form.studentRange;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "sending") return;
    if (honeypot.trim()) {
      setStatus("sent");
      setForm(emptyForm);
      return;
    }
    setStatus("sending");
    try {
      const dialEntry = COUNTRY_CODES.find((c) => c.dial === form.dial);
      await submitLead({
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        organization: form.organization,
        email: form.email,
        phone: `+${form.dial} ${form.phone.trim()}`,
        country: dialEntry?.name ?? "",
        studentRange: form.studentRange,
        message: form.message,
      });
      setStatus("sent");
      setForm(emptyForm);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : null);
      setStatus("error");
    }
  }

  const inputClass =
    "h-[46px] w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] px-[14px] text-[13.5px] text-[var(--text)] outline-none placeholder:text-[var(--subtle)] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]";
  const labelClass = "mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]";

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center gap-[14px] rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-[40px] text-center shadow-[0_1px_2px_rgba(16,23,41,0.04),0_18px_40px_rgba(16,23,41,0.08)]">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full" style={{ background: "var(--oks)", color: "var(--ok)" }}>
          <Icon name="check" size={26} />
        </div>
        <p className="m-0 max-w-[320px] text-[15px] font-medium text-[var(--text)]">{copy.contact.success}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-[14px] rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-[24px] shadow-[0_1px_2px_rgba(16,23,41,0.04),0_18px_40px_rgba(16,23,41,0.08)] sm:p-[32px]"
    >
      {/* Off-screen, not display:none — a scripted bot that blindly fills
          every input still fills this one, but display:none/hidden inputs
          are commonly skipped by name/attribute heuristics. Untranslated and
          unlabeled on purpose - no real visitor should ever see or need it. */}
      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={HONEYPOT_FIELD}>Website</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <div>
          <label className={labelClass}>{copy.contact.fields.firstName}</label>
          <input className={inputClass} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.lastName}</label>
          <input className={inputClass} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.organization}</label>
          <input className={inputClass} value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.email}</label>
          <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>{copy.contact.fields.phone}</label>
          {/* dir="ltr" on the row itself, not just each input's own text —
              a dial code always precedes the number it prefixes ("+20 ...")
              as one unit, so the pair shouldn't visually flip under RTL the
              way independent fields correctly do. */}
          <div className="flex gap-[8px]" dir="ltr">
            <select
              // !w-[...] (important) since inputClass already bakes in
              // w-full — Tailwind resolves same-specificity conflicts by
              // stylesheet order, not by where each class sits in this
              // string, so a plain w-[128px] here silently lost to w-full.
              className={`${inputClass} !w-[128px] flex-none px-[8px]`}
              value={form.dial}
              onChange={(e) => setForm((f) => ({ ...f, dial: e.target.value }))}
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.iso2} value={c.dial}>
                  {flagEmoji(c.iso2)} +{c.dial}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              required
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.studentRange}</label>
          <select
            className={inputClass}
            value={form.studentRange}
            onChange={(e) => setForm((f) => ({ ...f, studentRange: e.target.value }))}
            required
          >
            <option value="" disabled>
              {copy.contact.fields.studentRangePlaceholder}
            </option>
            {STUDENT_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>{copy.contact.fields.message}</label>
        <textarea
          className={`${inputClass} h-[90px] resize-none py-[12px]`}
          placeholder={copy.contact.fields.messagePlaceholder}
          value={form.message}
          onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
        />
      </div>

      {status === "error" && (
        <div className="rounded-[10px] border border-[var(--danger)] bg-[var(--dangers)] px-[12px] py-[10px] text-[12.5px] font-medium text-[var(--danger)]">
          {errorMessage || copy.contact.error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit || status === "sending"}
        className="flex h-[48px] items-center justify-center gap-[8px] rounded-[12px] text-[14.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
        style={{ background: brand }}
      >
        {status === "sending" ? <Spinner size={16} /> : <Icon name="send" size={16} />}
        {status === "sending" ? copy.contact.submitting : copy.contact.submit}
      </button>
    </form>
  );
}
