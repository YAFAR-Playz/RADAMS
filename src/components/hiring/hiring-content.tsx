"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import type { Role } from "@/lib/roles";
import { listRecentStaffJoins, type StaffingLogRow } from "@/lib/actions/hr";
import { listStaff, createStaffMember, removeStaffMember, type StaffMember } from "@/lib/actions/staff";

const ROLE_OPTIONS: Role[] = ["hr", "head", "assistant", "registration", "finance"];
const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  hr: "HR",
  head: "Head",
  assistant: "Assistant",
  registration: "Registration",
  finance: "Finance",
};

type Kind = "add" | "remove";
function today() {
  return new Date().toISOString().slice(0, 10);
}
const emptyForm = { name: "", email: "", phone: "", role: "assistant" as Role, existingId: "", hireDate: today(), leaveDate: today() };

export function HiringContent() {
  const [log, setLog] = useState<StaffingLogRow[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("add");
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([listRecentStaffJoins(), listStaff()]);
      setLog(l);
      setStaff(s.filter((u) => u.role !== "owner" && u.role !== "admin"));
    } catch {
      setError("Couldn't load hiring data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  function openNew(k: Kind) {
    setKind(k);
    setForm({ ...emptyForm, existingId: staff?.[0]?.id ?? "" });
    setModalOpen(true);
  }

  const canSubmit = kind === "add" ? form.name.trim().length > 0 && form.email.trim().length > 0 : form.existingId.length > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (kind === "add") {
        await createStaffMember({ name: form.name, email: form.email, phone: form.phone, role: form.role, hireDate: form.hireDate });
      } else {
        await removeStaffMember(form.existingId, form.leaveDate);
      }
      setModalOpen(false);
      await reload();
    } catch {
      setError(kind === "add" ? "Couldn't add this staff member — try again." : "Couldn't remove this staff member — try again.");
    } finally {
      setSubmitting(false);
    }
  }

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

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">HR</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Hiring &amp; staffing</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
          Add or remove any non-admin staff member — heads, assistants, registration, finance or HR.
        </p>
        <div className="mt-[15px] flex flex-wrap gap-2">
          <button
            onClick={() => openNew("add")}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
          >
            <Icon name="user-plus" size={16} />
            Add staff
          </button>
          <button
            onClick={() => openNew("remove")}
            disabled={!staff || staff.length === 0}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--danger)] hover:bg-[var(--dangers)] hover:border-[var(--danger)] disabled:opacity-60"
          >
            <Icon name="x" size={16} />
            Remove
          </button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <header className="border-b border-[var(--border2)] p-[14px_18px]">
          <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Recent staffing actions</h3>
        </header>
        <div className="p-[7px_8px]">
          {loading && !log ? (
            <div className="flex flex-col gap-2 p-[8px]">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} className="h-[52px]" />
              ))}
            </div>
          ) : log && log.length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No staffing activity yet.</div>
          ) : (
            log?.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-[11px] rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[var(--surface2)]" style={{ color: l.color }}>
                  <Icon name={l.icon} size={16} />
                </div>
                <div className="min-w-[150px] flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{l.title}</div>
                  <div className="text-[12px] text-[var(--subtle)]">{l.detail}</div>
                </div>
                <span className="flex-none text-[11.5px] text-[var(--subtle)]">{new Date(l.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name={kind === "add" ? "user-plus" : "x"} size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">{kind === "add" ? "Add staff member" : "Remove staff member"}</h3>
                <div className="text-[12px] text-[var(--muted)]">Applied by HR — recorded with dates</div>
              </div>
              <button onClick={() => setModalOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[14px] p-[16px_18px]">
              {kind === "add" ? (
                <>
                  <div>
                    <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Full name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Jordan Hale"
                      className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
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
                  <div className="grid grid-cols-2 gap-[12px]">
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
                      <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Role</label>
                      <div className="flex h-[42px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                        <select
                          value={form.role}
                          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                          className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Hire date</label>
                    <input
                      type="date"
                      value={form.hireDate}
                      onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
                      className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Staff member to remove</label>
                    <div className="flex h-[42px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                      <select
                        value={form.existingId}
                        onChange={(e) => setForm((f) => ({ ...f, existingId: e.target.value }))}
                        className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
                      >
                        {(staff ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({ROLE_LABEL[s.role]})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Leave date</label>
                    <input
                      type="date"
                      value={form.leaveDate}
                      onChange={(e) => setForm((f) => ({ ...f, leaveDate: e.target.value }))}
                      className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                    />
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setModalOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={!canSubmit || submitting}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {submitting ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                {kind === "add" ? "Add staff" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
