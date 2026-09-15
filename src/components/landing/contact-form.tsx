"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { submitLead } from "@/lib/actions/leads";
import { STUDENT_RANGES, type LandingCopy } from "@/lib/landing-copy";

const emptyForm = { name: "", organization: "", email: "", phone: "", country: "", studentRange: "", message: "" };

export function ContactForm({ copy, brand }: { copy: LandingCopy; brand: string }) {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const canSubmit =
    form.name.trim() && form.organization.trim() && form.email.trim() && form.phone.trim() && form.country.trim() && form.studentRange;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || status === "sending") return;
    setStatus("sending");
    try {
      await submitLead(form);
      setStatus("sent");
      setForm(emptyForm);
    } catch {
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
      <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
        <div>
          <label className={labelClass}>{copy.contact.fields.name}</label>
          <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.organization}</label>
          <input className={inputClass} value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.email}</label>
          <input type="email" className={inputClass} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.phone}</label>
          <input className={inputClass} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
        </div>
        <div>
          <label className={labelClass}>{copy.contact.fields.country}</label>
          <input
            className={inputClass}
            placeholder={copy.contact.fields.countryPlaceholder}
            value={form.country}
            onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            required
          />
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
          {copy.contact.error}
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
