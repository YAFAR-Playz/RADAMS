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
  setPayeeReleased,
  releaseAllForPeriod,
  generateSalariesForPeriod,
  setLineCalcMethod,
  uploadSalaryReceipt,
  getSalaryReceiptUrl,
  getAssistantDetailedExport,
  setAssistantOfficeHours,
  type AssistantSalary,
} from "@/lib/actions/finance-salaries";
import {
  getEvaluationForFinance,
  addFinanceEvaluationLine,
  updateFinanceEvaluationLine,
  deleteFinanceEvaluationLine,
  type FinanceEvaluation,
} from "@/lib/actions/evaluations";
import { listPayCategories, type PayCategory } from "@/lib/actions/pay-categories";
import { resolveCategoryDefs } from "@/lib/evaluation-categories";
import { downloadCsv } from "@/lib/csv-export";
import { consumeSearchHandoff } from "@/lib/search-handoff";
import { pickerOnlyDateProps } from "@/lib/date-input";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", EGP: "E£", AED: "د.إ" };

// Shows the actual evaluation_lines a head picked for this assistant/course/
// period — Finance previously only ever saw the aggregated totals — and
// lets Finance edit or add to them directly.
function EvaluationPanel({ payeeId, offeringId, period, sym }: { payeeId: string; offeringId: string; period: string; sym: string }) {
  const [evalData, setEvalData] = useState<FinanceEvaluation | null>(null);
  const [payCats, setPayCats] = useState<PayCategory[]>([]);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setEvalData(await getEvaluationForFinance(payeeId, offeringId, period));
  }

  useEffect(() => {
    getEvaluationForFinance(payeeId, offeringId, period).then(setEvalData);
    listPayCategories(offeringId).then(setPayCats);
  }, [payeeId, offeringId, period]);

  async function onAdd(kind: "extra" | "deduction") {
    setBusy(true);
    try {
      await addFinanceEvaluationLine(payeeId, offeringId, period, kind);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function onUpdate(lineId: string, patch: Parameters<typeof updateFinanceEvaluationLine>[2]) {
    setBusy(true);
    try {
      await updateFinanceEvaluationLine(lineId, offeringId, patch);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(lineId: string) {
    setBusy(true);
    try {
      await deleteFinanceEvaluationLine(lineId);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const extraCats = resolveCategoryDefs(payCats, "extra");
  const dedCats = resolveCategoryDefs(payCats, "deduction");

  if (evalData === null) {
    return (
      <div className="mt-2">
        <SkeletonRow className="h-[34px]" />
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-[10px_12px]">
      <div className="mb-[8px] flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
          Evaluation{evalData.headName ? ` by ${evalData.headName}` : ""}
        </span>
        {busy && <Spinner size={12} />}
      </div>
      {evalData.lines.length === 0 ? (
        <div className="mb-[8px] text-[12px] text-[var(--subtle)]">No evaluation lines yet.</div>
      ) : (
        <div className="mb-[8px] flex flex-col gap-[6px]">
          {evalData.lines.map((l) => {
            const cats = l.kind === "extra" ? extraCats : dedCats;
            const cfg = cats.find((c) => c.label === l.category) ?? cats[0];
            return (
              <div key={l.id} className="flex flex-col gap-[6px] rounded-[6px] bg-[var(--surface2)] p-[6px_8px]">
                <div className="flex flex-wrap items-center gap-[8px]">
                  <span
                    className="flex-none rounded-full px-[7px] py-[2px] text-[10.5px] font-bold"
                    style={l.kind === "extra" ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--dangers)", color: "var(--danger)" }}
                  >
                    {l.kind === "extra" ? "Extra" : "Deduction"}
                  </span>
                  <select
                    value={l.category}
                    onChange={(e) => onUpdate(l.id, { category: e.target.value })}
                    className="h-7 min-w-[130px] flex-1 cursor-pointer appearance-none rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] font-medium text-[var(--text)] outline-none"
                  >
                    {cats.map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {cfg.mode === "number" && (
                    <input
                      key={`qty-${l.id}-${l.qty}`}
                      defaultValue={l.qty}
                      onBlur={(e) => onUpdate(l.id, { qty: e.target.value.replace(/[^0-9]/g, "") })}
                      placeholder="0"
                      className="h-7 w-[50px] flex-none rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-center font-mono text-[12px] text-[var(--text)] outline-none"
                    />
                  )}
                  {cfg.mode === "dropdown" && (
                    <select
                      value={l.sub}
                      onChange={(e) => onUpdate(l.id, { sub: e.target.value })}
                      className="h-7 flex-none cursor-pointer appearance-none rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] font-semibold text-[var(--text)] outline-none"
                    >
                      {(cfg.subs ?? []).map((s) => (
                        <option key={s[0]} value={s[0]}>
                          {s[0]}
                        </option>
                      ))}
                    </select>
                  )}
                  {cfg.mode === "locked" && <span className="flex-none text-[11px] font-semibold text-[var(--subtle)]">Fixed</span>}
                  <span className="ml-auto flex-none font-mono text-[12.5px] font-bold text-[var(--text)]">
                    {sym}
                    {Math.round(l.amount).toLocaleString()}
                  </span>
                  <button
                    onClick={() => onDelete(l.id)}
                    className="flex h-6 w-6 flex-none items-center justify-center rounded-[5px] text-[var(--subtle)] hover:text-[var(--danger)]"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </div>
                <input
                  key={`note-${l.id}-${l.note}`}
                  defaultValue={l.note}
                  onBlur={(e) => onUpdate(l.id, { note: e.target.value })}
                  placeholder="Note from the head (e.g. what was actually extra)…"
                  className="h-7 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                />
              </div>
            );
          })}
        </div>
      )}
      <div className="flex gap-[7px]">
        <button
          onClick={() => onAdd("extra")}
          disabled={busy}
          className="flex items-center gap-[5px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-[9px] py-[5px] text-[11.5px] font-semibold text-[var(--ok)] hover:bg-[var(--oks)] disabled:opacity-60"
        >
          <Icon name="plus" size={11} />
          Extra
        </button>
        <button
          onClick={() => onAdd("deduction")}
          disabled={busy}
          className="flex items-center gap-[5px] rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-[9px] py-[5px] text-[11.5px] font-semibold text-[var(--danger)] hover:bg-[var(--dangers)] disabled:opacity-60"
        >
          <Icon name="plus" size={11} />
          Deduction
        </button>
      </div>
    </div>
  );
}

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
  const [openEval, setOpenEval] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  // Payroll runs in arrears — generating on Aug 1 releases July's pay — so
  // the picker defaults to last month, not the one still in progress. Still
  // fully editable if Finance genuinely wants a different month.
  const [newPeriod, setNewPeriod] = useState(() => {
    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  });
  const [generating, setGenerating] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<AssistantSalary | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);
  const [exportingFull, setExportingFull] = useState(false);
  const [search, setSearch] = useState("");
  const [officeHoursCourseByPayee, setOfficeHoursCourseByPayee] = useState<Record<string, string>>({});
  const [releasingAll, setReleasingAll] = useState(false);

  useEffect(() => {
    (() => {
      const handoff = consumeSearchHandoff();
      if (handoff) setSearch(handoff);
    })();
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
  // Distinct courses this assistant has a real (offeringId-bearing) line for
  // this period — office hours get billed against one of those courses,
  // since the rate can now vary by course.
  const assistantCourses = (a: AssistantSalary) => {
    const seen = new Map<string, string>();
    for (const l of a.lines) {
      if (l.offeringId && !seen.has(l.offeringId)) seen.set(l.offeringId, l.offering);
    }
    return Array.from(seen.entries()).map(([offeringId, label]) => ({ offeringId, label }));
  };
  const officeHoursOf = (a: AssistantSalary, offeringId: string) =>
    a.lines.find((l) => l.method === "Office hours" && l.officeHoursOfferingId === offeringId)?.officeHours ?? null;

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

  async function onSetOfficeHours(payeeId: string, offeringId: string, hours: number) {
    if (!period) return;
    setBusyId(payeeId);
    try {
      await setAssistantOfficeHours(payeeId, period, hours, offeringId);
      await reload(period);
    } catch {
      setError("Couldn't save office hours — try again.");
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

  async function onChangeCalcMethod(lineId: string, method: "per_paper" | "bracket" | "fixed_per_paper" | "manual") {
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

  // Deliberately one-directional, not a toggle — a button that flips back
  // to "unreleased" on a second click is a real footgun here: clicking an
  // already-released row again (e.g. because nothing visibly confirmed it
  // worked) silently hid that person's pay again. Unreleasing isn't
  // something anyone's asked for, so it's not exposed at all right now.
  async function onRelease(a: AssistantSalary) {
    if (!period || a.released) return;
    setBusyId(a.payeeId);
    try {
      await setPayeeReleased(a.payeeId, period, true);
      await reload(period);
    } catch {
      setError("Couldn't release this payee's pay — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onReleaseAll() {
    if (!period) return;
    setReleasingAll(true);
    setError(null);
    try {
      await releaseAllForPeriod(period);
      await reload(period);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't release this period's pay — try again.");
    } finally {
      setReleasingAll(false);
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
  const unreleasedCount = (assistants ?? []).filter((a) => !a.released).length;
  const q = search.trim().toLowerCase();
  const visibleAssistants = (assistants ?? []).filter(
    (a) => !q || a.name.toLowerCase().includes(q) || a.lines.some((l) => l.offering.toLowerCase().includes(q))
  );

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
                {...pickerOnlyDateProps}
                className="cursor-pointer border-none bg-transparent text-[13px] text-[var(--text)] outline-none"
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
              onClick={onReleaseAll}
              disabled={releasingAll || !period || unreleasedCount === 0}
              title="Make this period's breakdown visible to everyone in My Pay — separate from marking paid"
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              {releasingAll ? <Spinner size={14} /> : <Icon name="send" size={16} />}
              {unreleasedCount > 0 ? `Release all (${unreleasedCount})` : "All released"}
            </button>
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
            Staff salaries {period ? `· ${periodLabel(period)}` : ""}
          </h3>
          <span className="text-[12px] text-[var(--subtle)]">Tap a row to edit adjustments</span>
        </header>
        <div className="flex items-start gap-[10px] border-b border-[var(--border2)] bg-[var(--infos)] p-[11px_18px]">
          <Icon name="trend" size={16} className="mt-[1px] flex-none text-[var(--info)]" />
          <span className="text-[12px] leading-[1.45] text-[var(--text)]">
            Nobody sees anything in My Pay until you release it — edit freely, then hit Release (per person, or &quot;Release all&quot; above) when
            ready. Bonus/deduction reasons show up on their view too once released. Covers both assistants and heads. Someone appears if they have a
            checked paper due this month, a &quot;Fixed + per paper&quot; course (owed its fixed base regardless), or a head-logged bonus/deduction —
            someone missing usually just has none of those yet this period.
          </span>
        </div>
        <div className="flex items-center gap-2 border-b border-[var(--border2)] p-[11px_18px]">
          <div className="flex h-9 w-full max-w-[320px] items-center gap-[8px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[11px]">
            <Icon name="search" size={15} className="flex-none text-[var(--subtle)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assistant or course…"
              className="h-full w-full border-none bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--subtle)]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="flex-none text-[var(--subtle)]">
                <Icon name="x" size={13} />
              </button>
            )}
          </div>
        </div>

        {loading && !assistants ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonRow key={i} className="h-[60px]" />
            ))}
          </div>
        ) : !assistants || assistants.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No salary lines for this period yet.</div>
        ) : visibleAssistants.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No assistants match your search.</div>
        ) : (
          visibleAssistants.map((a) => {
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
                  {a.released ? (
                    <span
                      title="Visible to them in My Pay"
                      className="inline-flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-[7px] text-[12px] font-semibold text-[var(--muted)]"
                    >
                      <Icon name="eye" size={13} />
                      Released
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRelease(a);
                      }}
                      disabled={busyId === a.payeeId}
                      title="Not visible to them yet — click to release"
                      className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--brand)] bg-[var(--brand)] px-3 py-[7px] text-[12px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                    >
                      {busyId === a.payeeId ? <Spinner size={13} /> : <Icon name="send" size={13} />}
                      Release
                    </button>
                  )}
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
                          <div className="flex h-7 flex-none items-center gap-[4px] rounded-full bg-[var(--infos)] pl-[9px] pr-[4px]">
                            <select
                              value={l.calcMethod ?? "manual"}
                              onChange={(e) => onChangeCalcMethod(l.id, e.target.value as "per_paper" | "bracket" | "fixed_per_paper" | "manual")}
                              disabled={!l.offeringId || busyId === l.id}
                              title={l.offeringId ? "Calc method" : "No course linked — manual only"}
                              className="cursor-pointer appearance-none border-none bg-transparent text-[11px] font-semibold text-[var(--info)] outline-none disabled:cursor-not-allowed"
                            >
                              <option value="per_paper">Per paper</option>
                              <option value="bracket">Bracket</option>
                              <option value="fixed_per_paper">Fixed + per paper</option>
                              <option value="manual">Manual</option>
                            </select>
                            {l.offeringId && l.calcMethod !== "manual" && (
                              <button
                                onClick={() => onChangeCalcMethod(l.id, l.calcMethod ?? "bracket")}
                                disabled={busyId === l.id}
                                title="Recalculate from current rates/brackets"
                                className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[var(--info)] hover:bg-[rgba(0,0,0,0.06)] disabled:opacity-60"
                              >
                                <Icon name="clock" size={11} />
                              </button>
                            )}
                          </div>
                          <span className="min-w-[120px] flex-1 text-[12.5px] text-[var(--muted)]">{l.basis}</span>
                          <div className="flex h-8 w-20 flex-none items-center gap-[1px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[7px]">
                            <span className="text-[11px] font-bold text-[var(--subtle)]">{sym}</span>
                            <input
                              key={`base-${l.id}-${l.base}`}
                              defaultValue={l.base}
                              onBlur={(e) => onEditLine(l.id, { base: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                              inputMode="numeric"
                              className="w-full border-none bg-transparent text-right font-mono text-[12px] font-semibold text-[var(--text)] outline-none"
                            />
                          </div>
                          <div className="flex h-8 w-[78px] flex-none items-center gap-[1px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[7px]">
                            <span className="text-[11px] font-bold text-[var(--ok)]">+{sym}</span>
                            <input
                              key={`bonus-${l.id}-${l.bonus}`}
                              defaultValue={l.bonus}
                              onBlur={(e) => onEditLine(l.id, { bonus: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                              inputMode="numeric"
                              className="w-full border-none bg-transparent text-right font-mono text-[12px] font-semibold text-[var(--ok)] outline-none"
                            />
                          </div>
                          <div className="flex h-8 w-[82px] flex-none items-center gap-[1px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[7px]">
                            <span className="text-[11px] font-bold text-[var(--danger)]">−{sym}</span>
                            <input
                              key={`deduction-${l.id}-${l.deduction}`}
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
                            key={`bonus-reason-${l.id}-${l.bonusReason ?? ""}`}
                            defaultValue={l.bonusReason ?? ""}
                            onBlur={(e) => onEditLine(l.id, { bonusReason: e.target.value })}
                            placeholder="Reason for bonus…"
                            className="h-[34px] min-w-[200px] flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                          />
                          <input
                            key={`deduction-reason-${l.id}-${l.deductionReason ?? ""}`}
                            defaultValue={l.deductionReason ?? ""}
                            onBlur={(e) => onEditLine(l.id, { deductionReason: e.target.value })}
                            placeholder="Reason for deduction…"
                            className="h-[34px] min-w-[200px] flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                          />
                        </div>
                        {l.offeringId && (
                          <>
                            <button
                              onClick={() => setOpenEval((prev) => ({ ...prev, [l.id]: !prev[l.id] }))}
                              className="mt-2 flex items-center gap-[5px] text-[11.5px] font-semibold text-[var(--brand)] hover:underline"
                            >
                              <Icon name="chevron-down" size={12} style={{ transform: openEval[l.id] ? "rotate(180deg)" : "none" }} />
                              {openEval[l.id] ? "Hide evaluation" : "Evaluation choices"}
                            </button>
                            {openEval[l.id] && <EvaluationPanel payeeId={a.payeeId} offeringId={l.offeringId} period={period ?? ""} sym={sym} />}
                          </>
                        )}
                      </div>
                    ))}
                    {(() => {
                      const courses = assistantCourses(a);
                      if (!courses.length) return null;
                      const selectedOfferingId = officeHoursCourseByPayee[a.payeeId] ?? courses[0].offeringId;
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-[10px] border-b border-[var(--border2)] p-[10px_18px]">
                          <div className="flex min-w-0 items-center gap-[8px]">
                            <Icon name="clock" size={14} className="flex-none text-[var(--subtle)]" />
                            <span className="flex-none text-[12.5px] font-medium text-[var(--muted)]">Fixed office hours this month</span>
                            {courses.length > 1 && (
                              <select
                                value={selectedOfferingId}
                                onChange={(e) => setOfficeHoursCourseByPayee((prev) => ({ ...prev, [a.payeeId]: e.target.value }))}
                                className="min-w-0 max-w-[160px] cursor-pointer appearance-none truncate rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-[8px] py-[3px] text-[11.5px] font-semibold text-[var(--text)] outline-none"
                              >
                                {courses.map((c) => (
                                  <option key={c.offeringId} value={c.offeringId}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div className="flex h-8 items-center gap-[6px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[9px]">
                            <input
                              key={`office-hours-${a.payeeId}-${selectedOfferingId}-${officeHoursOf(a, selectedOfferingId) ?? 0}`}
                              type="number"
                              min={0}
                              defaultValue={officeHoursOf(a, selectedOfferingId) ?? 0}
                              onBlur={(e) => onSetOfficeHours(a.payeeId, selectedOfferingId, Math.max(0, Number(e.target.value) || 0))}
                              disabled={busyId === a.payeeId}
                              className="w-[54px] border-none bg-transparent text-right font-mono text-[12px] font-semibold text-[var(--text)] outline-none"
                            />
                            <span className="text-[11px] font-semibold text-[var(--subtle)]">hrs</span>
                          </div>
                          {busyId === a.payeeId && <Spinner size={13} className="text-[var(--subtle)]" />}
                        </div>
                      );
                    })()}
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
