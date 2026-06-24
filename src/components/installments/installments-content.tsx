"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listPaymentPlans, markInstallmentPaid, type StudentPaymentRow } from "@/lib/actions/payments";

function fmt(n: number) {
  return `£${Math.round(n).toLocaleString("en-US")}`;
}

export function InstallmentsContent() {
  const [plans, setPlans] = useState<StudentPaymentRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setPlans(await listPaymentPlans());
    } catch {
      setError("Couldn't load payment plans.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!plans) return [];
    const q = search.trim().toLowerCase();
    return q ? plans.filter((p) => p.studentName.toLowerCase().includes(q)) : plans;
  }, [plans, search]);

  const stats = plans
    ? [
        { value: fmt(plans.reduce((s, p) => s + p.totalAmount, 0)), label: "Total billed", color: "var(--brand)" },
        { value: fmt(plans.reduce((s, p) => s + p.paidAmount, 0)), label: "Collected", color: "var(--ok)" },
        { value: fmt(plans.reduce((s, p) => s + (p.totalAmount - p.paidAmount), 0)), label: "Outstanding", color: "var(--warn)" },
      ]
    : [];

  async function onToggleInstallment(installmentId: string, paid: boolean) {
    setTogglingId(installmentId);
    setPlans((prev) =>
      prev
        ? prev.map((p) => ({
            ...p,
            installments: p.installments.map((i) => (i.id === installmentId ? { ...i, status: paid ? "paid" : "pending" } : i)),
          }))
        : prev
    );
    try {
      await markInstallmentPaid(installmentId, paid);
      await reload();
    } catch {
      setError("Couldn't update this installment — try again.");
    } finally {
      setTogglingId(null);
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

      {/* HEADER */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Registration</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Installments &amp; payments</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Track each student&apos;s payment plan and mark installments as paid.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {loading || !plans
            ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[58px]" />)
            : stats.map((s) => (
                <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[12px_14px]">
                  <div className="font-mono text-[21px] font-bold leading-[1.1] tracking-[-0.02em]" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="mt-[2px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
                </div>
              ))}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex h-10 min-w-[200px] max-w-[300px] items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
        <Icon name="search" size={16} className="text-[var(--subtle)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students…"
          className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
        />
      </div>

      {/* PLANS LIST */}
      <div className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {loading && !plans ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonRow key={i} className="h-[60px]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">
            {search ? "No students match this search." : "No payment plans yet — they're created when Registration enrolls a student."}
          </div>
        ) : (
          filtered.map((p) => {
            const expanded = !!open[p.studentId];
            const outstanding = p.totalAmount - p.paidAmount;
            const pct = p.totalAmount ? Math.round((p.paidAmount / p.totalAmount) * 100) : 0;
            return (
              <div key={p.studentId} className="border-b border-[var(--border2)] last:border-b-0">
                <div
                  onClick={() => setOpen((prev) => ({ ...prev, [p.studentId]: !prev[p.studentId] }))}
                  className="flex flex-wrap items-center gap-3 p-[12px_18px] cursor-pointer hover:bg-[var(--surface2)]"
                >
                  <div className="flex min-w-[180px] flex-1 items-center gap-[11px]">
                    <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12.5px] font-bold text-[var(--brand)]">
                      {p.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold text-[var(--text)]">{p.studentName}</div>
                      <div className="text-[11.5px] text-[var(--subtle)]">{p.offering}</div>
                    </div>
                  </div>
                  <span className="inline-flex flex-none items-center gap-[6px] rounded-full bg-[var(--surface2)] px-[10px] py-[4px] text-[12px] font-semibold text-[var(--muted)]">
                    {p.planType === "full" ? "Full payment" : `${p.installments.length} installments`}
                  </span>
                  <div className="min-w-[110px] flex-none text-right font-mono text-[13px] font-bold text-[var(--text)]">{fmt(p.totalAmount)}</div>
                  <span
                    className="inline-flex flex-none items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                    style={outstanding <= 0 ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--warns)", color: "var(--warn)" }}
                  >
                    <Icon name={outstanding <= 0 ? "check2" : "clock"} size={12} />
                    {outstanding <= 0 ? "Paid in full" : `${fmt(outstanding)} due`}
                  </span>
                  <Icon name="chevron-down" size={16} className="flex-none text-[var(--subtle)]" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
                </div>
                {expanded && (
                  <div className="border-t border-[var(--border2)] bg-[var(--surface2)] p-[12px_18px]">
                    <div className="mb-3 h-[6px] overflow-hidden rounded-full bg-[var(--surface)]">
                      <div className="h-full rounded-full bg-[var(--ok)] transition-[width]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      {p.installments.map((inst) => (
                        <div key={inst.id} className="flex flex-wrap items-center gap-[10px] rounded-[9px] bg-[var(--surface)] p-[9px_12px]">
                          <span className="w-[90px] flex-none text-[12.5px] font-semibold text-[var(--text)]">Payment {inst.seq}</span>
                          <span className="flex-1 font-mono text-[13px] font-bold text-[var(--text)]">{fmt(inst.amount)}</span>
                          <span className="flex-none text-[12px] text-[var(--subtle)]">{inst.dueDate ? `Due ${inst.dueDate}` : "—"}</span>
                          {togglingId === inst.id && <Spinner size={13} className="flex-none text-[var(--subtle)]" />}
                          <button
                            onClick={() => onToggleInstallment(inst.id, inst.status !== "paid")}
                            disabled={togglingId === inst.id}
                            className="flex flex-none items-center gap-[6px] rounded-[8px] border px-[11px] py-[6px] text-[12px] font-semibold disabled:opacity-60"
                            style={
                              inst.status === "paid"
                                ? { borderColor: "var(--ok)", background: "var(--oks)", color: "var(--ok)" }
                                : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                            }
                          >
                            <Icon name={inst.status === "paid" ? "check2" : "clock"} size={13} />
                            {inst.status === "paid" ? "Paid" : "Mark paid"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
