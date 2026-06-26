"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  listPayCategories,
  addPayCategory,
  updatePayCategory,
  deletePayCategory,
  addCategoryOption,
  updateCategoryOption,
  deleteCategoryOption,
  listCourseRates,
  setCourseRate,
  listBrackets,
  addBracket,
  updateBracket,
  deleteBracket,
  listOtherRates,
  updateOtherRate,
  type PayCategory,
  type CategoryMode,
  type CourseRate,
  type Bracket,
  type OtherRate,
} from "@/lib/actions/pay-categories";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", EGP: "E£", AED: "د.إ" };
const MODE_DETAIL: Record<CategoryMode, string> = {
  number: "Head enters a number; multiplied by the rate below.",
  dropdown: "Head picks one finance-defined sub-option below.",
  fixed: "Fixed amount applied when the head selects this category.",
};

type CategoryDraft = { label: string; rate: string };
type OptionDraft = { label: string; amount: string };
type BracketDraft = { name: string; lo: string; hi: string; pay: string };

function CategoryGroup({
  title,
  icon,
  iconBg,
  iconFg,
  kind,
  cats,
  sym,
  busyId,
  addingId,
  categoryDrafts,
  optionDrafts,
  onAdd,
  onDraftCategory,
  onModeChange,
  onDelete,
  onAddOption,
  onDraftOption,
  onDeleteOption,
}: {
  title: string;
  icon: "trend" | "minus";
  iconBg: string;
  iconFg: string;
  kind: "extra" | "deduction";
  cats: PayCategory[];
  sym: string;
  busyId: string | null;
  addingId: string | null;
  categoryDrafts: Record<string, CategoryDraft>;
  optionDrafts: Record<string, OptionDraft>;
  onAdd: () => void;
  onDraftCategory: (id: string, patch: Partial<CategoryDraft>) => void;
  onModeChange: (id: string, mode: CategoryMode) => void;
  onDelete: (id: string) => void;
  onAddOption: (categoryId: string) => void;
  onDraftOption: (id: string, patch: Partial<OptionDraft>) => void;
  onDeleteOption: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
      <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_16px]">
        <div className="flex items-center gap-[9px]">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px]" style={{ background: iconBg, color: iconFg }}>
            <Icon name={icon} size={16} />
          </div>
          <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">{title}</h3>
        </div>
        <button
          onClick={onAdd}
          disabled={addingId === kind}
          className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
        >
          {addingId === kind ? <Spinner size={13} /> : <Icon name="plus" size={14} />}
          Add
        </button>
      </header>
      <div className="p-2">
        {cats.length === 0 && <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No categories yet.</div>}
        {cats.map((c) => {
          const draft = categoryDrafts[c.id] ?? { label: c.label, rate: String(c.rate ?? 0) };
          return (
            <div key={c.id} className="m-1 rounded-[10px] border border-[var(--border2)] p-[11px]">
              <div className="flex items-center gap-[10px]">
                <input
                  value={draft.label}
                  onChange={(e) => onDraftCategory(c.id, { label: e.target.value })}
                  className="flex-1 border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
                />
                <div className="flex h-8 items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                  <select
                    value={c.mode}
                    onChange={(e) => onModeChange(c.id, e.target.value as CategoryMode)}
                    className="cursor-pointer appearance-none border-none bg-transparent text-[11.5px] font-semibold text-[var(--text)] outline-none"
                  >
                    <option value="number">Number × rate</option>
                    <option value="dropdown">Sub-options</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                {busyId === c.id && <Spinner size={13} className="text-[var(--subtle)]" />}
                <button
                  onClick={() => onDelete(c.id)}
                  disabled={busyId === c.id}
                  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
              <div className="mt-[7px] text-[12px] leading-[1.5] text-[var(--muted)]">{MODE_DETAIL[c.mode]}</div>

              {(c.mode === "number" || c.mode === "fixed") && (
                <div className="mt-[9px] flex items-center gap-[9px] border-t border-dashed border-[var(--border)] pt-[9px]">
                  <span className="text-[11.5px] font-semibold text-[var(--muted)]">{c.mode === "number" ? "Per-1 rate" : "Fixed amount"}</span>
                  <div className="ml-auto flex h-8 w-[84px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                    <span className="text-[12px] font-semibold text-[var(--subtle)]">{sym}</span>
                    <input
                      value={draft.rate}
                      onChange={(e) => onDraftCategory(c.id, { rate: e.target.value.replace(/[^0-9]/g, "") })}
                      inputMode="numeric"
                      className="w-full border-none bg-transparent font-mono text-[12.5px] font-bold text-[var(--text)] outline-none"
                    />
                  </div>
                </div>
              )}

              {c.mode === "dropdown" && (
                <div className="mt-[9px] border-t border-dashed border-[var(--border)] pt-[9px]">
                  <div className="mb-[6px] flex items-center justify-between">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Sub-options the head picks</span>
                    <button
                      onClick={() => onAddOption(c.id)}
                      disabled={addingId === c.id}
                      className="flex items-center gap-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[9px] py-1 text-[11px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
                    >
                      {addingId === c.id ? <Spinner size={11} /> : <Icon name="plus" size={12} />}
                      Add option
                    </button>
                  </div>
                  <div className="flex flex-col gap-[6px]">
                    {c.options.map((o) => {
                      const oDraft = optionDrafts[o.id] ?? { label: o.label, amount: String(o.amount) };
                      return (
                        <div key={o.id} className="flex items-center gap-[7px]">
                          <input
                            value={oDraft.label}
                            onChange={(e) => onDraftOption(o.id, { label: e.target.value })}
                            placeholder="Option name"
                            className="h-8 min-w-0 flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                          />
                          <div className="flex h-8 w-20 flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-2">
                            <span className="text-[11.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                            <input
                              value={oDraft.amount}
                              onChange={(e) => onDraftOption(o.id, { amount: e.target.value.replace(/[^0-9]/g, "") })}
                              inputMode="numeric"
                              className="w-full border-none bg-transparent font-mono text-[12px] font-bold text-[var(--text)] outline-none"
                            />
                          </div>
                          <button
                            onClick={() => onDeleteOption(o.id)}
                            disabled={busyId === o.id}
                            className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                          >
                            {busyId === o.id ? <Spinner size={12} /> : <Icon name="x" size={13} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PayCategoriesContent() {
  const [categories, setCategories] = useState<PayCategory[] | null>(null);
  const [courseRates, setCourseRates] = useState<CourseRate[] | null>(null);
  const [brackets, setBrackets] = useState<Bracket[] | null>(null);
  const [otherRates, setOtherRates] = useState<OtherRate[] | null>(null);
  const [currency, setCurrency] = useState("GBP");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [courseScope, setCourseScope] = useState<string[]>([]);
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Drafts hold in-progress edits; nothing here is persisted until "Save changes".
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [optionDrafts, setOptionDrafts] = useState<Record<string, OptionDraft>>({});
  const [courseRateDrafts, setCourseRateDrafts] = useState<Record<string, string>>({});
  const [bracketDrafts, setBracketDrafts] = useState<Record<string, BracketDraft>>({});
  const [otherRateDrafts, setOtherRateDrafts] = useState<Record<string, string>>({});

  async function reload() {
    setLoading(true);
    try {
      const [cats, rates, brks, others, settings] = await Promise.all([
        listPayCategories(),
        listCourseRates(),
        listBrackets(),
        listOtherRates(),
        getPayrollSettings(),
      ]);
      setCategories(cats);
      setCourseRates(rates);
      setBrackets(brks);
      setOtherRates(others);
      if (settings) setCurrency(settings.currency);
      setCategoryDrafts({});
      setOptionDrafts({});
      setCourseRateDrafts({});
      setBracketDrafts({});
      setOtherRateDrafts({});
    } catch {
      setError("Couldn't load pay categories.");
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

  const isDirty =
    Object.keys(categoryDrafts).length > 0 ||
    Object.keys(optionDrafts).length > 0 ||
    Object.keys(courseRateDrafts).length > 0 ||
    Object.keys(bracketDrafts).length > 0 ||
    Object.keys(otherRateDrafts).length > 0;

  async function withBusy(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    try {
      await fn();
    } catch {
      setError("Couldn't save this change — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function withAdding(id: string, fn: () => Promise<void>) {
    setAddingId(id);
    try {
      await fn();
    } catch {
      setError("Couldn't add this — try again.");
    } finally {
      setAddingId(null);
    }
  }

  async function onAddCategory(kind: "extra" | "deduction") {
    await withAdding(kind, async () => {
      await addPayCategory(kind, "New category");
      await reload();
    });
  }
  function onModeChange(id: string, mode: CategoryMode) {
    withBusy(id, async () => {
      await updatePayCategory(id, { mode });
      await reload();
    });
  }
  async function onDeleteCategory(id: string) {
    await withBusy(id, async () => {
      await deletePayCategory(id);
      await reload();
    });
  }
  async function onAddOption(categoryId: string) {
    await withAdding(categoryId, async () => {
      await addCategoryOption(categoryId);
      await reload();
    });
  }
  async function onDeleteOption(id: string) {
    await withBusy(id, async () => {
      await deleteCategoryOption(id);
      await reload();
    });
  }
  async function onAddBracket() {
    await withAdding("bracket", async () => {
      await addBracket();
      await reload();
    });
  }
  async function onDeleteBracket(id: string) {
    await withBusy(id, async () => {
      await deleteBracket(id);
      await reload();
    });
  }

  function draftCategory(id: string, patch: Partial<CategoryDraft>) {
    setCategoryDrafts((prev) => {
      const cat = categories?.find((c) => c.id === id);
      const base = prev[id] ?? { label: cat?.label ?? "", rate: String(cat?.rate ?? 0) };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }
  function draftOption(id: string, patch: Partial<OptionDraft>) {
    setOptionDrafts((prev) => {
      const opt = categories?.flatMap((c) => c.options).find((o) => o.id === id);
      const base = prev[id] ?? { label: opt?.label ?? "", amount: String(opt?.amount ?? 0) };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }
  function draftCourseRate(offeringId: string, value: string) {
    setCourseRateDrafts((prev) => ({ ...prev, [offeringId]: value }));
  }
  function draftBracket(id: string, patch: Partial<BracketDraft>) {
    setBracketDrafts((prev) => {
      const b = brackets?.find((x) => x.id === id);
      const base = prev[id] ?? { name: b?.name ?? "", lo: String(b?.lo ?? 0), hi: String(b?.hi ?? 0), pay: String(b?.pay ?? 0) };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }
  function draftOtherRate(id: string, value: string) {
    setOtherRateDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function onSaveAll() {
    setSaving(true);
    try {
      await Promise.all([
        ...Object.entries(categoryDrafts).map(([id, d]) => updatePayCategory(id, { label: d.label, rate: Number(d.rate) || 0 })),
        ...Object.entries(optionDrafts).map(([id, d]) => updateCategoryOption(id, { label: d.label, amount: Number(d.amount) || 0 })),
        ...Object.entries(courseRateDrafts).map(([offeringId, v]) => setCourseRate(offeringId, Number(v) || 0)),
        ...Object.entries(bracketDrafts).map(([id, d]) =>
          updateBracket(id, { name: d.name, lo: Number(d.lo) || 0, hi: Number(d.hi) || 0, pay: Number(d.pay) || 0 })
        ),
        ...Object.entries(otherRateDrafts).map(([id, v]) => updateOtherRate(id, Number(v) || 0)),
      ]);
      await reload();
    } catch {
      setError("Couldn't save your changes — try again.");
    } finally {
      setSaving(false);
    }
  }

  const extraCats = categories?.filter((c) => c.kind === "extra") ?? [];
  const dedCats = categories?.filter((c) => c.kind === "deduction") ?? [];

  function toggleScope(offeringId: string) {
    setCourseScope((prev) => (prev.includes(offeringId) ? prev.filter((x) => x !== offeringId) : [...prev, offeringId]));
  }

  const visibleCourseRates = courseScope.length ? (courseRates ?? []).filter((c) => courseScope.includes(c.offeringId)) : courseRates ?? [];
  const scopeLabel =
    courseScope.length === 0
      ? "All courses"
      : courseScope.length === 1
        ? courseRates?.find((c) => c.offeringId === courseScope[0])?.label ?? "1 course selected"
        : `${courseScope.length} courses selected`;

  return (
    <div className="flex flex-col gap-4 pb-[70px]">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Finance</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Pay categories &amp; rates</h1>
        <p className="m-0 mt-[3px] max-w-[560px] text-[13px] leading-[1.5] text-[var(--muted)]">
          Define the extra-work and deduction categories Heads choose from in evaluations, plus per-course and bracket pay rates.
          Adding/removing items happens instantly; edited values are saved with the button below once you&apos;re ready.
        </p>
        <div className="mt-[14px] flex flex-wrap items-center gap-[9px]">
          <span className="text-[12.5px] font-semibold text-[var(--muted)]">Per-paper rates apply to</span>
          <div className="relative min-w-[240px]">
            <button
              onClick={() => setScopeMenuOpen((p) => !p)}
              className="flex h-10 w-full items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3"
            >
              <Icon name="book" size={15} className="flex-none text-[var(--subtle)]" />
              <span className={`flex-1 truncate text-left text-[13px] font-semibold ${courseScope.length ? "text-[var(--text)]" : "text-[var(--subtle)]"}`}>
                {scopeLabel}
              </span>
              <Icon name="chevron-down" size={14} className="flex-none text-[var(--subtle)]" style={{ transform: scopeMenuOpen ? "rotate(180deg)" : "none" }} />
            </button>
            {scopeMenuOpen && (
              <div className="absolute left-0 right-0 top-[46px] z-20 max-h-[240px] overflow-y-auto rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] p-[6px] shadow-[0_12px_36px_rgba(8,12,22,.18)]">
                {(courseRates ?? []).map((c) => {
                  const sel = courseScope.includes(c.offeringId);
                  return (
                    <button
                      key={c.offeringId}
                      onClick={() => toggleScope(c.offeringId)}
                      className="flex w-full items-center gap-[10px] rounded-[8px] p-[9px_10px] hover:bg-[var(--surface2)]"
                    >
                      <div
                        className="flex h-5 w-5 flex-none items-center justify-center rounded-[6px] border-[1.5px]"
                        style={{ borderColor: sel ? "var(--brand)" : "var(--border)", background: sel ? "var(--brand)" : "transparent", color: "var(--brandfg)" }}
                      >
                        {sel && <Icon name="check" size={13} />}
                      </div>
                      <span className="text-[13px] font-semibold text-[var(--text)]">{c.label}</span>
                    </button>
                  );
                })}
                {(courseRates ?? []).length === 0 && <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No courses yet.</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading && !categories ? (
        <>
          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
            <SkeletonRow className="h-[260px]" />
            <SkeletonRow className="h-[260px]" />
          </div>
          <SkeletonRow className="h-[140px]" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
            <CategoryGroup
              title="Extra work"
              icon="trend"
              iconBg="var(--oks)"
              iconFg="var(--ok)"
              kind="extra"
              cats={extraCats}
              sym={sym}
              busyId={busyId}
              addingId={addingId}
              categoryDrafts={categoryDrafts}
              optionDrafts={optionDrafts}
              onAdd={() => onAddCategory("extra")}
              onDraftCategory={draftCategory}
              onModeChange={onModeChange}
              onDelete={onDeleteCategory}
              onAddOption={onAddOption}
              onDraftOption={draftOption}
              onDeleteOption={onDeleteOption}
            />
            <CategoryGroup
              title="Deductions"
              icon="minus"
              iconBg="var(--dangers)"
              iconFg="var(--danger)"
              kind="deduction"
              cats={dedCats}
              sym={sym}
              busyId={busyId}
              addingId={addingId}
              categoryDrafts={categoryDrafts}
              optionDrafts={optionDrafts}
              onAdd={() => onAddCategory("deduction")}
              onDraftCategory={draftCategory}
              onModeChange={onModeChange}
              onDelete={onDeleteCategory}
              onAddOption={onAddOption}
              onDraftOption={draftOption}
              onDeleteOption={onDeleteOption}
            />
          </div>

          {/* PER-PAPER RATE BY COURSE */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Per-paper rate by course</h3>
            </header>
            <div className="grid grid-cols-1 gap-[10px] p-[10px] sm:grid-cols-2">
              {visibleCourseRates.map((c) => (
                <div key={c.offeringId} className="flex items-center gap-[10px] rounded-[9px] border border-[var(--border2)] p-[10px_12px]">
                  <span className="flex-1 text-[13px] font-semibold text-[var(--text)]">{c.label}</span>
                  <span className="text-[11.5px] text-[var(--subtle)]">per paper</span>
                  <div className="flex h-[34px] w-[88px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                    <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                    <input
                      value={courseRateDrafts[c.offeringId] ?? String(c.rate)}
                      onChange={(e) => draftCourseRate(c.offeringId, e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                    />
                  </div>
                </div>
              ))}
              {visibleCourseRates.length === 0 && <div className="p-2 text-[12.5px] text-[var(--subtle)]">No courses match this filter.</div>}
            </div>
          </section>

          {/* BRACKETS */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Average-paper brackets</h3>
              <button
                onClick={onAddBracket}
                disabled={addingId === "bracket"}
                className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
              >
                {addingId === "bracket" ? <Spinner size={13} /> : <Icon name="plus" size={14} />}
                Add range
              </button>
            </header>
            <div className="p-2">
              {(brackets ?? []).map((b) => {
                const draft = bracketDrafts[b.id] ?? { name: b.name, lo: String(b.lo), hi: String(b.hi), pay: String(b.pay) };
                return (
                  <div key={b.id} className="flex flex-wrap items-center gap-[10px] rounded-[9px] p-[9px_11px] hover:bg-[var(--surface2)]">
                    <input
                      value={draft.name}
                      onChange={(e) => draftBracket(b.id, { name: e.target.value })}
                      className="w-20 flex-none border-none bg-transparent text-[13px] font-semibold text-[var(--text)] outline-none"
                    />
                    <div className="flex min-w-[150px] flex-1 items-center gap-[6px]">
                      <span className="text-[11.5px] text-[var(--subtle)]">papers</span>
                      <input
                        value={draft.lo}
                        onChange={(e) => draftBracket(b.id, { lo: e.target.value.replace(/[^0-9]/g, "") })}
                        inputMode="numeric"
                        className="h-8 w-14 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] text-center font-mono text-[12.5px] text-[var(--text)] outline-none"
                      />
                      <span className="text-[var(--subtle)]">–</span>
                      <input
                        value={draft.hi}
                        onChange={(e) => draftBracket(b.id, { hi: e.target.value.replace(/[^0-9]/g, "") })}
                        inputMode="numeric"
                        className="h-8 w-14 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] text-center font-mono text-[12.5px] text-[var(--text)] outline-none"
                      />
                    </div>
                    <div className="flex h-[34px] w-[100px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                      <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                      <input
                        value={draft.pay}
                        onChange={(e) => draftBracket(b.id, { pay: e.target.value.replace(/[^0-9]/g, "") })}
                        inputMode="numeric"
                        className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                      />
                    </div>
                    {busyId === b.id && <Spinner size={13} className="text-[var(--subtle)]" />}
                    <button
                      onClick={() => onDeleteBracket(b.id)}
                      disabled={busyId === b.id}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                );
              })}
              {(brackets ?? []).length === 0 && <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No brackets yet.</div>}
            </div>
          </section>

          {/* OTHER RATES */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Other rates</h3>
            </header>
            <div className="grid grid-cols-1 gap-[10px] p-[10px] sm:grid-cols-2">
              {(otherRates ?? []).map((o) => (
                <div key={o.id} className="flex items-center gap-[10px] rounded-[9px] border border-[var(--border2)] p-[10px_12px]">
                  <span className="flex-1 text-[13px] font-semibold text-[var(--text)]">{o.label}</span>
                  <span className="text-[11.5px] text-[var(--subtle)]">{o.unit}</span>
                  <div className="flex h-[34px] w-[88px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                    <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                    <input
                      value={otherRateDrafts[o.id] ?? String(o.rate)}
                      onChange={(e) => draftOtherRate(o.id, e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] p-[12px_18px] shadow-[0_-8px_24px_rgba(8,12,22,.12)]">
          <span className="text-[13px] font-medium text-[var(--muted)]">You have unsaved changes</span>
          <button
            onClick={onSaveAll}
            disabled={saving}
            className="flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[16px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            {saving ? <Spinner size={14} /> : <Icon name="check" size={14} />}
            Save changes
          </button>
        </div>
      )}
    </div>
  );
}
