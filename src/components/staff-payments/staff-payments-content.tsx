"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { listStaffPayments, updatePaySettings, type StaffPaymentRow, type CalcMethod } from "@/lib/actions/staff-payments";

const PAGE_SIZE = 8;
const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", EGP: "E£", AED: "د.إ" };
const METHOD_OPTS: { value: CalcMethod; label: string }[] = [
  { value: "paper", label: "Per paper" },
  { value: "category", label: "Avg-paper category" },
  { value: "fixed", label: "Fixed salary" },
];
const PAY_OPTS = ["Bank transfer", "Mobile wallet", "Cash"];

function tenureLabel(months: number) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y ? `${y}y ` : ""}${m}mo`;
}

export function StaffPaymentsContent() {
  const [rows, setRows] = useState<StaffPaymentRow[] | null>(null);
  const [currency, setCurrency] = useState("GBP");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "head" | "assistant">("all");
  const [page, setPage] = useState(0);

  async function reload() {
    setLoading(true);
    try {
      const [data, settings] = await Promise.all([listStaffPayments(), getPayrollSettings()]);
      setRows(data);
      if (settings) setCurrency(settings.currency);
    } catch {
      setError("Couldn't load staff payments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  const sym = CURRENCY_SYMBOL[currency] ?? "£";
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString("en-US")}`;

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (filter !== "all" && r.role !== filter) return false;
      return true;
    });
  }, [rows, search, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  async function patchRow(id: string, patch: Partial<StaffPaymentRow>, apiPatch: Parameters<typeof updatePaySettings>[1]) {
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
    setSavingId(id);
    try {
      await updatePaySettings(id, apiPatch);
    } catch {
      setError("Couldn't save this change — try again.");
    } finally {
      setSavingId(null);
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
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Finance</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Staff payments</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
          Every head &amp; assistant — payment method, last payment, lifetime earnings, and how their salary is calculated.
        </p>
        <div className="mt-[15px] flex flex-wrap items-center gap-[10px]">
          <div className="flex h-10 min-w-[200px] max-w-[320px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
            <Icon name="search" size={16} className="text-[var(--subtle)]" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search staff…"
              className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-[6px]">
            {(["all", "head", "assistant"] as const).map((v) => {
              const active = filter === v;
              return (
                <button
                  key={v}
                  onClick={() => {
                    setFilter(v);
                    setPage(0);
                  }}
                  className="rounded-full border px-3 py-[7px] text-[12.5px] font-semibold"
                  style={
                    active
                      ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                      : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                  }
                >
                  {v === "all" ? "All" : v === "head" ? "Heads" : "Assistants"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* STAFF CARDS */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {loading && !rows
          ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} className="h-[230px]" />)
          : pageRows.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[14px_15px] shadow-[var(--shadow)]">
                <div className="flex items-center gap-[11px]">
                  <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">{r.name}</div>
                    <div className="text-[11.5px] text-[var(--subtle)]">
                      {r.role === "head" ? "Course Head" : "Teaching Assistant"} · {tenureLabel(r.tenureMonths)}
                    </div>
                  </div>
                  {savingId === r.id && <Spinner size={13} className="flex-none text-[var(--subtle)]" />}
                  <span
                    className="inline-flex flex-none items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11px] font-semibold"
                    style={r.role === "head" ? { background: "var(--infos)", color: "var(--info)" } : { background: "var(--brands)", color: "var(--brand)" }}
                  >
                    {r.role === "head" ? "Head" : "Assistant"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-[8px]">
                  <div className="min-w-[130px] flex-1">
                    <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Calc method</div>
                    <div className="flex h-9 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
                      <select
                        value={r.calcMethod}
                        onChange={(e) => patchRow(r.id, { calcMethod: e.target.value as CalcMethod }, { calcMethod: e.target.value as CalcMethod })}
                        className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                      >
                        {METHOD_OPTS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="min-w-[130px] flex-1">
                    <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Payment method</div>
                    <div className="flex h-9 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
                      <select
                        value={r.payMethod}
                        onChange={(e) => patchRow(r.id, { payMethod: e.target.value }, { payMethod: e.target.value })}
                        className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                      >
                        {PAY_OPTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-[8px]">
                  {r.calcMethod === "fixed" && (
                    <div className="min-w-[120px] flex-1">
                      <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Fixed salary</div>
                      <div className="flex h-9 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
                        <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                        <input
                          defaultValue={r.fixedSalary ?? ""}
                          onBlur={(e) => {
                            const v = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                            patchRow(r.id, { fixedSalary: v }, { fixedSalary: v });
                          }}
                          inputMode="numeric"
                          className="h-full w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--text)] outline-none"
                        />
                      </div>
                    </div>
                  )}
                  <div className="min-w-[120px] flex-1">
                    <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Bonus %</div>
                    <div className="flex h-9 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
                      <input
                        defaultValue={r.bonusPct}
                        onBlur={(e) => {
                          const v = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                          patchRow(r.id, { bonusPct: v }, { bonusPct: v });
                        }}
                        inputMode="numeric"
                        className="h-full w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                      />
                      <span className="text-[12.5px] font-semibold text-[var(--subtle)]">%</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-[10px] rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[10px_12px]">
                  <div className="flex-1">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Last payment</div>
                    <div className="mt-[2px] font-mono text-[13.5px] font-bold text-[var(--text)]">{r.lastAmount != null ? fmt(r.lastAmount) : "—"}</div>
                    <div className="text-[11px] text-[var(--subtle)]">{r.lastDate ? new Date(r.lastDate).toLocaleDateString() : "No payments yet"}</div>
                  </div>
                  <div className="flex-1 border-l border-[var(--border)] pl-3">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Total since start</div>
                    <div className="mt-[2px] font-mono text-[13.5px] font-bold text-[var(--ok)]">{fmt(r.totalPaid)}</div>
                    <div className="text-[11px] text-[var(--subtle)]">{r.paymentsCount} payments</div>
                  </div>
                </div>
              </div>
            ))}
        {!loading && rows && pageRows.length === 0 && (
          <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)] lg:col-span-2">
            No staff match these filters.
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[11px_16px] shadow-[var(--shadow)]">
          <span className="text-[12.5px] text-[var(--subtle)]">
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} staff
          </span>
          <div className="flex items-center gap-[5px]">
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
    </div>
  );
}
