"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import { listOfferingAssistants, type AssistantOption } from "@/lib/actions/head-assignments";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { listMyAssistants, getOrCreateEvaluation, saveEvaluation, countCheckedPapers, type EvalLine, type EvalRating } from "@/lib/actions/evaluations";
import { listPayCategories, type PayCategory } from "@/lib/actions/pay-categories";
import { resolveCategoryDefs, categoryAmount, type CategoryDef } from "@/lib/evaluation-categories";
import { toneColors } from "@/lib/tone";
import type { Tone } from "@/lib/roles";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", EGP: "E£", AED: "د.إ" };
// Same Green/Yellow/Red language as the student Traffic Light tracker —
// Outstanding/Exceeds read as on-track, Meets as a caution flag, Below as
// critical, so a head evaluating an assistant sees the same visual system
// they use when checking on their own students.
const RATINGS: { value: EvalRating; label: string; tone: Tone }[] = [
  { value: "outstanding", label: "Outstanding", tone: "ok" },
  { value: "exceeds", label: "Exceeds", tone: "ok" },
  { value: "meets", label: "Meets", tone: "warn" },
  { value: "below", label: "Below", tone: "danger" },
];

function toPeriod(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
// Defaults to the current calendar month — a Head evaluating an assistant
// on, say, Aug 30 almost always means August itself (it's essentially over
// and there's real performance to judge), not July. Payroll still runs in
// arrears (Finance won't generate August's pay until September), but that's
// a separate concern from when a Head can start logging what they saw —
// the period picker below lets them go back to a prior month too, e.g. to
// finish an evaluation they didn't get to before the month rolled over.
function currentPeriod() {
  return toPeriod(new Date());
}
// Current month plus the last few, for the picker — evaluations has no
// "periods that already have data" list to draw from the way My Pay/
// Salaries do (a fresh month has no evaluation yet by definition), so this
// is generated rather than fetched.
function recentPeriods(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => toPeriod(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}
function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function CategoryRow({
  line,
  cats,
  onChange,
  onRemove,
}: {
  line: EvalLine;
  cats: CategoryDef[];
  onChange: (patch: Partial<EvalLine>) => void;
  onRemove: () => void;
}) {
  const cfg = cats.find((c) => c.label === line.category) ?? cats[0];
  return (
    <div className="flex flex-wrap items-center gap-[10px] rounded-[9px] p-[9px_10px] hover:bg-[var(--surface2)]">
      <div className="min-w-[150px] flex-1">
        <div className="flex h-10 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[11px]">
          <select
            value={line.category}
            onChange={(e) => {
              const next = cats.find((c) => c.label === e.target.value) ?? cats[0];
              onChange({ category: next.label, qty: "", sub: next.subs?.[0]?.[0] ?? "" });
            }}
            className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13px] font-medium text-[var(--text)] outline-none"
          >
            {cats.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input
        value={line.note}
        onChange={(e) => onChange({ note: e.target.value })}
        placeholder="Note (optional)"
        className="h-10 min-w-[140px] flex-[1.4] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
      />
      {cfg.mode === "number" && (
        <div className="flex h-10 w-[150px] flex-none items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[11px]">
          <input
            value={line.qty}
            onChange={(e) => onChange({ qty: e.target.value.replace(/[^0-9]/g, "") })}
            placeholder="0"
            className="w-[46px] border-none bg-transparent text-center font-mono text-[13px] font-semibold text-[var(--text)] outline-none"
          />
          <span className="ml-[6px] text-[11.5px] font-medium text-[var(--subtle)]">count</span>
        </div>
      )}
      {cfg.mode === "dropdown" && (
        <div className="flex h-10 w-[150px] flex-none items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[11px]">
          <select
            value={line.sub}
            onChange={(e) => onChange({ sub: e.target.value })}
            className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
          >
            {(cfg.subs ?? []).map((s) => (
              <option key={s[0]} value={s[0]}>
                {s[0]}
              </option>
            ))}
          </select>
        </div>
      )}
      {cfg.mode === "locked" && (
        <span className="flex w-[150px] flex-none items-center gap-[5px] text-[11.5px] font-semibold text-[var(--subtle)]">
          <Icon name="shield" size={12} />
          Set by Finance
        </span>
      )}
      <button
        onClick={onRemove}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)]"
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

export function EvaluationsContent() {
  const [period, setPeriod] = useState(currentPeriod());
  const periodOptions = useMemo(() => recentPeriods(6), []);

  const [payCategories, setPayCategories] = useState<PayCategory[]>([]);
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<AssistantOption[] | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [salaryVisible, setSalaryVisible] = useState(false);
  const [currency, setCurrency] = useState("GBP");

  const [evalId, setEvalId] = useState<string | null>(null);
  const [baseAmount, setBaseAmount] = useState("0");
  const [extras, setExtras] = useState<EvalLine[]>([]);
  const [deductions, setDeductions] = useState<EvalLine[]>([]);
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<EvalRating | null>(null);
  const [status, setStatus] = useState<"draft" | "submitted">("draft");
  const [loading, setLoading] = useState(true);
  const [checkedPapers, setCheckedPapers] = useState<number | null>(null);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
    getPayrollSettings().then((s) => {
      if (s) {
        setSalaryVisible(s.salaryVisibleToHeads);
        setCurrency(s.currency);
      }
    });
  }, []);

  // Refetches whenever the selected course changes so a course-specific
  // rate override (set by Finance in Pay categories) applies here too.
  useEffect(() => {
    listPayCategories(offeringId).then(setPayCategories);
  }, [offeringId]);

  const extraCats = useMemo(() => resolveCategoryDefs(payCategories, "extra"), [payCategories]);
  const dedCats = useMemo(() => resolveCategoryDefs(payCategories, "deduction"), [payCategories]);
  const extraIsFallback = !payCategories.some((c) => c.kind === "extra");
  const dedIsFallback = !payCategories.some((c) => c.kind === "deduction");

  useEffect(() => {
    (async () => {
      if (!offeringId) {
        setAssistants([]);
        setAssistantId(null);
        return;
      }
      const [ast, mine] = await Promise.all([listOfferingAssistants(offeringId), listMyAssistants()]);
      const allowed = new Set(mine.map((a) => a.id));
      const scoped = ast.filter((a) => allowed.has(a.id));
      setAssistants(scoped);
      setAssistantId(scoped[0]?.id ?? null);
    })();
  }, [offeringId]);

  async function loadEvaluation() {
    if (!assistantId || !offeringId) return;
    setLoading(true);
    try {
      const [ev, papers] = await Promise.all([getOrCreateEvaluation(assistantId, offeringId, period), countCheckedPapers(assistantId, offeringId)]);
      setEvalId(ev.id);
      setBaseAmount(String(ev.baseAmount));
      setExtras(ev.lines.filter((l) => l.kind === "extra"));
      setDeductions(ev.lines.filter((l) => l.kind === "deduction"));
      setNotes(ev.notes);
      setRating(ev.rating);
      setStatus(ev.status);
      setCheckedPapers(papers);
    } catch {
      setError("Couldn't load this evaluation.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await loadEvaluation();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantId, offeringId, period]);

  function addLine(kind: "extra" | "deduction") {
    const cats = kind === "extra" ? extraCats : dedCats;
    const line: EvalLine = { id: `tmp-${Date.now()}`, kind, category: cats[0].label, note: "", qty: "", sub: cats[0].subs?.[0]?.[0] ?? "" };
    if (kind === "extra") setExtras((prev) => [...prev, line]);
    else setDeductions((prev) => [...prev, line]);
  }

  function updateLine(kind: "extra" | "deduction", id: string, patch: Partial<EvalLine>) {
    const setter = kind === "extra" ? setExtras : setDeductions;
    setter((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(kind: "extra" | "deduction", id: string) {
    const setter = kind === "extra" ? setExtras : setDeductions;
    setter((prev) => prev.filter((l) => l.id !== id));
  }

  const extraSum = useMemo(
    () => extras.reduce((sum, l) => sum + categoryAmount(extraCats.find((c) => c.label === l.category) ?? extraCats[0], l.qty, l.sub), 0),
    [extras, extraCats]
  );
  const dedSum = useMemo(
    () => deductions.reduce((sum, l) => sum + categoryAmount(dedCats.find((c) => c.label === l.category) ?? dedCats[0], l.qty, l.sub), 0),
    [deductions, dedCats]
  );
  const total = (Number(baseAmount) || 0) + extraSum - dedSum;
  const sym = CURRENCY_SYMBOL[currency] ?? "£";
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString("en-US")}`;

  async function onSubmit(next: "draft" | "submitted") {
    if (!assistantId || !offeringId) return;
    setSaving(next === "draft" ? "draft" : "submit");
    try {
      const { id } = await saveEvaluation({
        id: evalId,
        assistantId,
        offeringId,
        period,
        baseAmount: Number(baseAmount) || 0,
        notes,
        rating,
        status: next,
        lines: [...extras, ...deductions].map((l) => ({ kind: l.kind, category: l.category, note: l.note, qty: l.qty, sub: l.sub })),
      });
      setEvalId(id);
      setStatus(next);
    } catch {
      setError("Couldn't save this evaluation — try again.");
    } finally {
      setSaving(null);
    }
  }

  const offeringsLoading = offerings === null;
  const currentAssistant = assistants?.find((a) => a.id === assistantId) ?? null;

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Monthly evaluation</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              Evaluate assistant · {periodLabel(period)}
            </h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Adjustments use categories defined by the Finance team and feed into salary.</p>
          </div>
          <span
            className="inline-flex flex-none items-center gap-[6px] rounded-full px-[11px] py-[5px] text-[12px] font-semibold"
            style={status === "submitted" ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--warns)", color: "var(--warn)" }}
          >
            <Icon name={status === "submitted" ? "check2" : "clock"} size={13} />
            {status === "submitted" ? "Submitted to Finance" : "Draft · not submitted"}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-[6px] block text-[12.5px] font-semibold text-[var(--text)]">Month</label>
            <div className="flex h-[46px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
              >
                {periodOptions.map((p) => (
                  <option key={p} value={p}>
                    {periodLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-[6px] block text-[12.5px] font-semibold text-[var(--text)]">Assistant</label>
            {assistants === null ? (
              <SkeletonRow className="h-[46px] w-full" />
            ) : (
              <div className="flex h-[46px] items-center gap-[10px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                {currentAssistant && (
                  <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[11px] font-bold text-[var(--brand)]">
                    {currentAssistant.initials}
                  </div>
                )}
                <select
                  value={assistantId ?? ""}
                  onChange={(e) => setAssistantId(e.target.value)}
                  className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
                >
                  {assistants.length === 0 && <option value="">No assistants yet</option>}
                  {assistants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="mb-[6px] block text-[12.5px] font-semibold text-[var(--text)]">Course offering</label>
            {offeringsLoading ? (
              <SkeletonRow className="h-[46px] w-full" />
            ) : (
              <div className="flex h-[46px] items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                <select
                  value={offeringId ?? ""}
                  onChange={(e) => setOfferingId(e.target.value)}
                  className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {loading ? (
            <>
              <SkeletonRow className="h-[140px]" />
              <SkeletonRow className="h-[100px]" />
              <SkeletonRow className="h-[200px]" />
            </>
          ) : (
            <>
              {/* EXTRA WORK */}
              <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_18px]">
                  <div className="flex items-center gap-[9px]">
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[var(--oks)] text-[var(--ok)]">
                      <Icon name="trend" size={16} />
                    </div>
                    <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Extra work &amp; bonuses</h3>
                    {extraIsFallback && (
                      <span
                        title="Finance hasn't added any Extra work categories yet — showing built-in defaults."
                        className="inline-flex items-center gap-[4px] rounded-full bg-[var(--surface2)] px-[8px] py-[2px] text-[10.5px] font-semibold text-[var(--subtle)]"
                      >
                        <Icon name="shield" size={10} />
                        Default categories
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => addLine("extra")}
                    className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12.5px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]"
                  >
                    <Icon name="plus" size={14} />
                    Add
                  </button>
                </header>
                <div className="p-2">
                  {extras.length === 0 ? (
                    <div className="p-[14px] text-center text-[12.5px] text-[var(--subtle)]">No extra work added yet.</div>
                  ) : (
                    extras.map((l) => (
                      <CategoryRow
                        key={l.id}
                        line={l}
                        cats={extraCats}
                        onChange={(patch) => updateLine("extra", l.id, patch)}
                        onRemove={() => removeLine("extra", l.id)}
                      />
                    ))
                  )}
                </div>
              </section>

              {/* DEDUCTIONS */}
              <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_18px]">
                  <div className="flex items-center gap-[9px]">
                    <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[var(--dangers)] text-[var(--danger)]">
                      <Icon name="minus" size={16} />
                    </div>
                    <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Deductions</h3>
                    {dedIsFallback && (
                      <span
                        title="Finance hasn't added any Deduction categories yet — showing built-in defaults."
                        className="inline-flex items-center gap-[4px] rounded-full bg-[var(--surface2)] px-[8px] py-[2px] text-[10.5px] font-semibold text-[var(--subtle)]"
                      >
                        <Icon name="shield" size={10} />
                        Default categories
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => addLine("deduction")}
                    className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12.5px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]"
                  >
                    <Icon name="plus" size={14} />
                    Add
                  </button>
                </header>
                <div className="p-2">
                  {deductions.length === 0 ? (
                    <div className="p-[14px] text-center text-[12.5px] text-[var(--subtle)]">No deductions added.</div>
                  ) : (
                    deductions.map((l) => (
                      <CategoryRow
                        key={l.id}
                        line={l}
                        cats={dedCats}
                        onChange={(patch) => updateLine("deduction", l.id, patch)}
                        onRemove={() => removeLine("deduction", l.id)}
                      />
                    ))
                  )}
                </div>
              </section>

              {/* NOTES */}
              <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[16px_18px] shadow-[var(--shadow)]">
                <div className="mb-3 flex items-center gap-[9px]">
                  <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-[var(--brands)] text-[var(--brand)]">
                    <Icon name="clipboard-list" size={16} />
                  </div>
                  <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Evaluation notes</h3>
                </div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Summarize the assistant's performance this month — punctuality, quality of feedback, responsiveness…"
                  className="h-[120px] w-full resize-y rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-3 text-[13.5px] leading-[1.5] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
                <div className="mt-[13px]">
                  <label className="mb-2 block text-[12.5px] font-semibold text-[var(--text)]">Overall rating</label>
                  <div className="flex flex-wrap gap-2">
                    {RATINGS.map((r) => {
                      const active = rating === r.value;
                      const { bg, fg } = toneColors(r.tone);
                      return (
                        <button
                          key={r.value}
                          onClick={() => setRating(r.value)}
                          className="flex items-center gap-[7px] rounded-full border px-[13px] py-2 text-[12.5px] font-semibold"
                          style={active ? { borderColor: fg, background: bg, color: fg } : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }}
                        >
                          <span className="block h-[8px] w-[8px] flex-none rounded-full" style={{ background: active ? fg : "var(--border)" }} />
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* SUMMARY */}
        <aside className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[18px] shadow-[var(--shadow)] lg:sticky lg:top-[18px] lg:self-start">
          {salaryVisible && (
            <>
              <div className="mb-[14px] flex items-center justify-between gap-[10px]">
                <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Salary impact</h3>
                <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold text-[var(--subtle)]">
                  <Icon name="shield" size={12} />
                  Set by Finance
                </span>
              </div>
              <div className="flex flex-col gap-[11px]">
                {checkedPapers !== null && (
                  <div className="flex items-center justify-between rounded-[7px] bg-[var(--surface2)] px-[10px] py-[7px]">
                    <span className="text-[11.5px] text-[var(--subtle)]">Papers marked &quot;checked&quot; on salary-counted assignments</span>
                    <span className="font-mono text-[12.5px] font-bold text-[var(--text)]">{checkedPapers}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--muted)]">Base (per paper / bracket)</span>
                  <input
                    value={baseAmount}
                    onChange={(e) => setBaseAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-[90px] rounded-[6px] border border-[var(--border)] bg-[var(--surface2)] px-2 py-1 text-right font-mono text-[13px] font-semibold text-[var(--text)] outline-none focus:border-[var(--brand)]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--muted)]">Extra work</span>
                  <span className="font-mono text-[13px] font-semibold text-[var(--ok)]">+{fmt(extraSum)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[var(--muted)]">Deductions</span>
                  <span className="font-mono text-[13px] font-semibold text-[var(--danger)]">−{fmt(dedSum)}</span>
                </div>
                <div className="h-px bg-[var(--border2)]" />
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-[var(--text)]">Adjusted total</span>
                  <span className="font-mono text-[20px] font-bold tracking-[-0.01em] text-[var(--text)]">{fmt(total)}</span>
                </div>
              </div>
              <div className="my-4 h-px bg-[var(--border2)]" />
            </>
          )}
          <div className="flex flex-col gap-[9px]">
            <button
              onClick={() => onSubmit("submitted")}
              disabled={!assistantId || saving !== null}
              className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[14px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
            >
              {saving === "submit" ? <Spinner size={16} /> : <Icon name="check" size={16} />}
              Submit to Finance
            </button>
            <button
              onClick={() => onSubmit("draft")}
              disabled={!assistantId || saving !== null}
              className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              {saving === "draft" && <Spinner size={14} />}
              Save draft
            </button>
          </div>
          <p className="m-0 mt-[13px] text-[11.5px] leading-[1.5] text-[var(--subtle)]">
            Once submitted, Finance reviews adjustments before they&apos;re applied to the {periodLabel(period)} payroll.
          </p>
        </aside>
      </div>
    </div>
  );
}
