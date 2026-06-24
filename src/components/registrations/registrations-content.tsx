"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import { registerStudent, listRegistrations, type RegistrationRow } from "@/lib/actions/registrations";

const PAGE_SIZE = 15;

const emptyForm = { name: "", phone: "", email: "", guardianName: "", guardianPhone: "" };

export function RegistrationsContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
    reload();
  }, []);

  async function reload() {
    setLoading(true);
    try {
      setRegistrations(await listRegistrations());
    } catch {
      setError("Couldn't load recent registrations.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = form.name.trim().length > 0 && !!offeringId;

  async function onSubmit() {
    if (!canSubmit || !offeringId) return;
    setSubmitting(true);
    try {
      await registerStudent(offeringId, form);
      setForm(emptyForm);
      setSuccess(`${form.name.trim()} was registered.`);
      setPage(0);
      await reload();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Couldn't register this student — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    if (!registrations) return [];
    const q = search.trim().toLowerCase();
    return q ? registrations.filter((r) => r.name.toLowerCase().includes(q)) : registrations;
  }, [registrations, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const offeringsLoading = offerings === null;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--ok)] bg-[var(--oks)] px-4 py-3 text-[13px] font-medium text-[var(--ok)]">
          <Icon name="check2" size={16} />
          {success}
        </div>
      )}

      {/* HEADER */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Registration</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Register a student</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Enroll a single student into a course offering. For bulk sign-ups, use Import.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
        {/* REGISTRATION FORM */}
        <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="border-b border-[var(--border2)] p-[14px_18px]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">New registration</h3>
          </header>
          <div className="flex flex-col gap-[14px] p-[16px_18px]">
            <div>
              <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Course offering</label>
              {offeringsLoading ? (
                <SkeletonRow className="h-[42px] w-full" />
              ) : (
                <div className="flex h-[42px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                  <select
                    value={offeringId ?? ""}
                    onChange={(e) => setOfferingId(e.target.value)}
                    className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-medium text-[var(--text)] outline-none"
                  >
                    {(offerings ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">
                Student name <span className="text-[var(--danger)]">*</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Liam Carter"
                className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="7700 900000"
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@email.com"
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Guardian name</label>
                <input
                  value={form.guardianName}
                  onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Guardian phone</label>
                <input
                  value={form.guardianPhone}
                  onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
                  placeholder="7700 900000"
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
            </div>
            <button
              onClick={onSubmit}
              disabled={!canSubmit || submitting}
              className="flex h-[44px] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
            >
              {submitting ? <Spinner size={15} /> : <Icon name="user-plus" size={16} />}
              Register student
            </button>
          </div>
        </section>

        {/* RECENT REGISTRATIONS */}
        <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="flex flex-wrap items-center justify-between gap-[10px] border-b border-[var(--border2)] p-[14px_18px]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Recent registrations</h3>
            <div className="flex h-9 min-w-[180px] max-w-[260px] items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
              <Icon name="search" size={14} className="text-[var(--subtle)]" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search…"
                className="h-full w-full border-none bg-transparent text-[12.5px] text-[var(--text)] outline-none"
              />
            </div>
          </header>
          <div className="p-[7px_8px]">
            {loading && !registrations ? (
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <SkeletonRow key={i} className="h-[52px]" />
                ))}
              </div>
            ) : pageRows.length === 0 ? (
              <div className="p-[28px_12px] text-center text-[13px] text-[var(--muted)]">
                {search ? `No students match "${search}"` : "No registrations yet."}
              </div>
            ) : (
              pageRows.map((r) => (
                <div key={r.enrollmentId} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-[var(--text)]">{r.name}</div>
                    <div className="text-[12px] text-[var(--subtle)]">{r.offering}</div>
                  </div>
                  <span className="flex-none font-mono text-[12px] text-[var(--muted)]">{r.phone ?? "—"}</span>
                </div>
              ))
            )}
          </div>
          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[11px_16px]">
              <span className="text-[12px] text-[var(--subtle)]">
                {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-[5px]">
                {Array.from({ length: pageCount }, (_, i) => i)
                  .filter((i) => i >= safePage - 2 && i <= safePage + 2)
                  .map((i) => {
                    const active = i === safePage;
                    return (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className="h-8 min-w-8 rounded-[7px] border px-2 text-[12.5px] font-semibold"
                        style={
                          active
                            ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                            : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                        }
                      >
                        {i + 1}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
