"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import {
  listPeriods,
  listSalariesForPeriod,
  updateSalaryLine,
  setPayeeStatus,
  generateSalariesForPeriod,
  setLineCalcMethod,
  uploadSalaryReceipt,
  getSalaryReceiptUrl,
  getAssistantDetailedExport,
  type AssistantSalary,
} from "@/lib/actions/finance-salaries";
import { downloadCsv } from "@/lib/csv-export";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", EGP: "E£", AED: "د.إ" };

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function FinanceSalariesContent() {
  const [periods, setPeriods] = useState<string[] | null>(null);
  const [period, setPeriod] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<AssistantSalary[] | null>(null);
  const [currency, setCurrency] = useState("GBP");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newPeriod, setNewPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<AssistantSalary | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  const [exportingFull, setExportingFull] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, settings] = await Promise.all([listPeriods(), getPayrollSettings()]);
      setPeriods(p);
      setPeriod(p[0] ?? null);
      if (settings) setCurrency(settings.currency);
    })();
  }, []);

  async function reload(p: string) {
    setLoading(true);
    try {
      setAssistants(await listSalariesForPeriod(p));
    } catch {
      setError("Couldn't load salaries for this period.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!period) {
        setAssistants([]);
        return;
      }
      await reload(period);
    })();
  }, [period]);

  const sym = CURRENCY_SYMBOL[currency] ?? "£";
  const fmt = (n: number) => `${n < 0 ? "−" : ""}${sym}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
  const subtotal = (l: { base: number; bonus: number; deduction: number }) => l.base + l.bonus - l.deduction;
  const total = (a: AssistantSalary) => a.lines.reduce((sum, l) => sum + subtotal(l), 0);

  async function onEditLine(id: string, patch: Parameters<typeof updateSalaryLine>[1]) {
    setBusyId(id);
    try {
      await updateSalaryLine(id, patch);
      if (period) await reload(period);
    } catch {
      setError("Couldn't save this change — try again.");
    } finally {
      setBusyId(null);
    }
  }

  function onExport() {
    if (!assistants) return;
    downloadCsv(
      `salaries-${period ?? "period"}`,
      ["Name", "Pay method", "Status", "Total"],
      assistants.map((a) => [a.name, a.payMethod, a.status, total(a)])
    );
  }

  async function onExportFullHistory() {
    setExportingFull(true);
    try {
      const { detail, summary } = await getAssistantDetailedExport();
      const detailHeaders = [
        "Assistant",
        "Email",
        "Phone",
        "Course",
        "Month",
        "Papers checked",
        "Pay method",
        "Calc method",
        "Base",
        "Bonus",
        "Bonus reason",
        "Deduction",
        "Deduction reason",
        "Total payout",
        "Status",
        "Evaluation rating",
        "Evaluation notes",
        "Evaluation extras",
        "Evaluation deductions",
      ];
      const detailRows = detail.map((r) => [
        r.assistantName,
        r.email ?? "",
        r.phone ?? "",
        r.offering,
        r.period,
        r.papersChecked,
        r.payMethod,
        r.calcMethod ?? "",
        r.base,
        r.bonus,
        r.bonusReason ?? "",
        r.deduction,
        r.deductionReason ?? "",
        r.totalPayout,
        r.status,
        r.evalRating ?? "",
        r.evalNotes ?? "",
        r.evalExtraTotal,
        r.evalDeductionTotal,
      ]);
      const summaryRows = [
        [],
        ["ASSISTANT SUMMARY (all courses, all months)"],
        ["Assistant", "Months active", "Total papers checked", "Avg papers/month", "Total base", "Total bonus", "Total deduction", "Total payout", "Total eval extras", "Total eval deductions", "Evaluations"],
        ...summary.map((s) => [
          s.assistantName,
          s.monthsActive,
          s.totalPapersChecked,
          s.avgPapersCheckedPerMonth,
          s.totalBase,
          s.totalBonus,
          s.totalDeduction,
          s.totalPayout,
          s.totalEvalExtra,
          s.totalEvalDeduction,
          s.evaluationCount,
        ]),
      ];
      downloadCsv("assistants-full-history", detailHeaders, [...detailRows, ...summaryRows]);
    } finally {
      setExportingFull(false);
    }
  }

  async function onGenerate() {
    if (!newPeriod) return;
    setGenerating(true);
    setError(null);
    try {
      await generateSalariesForPeriod(newPeriod);
      const p = await listPeriods();
      setPeriods(p);
      setPeriod(newPeriod);
      await reload(newPeriod);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate salaries for this period.");
    } finally {
      setGenerating(false);
    }
  }

  async function onChangeCalcMethod(lineId: string, method: "per_paper" | "bracket" | "manual") {
    setBusyId(lineId);
    try {
      await setLineCalcMethod(lineId, method);
      if (period) await reload(period);
    } catch {
      setError("Couldn't change the calc method — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onTogglePaid(a: AssistantSalary) {
    if (!period) return;
    if (a.status !== "paid") {
      setReceiptTarget(a);
      setReceiptFile(null);
      return;
    }
    setBusyId(a.payeeId);
    try {
      await setPayeeStatus(a.payeeId, period, "pending");
      await reload(period);
    } catch {
      setError("Couldn't update payment status — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmMarkPaid() {
    if (!period || !receiptTarget) return;
    setReceiptSaving(true);
    try {
      if (receiptFile) {
        const formData = new FormData();
        formData.set("file", receiptFile);
        await uploadSalaryReceipt(receiptTarget.payeeId, period, formData);
      }
      await setPayeeStatus(receiptTarget.payeeId, period, "paid");
      await reload(period);
      setReceiptTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't mark as paid — try again.");
    } finally {
      setReceiptSaving(false);
    }
  }

  async function onViewReceipt(payeeId: string) {
    if (!period) return;
    setViewingReceiptId(payeeId);
    try {
      const url = await getSalaryReceiptUrl(payeeId, period);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else setError("No receipt was attached for this period.");
    } catch {
      setError("Couldn't open the receipt — try again.");
    } finally {
      setViewingReceiptId(null);
    }
  }

  const totalPayroll = (assistants ?? []).reduce((sum, a) => sum + total(a), 0);
  const paidAmt = (assistants ?? []).filter((a) => a.status === "paid").reduce((sum, a) => sum + total(a), 0);
  const pendingCount = (assistants ?? []).filter((a) => a.status !== "paid").length;

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Finance</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Salary breakdown</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Edit per-course adjustments and release payments when ready.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {periods && periods.length > 0 && (
              <div className="flex h-10 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                <Icon name="cal-check" size={15} className="text-[var(--subtle)]" />
                <select
                  value={period ?? ""}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
                >
                  {periods.map((p) => (
                    <option key={p} value={p}>
                      {periodLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex h-10 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
              <input
                type="month"
                value={newPeriod}
                onChange={(e) => setNewPeriod(e.target.value)}
                className="border-none bg-transparent text-[13px] text-[var(--text)] outline-none"
              />
              <button
                onClick={onGenerate}
                disabled={generating || !newPeriod}
                className="flex items-center gap-[6px] rounded-[7px] bg-[var(--brand)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {generating ? <Spinner size={13} /> : <Icon name="trend" size={13} />}
                Generate
              </button>
            </div>
            <button
              onClick={onExport}
              disabled={!assistants || assistants.length === 0}
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              <Icon name="file-up" size={16} />
              Export CSV
            </button>
            <button
              onClick={onExportFullHistory}
              disabled={exportingFull}
              title="Every assistant's full salary, evaluation and papers-checked history across every course and month"
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              {exportingFull ? <Spinner size={15} /> : <Icon name="file-up" size={16} />}
              Export full history
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {loading || !assistants
            ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[58px]" />)
            : [
                { value: fmt(totalPayroll), label: "Total payroll", color: "var(--brand)" },
                { value: fmt(paidAmt), label: "Paid out", color: "var(--ok)" },
                { value: String(pendingCount), label: "Pending payment", color: "var(--warn)" },
              ].map((s) => (
                <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[12px_14px]">
                  <div className="font-mono text-[21px] font-bold leading-[1.1] tracking-[-0.02em]" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="mt-[2px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
                </div>
              ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <header className="flex items-center justify-between border-b border-[var(--border2)] p-[15px_18px]">
          <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">
            Assistant salaries {period ? `· ${periodLabel(period)}` : ""}
          </h3>
          <span className="text-[12px] text-[var(--subtle)]">Tap a row to edit adjustments</span>
        </header>
        <div className="flex items-start gap-[10px] border-b border-[var(--border2)] bg-[var(--infos)] p-[11px_18px]">
          <Icon name="trend" size={16} className="mt-[1px] flex-none text-[var(--info)]" />
          <span className="text-[12px] leading-[1.45] text-[var(--text)]">
            Amounts are editable before you release payment — bonus/deduction reasons show up on the assistant&apos;s own view too.
          </span>
        </div>

        {loading && !assistants ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonRow key={i} className="h-[60px]" />
            ))}
          </div>
        ) : !assistants || assistants.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No salary lines for this period yet.</div>
        ) : (
          assistants.map((a) => {
            const expanded = !!open[a.payeeId];
            const t = total(a);
            return (
              <div key={a.payeeId} className="border-b border-[var(--border2)] last:border-b-0">
                <div
                  onClick={() => setOpen((prev) => ({ ...prev, [a.payeeId]: !prev[a.payeeId] }))}
                  className="flex flex-wrap items-center gap-3 p-[14px_18px] cursor-pointer hover:bg-[var(--surface2)]"
                >
                  <div className="flex min-w-[160px] flex-1 items-center gap-[11px]">
                    <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                      {a.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[var(--text)]">{a.name}</div>
                      <div className="text-[12px] text-[var(--subtle)]">
                        {a.lines.length} {a.lines.length === 1 ? "course" : "courses"} · {a.payMethod}
                      </div>
                    </div>
                  </div>
                  <div className="flex-none font-mono text-[17px] font-bold text-[var(--text)]">{fmt(t)}</div>
                  <span
                    className="inline-flex flex-none items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                    style={a.status === "paid" ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--warns)", color: "var(--warn)" }}
                  >
                    <Icon name={a.status === "paid" ? "check2" : "clock"} size={12} />
                    {a.status === "paid" ? "Paid" : "Pending"}
                  </span>
                  {a.status === "paid" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewReceipt(a.payeeId);
                      }}
                      disabled={viewingReceiptId === a.payeeId}
                      title="View receipt"
                      className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-[7px] text-[12px] font-semibold text-[var(--muted)] disabled:opacity-60"
                    >
                      {viewingReceiptId === a.payeeId ? <Spinner size={13} /> : <Icon name="file-up" size={13} />}
                      Receipt
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePaid(a);
                    }}
                    disabled={busyId === a.payeeId}
                    className="flex flex-none items-center gap-[6px] rounded-[8px] border px-3 py-[7px] text-[12px] font-semibold disabled:opacity-60"
                    style={
                      a.status === "paid"
                        ? { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                        : { borderColor: "var(--ok)", background: "var(--ok)", color: "#fff" }
                    }
                  >
                    {busyId === a.payeeId ? <Spinner size={13} /> : <Icon name={a.status === "paid" ? "clock" : "check"} size={13} />}
                    {a.status === "paid" ? "Mark pending" : "Mark as paid"}
                  </button>
                  <Icon name="chevron-down" size={18} className="flex-none text-[var(--subtle)]" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
                </div>

                {expanded && (
                  <div className="border-t border-[var(--border2)] bg-[var(--surface2)]">
                    {a.lines.map((l) => (
                      <div key={l.id} className="border-b border-[var(--border2)] p-[11px_18px]">
                        <div className="flex flex-wrap items-center gap-[10px_12px]">
                          <span className="w-[148px] flex-none text-[12.5px] font-semibold text-[var(--text)]">{l.offering}</span>
                          <div className="flex h-7 flex-none items-center rounded-full bg-[var(--infos)] px-[9px]">
                            <select
                              value={l.calcMethod ?? "manual"}
                              onChange={(e) => onChangeCalcMethod(l.id, e.target.value as "per_paper" | "bracket" | "manual")}
                              disabled={!l.offeringId || busyId === l.id}
                              title={l.offeringId ? "Calc method" : "No course linked — manual only"}
                              className="cursor-pointer appearance-none border-none bg-transparent text-[11px] font-semibold text-[var(--info)] outline-none disabled:cursor-not-allowed"
                            >
                              <option value="per_paper">Per paper</option>
                              <option value="bracket">Bracket</option>
                              <option value="manual">Manual</option>
                            </select>
                          </div>
                          <span className="min-w-[120px] flex-1 text-[12.5px] text-[var(--muted)]">{l.basis}</span>
                          <div className="flex h-8 w-20 flex-none items-center gap-[1px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[7px]">
                            <span className="text-[11px] font-bold text-[var(--subtle)]">{sym}</span>
                            <input
                              defaultValue={l.base}
                              onBlur={(e) => onEditLine(l.id, { base: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                              inputMode="numeric"
                              className="w-full border-none bg-transparent text-right font-mono text-[12px] font-semibold text-[var(--text)] outline-none"
                            />
                          </div>
                          <div className="flex h-8 w-[78px] flex-none items-center gap-[1px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[7px]">
                            <span className="text-[11px] font-bold text-[var(--ok)]">+{sym}</span>
                            <input
                              defaultValue={l.bonus}
                              onBlur={(e) => onEditLine(l.id, { bonus: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                              inputMode="numeric"
                              className="w-full border-none bg-transparent text-right font-mono text-[12px] font-semibold text-[var(--ok)] outline-none"
                            />
                          </div>
                          <div className="flex h-8 w-[82px] flex-none items-center gap-[1px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[7px]">
                            <span className="text-[11px] font-bold text-[var(--danger)]">−{sym}</span>
                            <input
                              defaultValue={l.deduction}
                              onBlur={(e) => onEditLine(l.id, { deduction: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                              inputMode="numeric"
                              className="w-full border-none bg-transparent text-right font-mono text-[12px] font-semibold text-[var(--danger)] outline-none"
                            />
                          </div>
                          {busyId === l.id && <Spinner size={13} className="text-[var(--subtle)]" />}
                          <span className="w-20 flex-none text-right font-mono text-[12.5px] font-bold text-[var(--text)]">{fmt(subtotal(l))}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <input
                            defaultValue={l.bonusReason ?? ""}
                            onBlur={(e) => onEditLine(l.id, { bonusReason: e.target.value })}
                            placeholder="Reason for bonus…"
                            className="h-[34px] min-w-[200px] flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                          />
                          <input
                            defaultValue={l.deductionReason ?? ""}
                            onBlur={(e) => onEditLine(l.id, { deductionReason: e.target.value })}
                            placeholder="Reason for deduction…"
                            className="h-[34px] min-w-[200px] flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-[10px] p-[12px_18px]">
                      <span className="text-[12.5px] font-medium text-[var(--muted)]">Paid via {a.payMethod} · edits save to this period&apos;s payroll</span>
                      <div className="flex items-center gap-[10px]">
                        <span className="text-[12.5px] text-[var(--muted)]">Total</span>
                        <span className="font-mono text-[17px] font-bold text-[var(--text)]">{fmt(t)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {receiptTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex w-full max-w-[420px] flex-col rounded-[var(--rad)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-3 border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[var(--oks)] text-[var(--ok)]">
                <Icon name="check" size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Mark {receiptTarget.name} as paid?</h3>
                <div className="text-[12px] text-[var(--muted)]">Attaching a receipt is optional.</div>
              </div>
              <button onClick={() => setReceiptTarget(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[10px] p-[16px_18px]">
              <label className="mb-[2px] block text-[12.5px] font-semibold text-[var(--text)]">Receipt (PDF or photo, optional)</label>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                className="w-full text-[12.5px] text-[var(--muted)] file:mr-3 file:rounded-[7px] file:border file:border-[var(--border)] file:bg-[var(--surface2)] file:px-3 file:py-[6px] file:text-[12px] file:font-semibold file:text-[var(--text)]"
              />
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setReceiptTarget(null)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onConfirmMarkPaid}
                disabled={receiptSaving}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--ok)] text-[13.5px] font-semibold text-white disabled:opacity-60"
              >
                {receiptSaving ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                Mark as paid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
