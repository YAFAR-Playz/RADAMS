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
  getBracketSlots,
  addBracketSlot,
  saveBracketSlot,
  deleteBracketSlot,
  getOfficeHourOrgDefault,
  setOfficeHourOrgDefault,
  listOfficeHourRatesByOffering,
  setOfficeHourRateForOffering,
  clearOfficeHourRateOverride,
  listCategoryRatesByOffering,
  setCategoryRateForOffering,
  clearCategoryOverrideForOffering,
  listAssistantOfficeHoursDefaults,
  setAssistantOfficeHoursDefault,
  type PayCategory,
  type CategoryMode,
  type CourseRate,
  type BracketSlot,
  type OfficeHourOrgDefault,
  type OfficeHourCourseRate,
  type CategoryOfferingRate,
  type AssistantOfficeHoursDefault,
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
// lo/hi/pay are only present once the user actually types into that field —
// that's what lets a blank (differs-across-courses) slot stay untouched for
// any field the user didn't touch.
type BracketDraft = { lo?: string; hi?: string; pay?: string };

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
  const [bracketSlots, setBracketSlots] = useState<BracketSlot[] | null>(null);
  const [bracketsLoading, setBracketsLoading] = useState(false);
  const [officeHourOrgDefault, setOfficeHourOrgDefaultState] = useState<OfficeHourOrgDefault | null>(null);
  const [officeHourRates, setOfficeHourRates] = useState<OfficeHourCourseRate[] | null>(null);
  const [categoryRates, setCategoryRates] = useState<CategoryOfferingRate[] | null>(null);
  const [officeHoursDefaults, setOfficeHoursDefaults] = useState<Record<string, AssistantOfficeHoursDefault[]>>({});
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
  const [courseFixedSalaryDrafts, setCourseFixedSalaryDrafts] = useState<Record<string, string>>({});
  const [courseMockExamRateDrafts, setCourseMockExamRateDrafts] = useState<Record<string, string>>({});
  const [mockExamEnabled, setMockExamEnabled] = useState(false);
  const [bracketDrafts, setBracketDrafts] = useState<Record<string, BracketDraft>>({});
  const [officeHourOrgDefaultDraft, setOfficeHourOrgDefaultDraft] = useState<string | null>(null);
  const [officeHourRateDrafts, setOfficeHourRateDrafts] = useState<Record<string, string>>({});
  // Category rate/option keys are `${categoryId}::${offeringId}` and
  // `${categoryId}::${offeringId}::${optionLabel}` respectively.
  const [categoryRateDrafts, setCategoryRateDrafts] = useState<Record<string, string>>({});
  const [categoryOptionDrafts, setCategoryOptionDrafts] = useState<Record<string, string>>({});
  // Office-hours defaults keys are `${offeringId}::${assistantId}`.
  const [officeHoursDefaultDrafts, setOfficeHoursDefaultDrafts] = useState<Record<string, string>>({});

  async function refetchLists() {
    const [cats, rates, orgDefault, officeHours, settings] = await Promise.all([
      listPayCategories(),
      listCourseRates(),
      getOfficeHourOrgDefault(),
      listOfficeHourRatesByOffering(),
      getPayrollSettings(),
    ]);
    setCategories(cats);
    setCourseRates(rates);
    setOfficeHourOrgDefaultState(orgDefault);
    setOfficeHourRates(officeHours);
    if (settings) {
      setCurrency(settings.currency);
      setMockExamEnabled(settings.mockExamEnabled);
    }
  }

  async function refetchBrackets(scope: string[]) {
    setBracketsLoading(true);
    try {
      setBracketSlots(await getBracketSlots(scope));
    } catch {
      setError("Couldn't load brackets for these courses.");
    } finally {
      setBracketsLoading(false);
    }
  }

  async function refetchCategoryRates(scope: string[]) {
    setCategoryRates(scope.length ? await listCategoryRatesByOffering(scope) : []);
  }

  async function refetchOfficeHoursDefaults(scope: string[]) {
    if (!scope.length) {
      setOfficeHoursDefaults({});
      return;
    }
    const entries = await Promise.all(scope.map(async (id) => [id, await listAssistantOfficeHoursDefaults(id)] as const));
    setOfficeHoursDefaults(Object.fromEntries(entries));
  }

  // Used for the initial load and after a manual "Save changes" — clears
  // drafts since the server now matches what's on screen. Add/delete
  // actions use refetchLists()/refetchBrackets() directly so they don't
  // wipe unsaved edits elsewhere on the page.
  async function reload() {
    setLoading(true);
    try {
      await refetchLists();
      setCategoryDrafts({});
      setOptionDrafts({});
      setCourseRateDrafts({});
      setCourseFixedSalaryDrafts({});
      setBracketDrafts({});
      setOfficeHourOrgDefaultDraft(null);
      setOfficeHourRateDrafts({});
      setCategoryRateDrafts({});
      setCategoryOptionDrafts({});
      setOfficeHoursDefaultDrafts({});
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

  useEffect(() => {
    (async () => {
      await Promise.all([refetchBrackets(courseScope), refetchCategoryRates(courseScope), refetchOfficeHoursDefaults(courseScope)]);
      setBracketDrafts({});
      setCategoryRateDrafts({});
      setCategoryOptionDrafts({});
      setOfficeHoursDefaultDrafts({});
    })();
  }, [courseScope]);

  const sym = CURRENCY_SYMBOL[currency] ?? "£";

  const isDirty =
    Object.keys(categoryDrafts).length > 0 ||
    Object.keys(optionDrafts).length > 0 ||
    Object.keys(courseRateDrafts).length > 0 ||
    Object.keys(courseFixedSalaryDrafts).length > 0 ||
    Object.keys(courseMockExamRateDrafts).length > 0 ||
    Object.keys(bracketDrafts).length > 0 ||
    officeHourOrgDefaultDraft !== null ||
    Object.keys(officeHourRateDrafts).length > 0 ||
    Object.keys(categoryRateDrafts).length > 0 ||
    Object.keys(categoryOptionDrafts).length > 0 ||
    Object.keys(officeHoursDefaultDrafts).length > 0;

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
      await refetchLists();
    });
  }
  function onModeChange(id: string, mode: CategoryMode) {
    withBusy(id, async () => {
      await updatePayCategory(id, { mode });
      await refetchLists();
    });
  }
  async function onDeleteCategory(id: string) {
    await withBusy(id, async () => {
      await deletePayCategory(id);
      await refetchLists();
    });
  }
  async function onAddOption(categoryId: string) {
    await withAdding(categoryId, async () => {
      await addCategoryOption(categoryId);
      await refetchLists();
    });
  }
  async function onDeleteOption(id: string) {
    await withBusy(id, async () => {
      await deleteCategoryOption(id);
      await refetchLists();
    });
  }
  async function onAddBracket() {
    await withAdding("bracket", async () => {
      await addBracketSlot(courseScope);
      await refetchBrackets(courseScope);
    });
  }
  async function onDeleteBracket(name: string) {
    await withBusy(name, async () => {
      await deleteBracketSlot(courseScope, name);
      await refetchBrackets(courseScope);
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
  function draftCourseFixedSalary(offeringId: string, value: string) {
    setCourseFixedSalaryDrafts((prev) => ({ ...prev, [offeringId]: value }));
  }
  function draftCourseMockExamRate(offeringId: string, value: string) {
    setCourseMockExamRateDrafts((prev) => ({ ...prev, [offeringId]: value }));
  }
  function draftBracket(name: string, patch: Partial<BracketDraft>) {
    setBracketDrafts((prev) => ({ ...prev, [name]: { ...prev[name], ...patch } }));
  }
  function draftOfficeHourRate(offeringId: string, value: string) {
    setOfficeHourRateDrafts((prev) => ({ ...prev, [offeringId]: value }));
  }
  function draftOfficeHourOrgDefault(value: string) {
    setOfficeHourOrgDefaultDraft(value);
  }

  async function onClearOfficeHourOverride(offeringId: string) {
    setBusyId(offeringId);
    try {
      await clearOfficeHourRateOverride(offeringId);
      setOfficeHourRateDrafts((prev) => {
        const next = { ...prev };
        delete next[offeringId];
        return next;
      });
      await refetchLists();
    } catch {
      setError("Couldn't clear this override — try again.");
    } finally {
      setBusyId(null);
    }
  }

  function draftCategoryRate(categoryId: string, offeringId: string, value: string) {
    setCategoryRateDrafts((prev) => ({ ...prev, [`${categoryId}::${offeringId}`]: value }));
  }
  function draftCategoryOption(categoryId: string, offeringId: string, optionLabel: string, value: string) {
    setCategoryOptionDrafts((prev) => ({ ...prev, [`${categoryId}::${offeringId}::${optionLabel}`]: value }));
  }
  function draftOfficeHoursDefault(offeringId: string, assistantId: string, value: string) {
    setOfficeHoursDefaultDrafts((prev) => ({ ...prev, [`${offeringId}::${assistantId}`]: value }));
  }

  async function onClearCategoryOverride(categoryId: string, offeringId: string, kind: "extra" | "deduction", label: string) {
    const key = `${categoryId}::${offeringId}`;
    setBusyId(key);
    try {
      await clearCategoryOverrideForOffering(offeringId, kind, label);
      setCategoryRateDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setCategoryOptionDrafts((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) if (k.startsWith(`${key}::`)) delete next[k];
        return next;
      });
      await refetchCategoryRates(courseScope);
    } catch {
      setError("Couldn't clear this override — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onSaveAll() {
    setSaving(true);
    try {
      await Promise.all([
        ...Object.entries(categoryDrafts).map(([id, d]) => updatePayCategory(id, { label: d.label, rate: Number(d.rate) || 0 })),
        ...Object.entries(optionDrafts).map(([id, d]) => updateCategoryOption(id, { label: d.label, amount: Number(d.amount) || 0 })),
        ...Array.from(
          new Set([...Object.keys(courseRateDrafts), ...Object.keys(courseFixedSalaryDrafts), ...Object.keys(courseMockExamRateDrafts)])
        ).map((offeringId) => {
          const current = courseRates?.find((c) => c.offeringId === offeringId);
          const rate = courseRateDrafts[offeringId] !== undefined ? Number(courseRateDrafts[offeringId]) || 0 : current?.rate ?? 0;
          const fixedSalary =
            courseFixedSalaryDrafts[offeringId] !== undefined ? Number(courseFixedSalaryDrafts[offeringId]) || 0 : current?.fixedSalary ?? 0;
          const mockExamRate =
            courseMockExamRateDrafts[offeringId] !== undefined
              ? Number(courseMockExamRateDrafts[offeringId]) || 0
              : (current?.mockExamRate ?? null);
          return setCourseRate(offeringId, rate, fixedSalary, mockExamRate);
        }),
        ...Object.entries(bracketDrafts).map(([name, d]) => {
          // Only fields the user actually typed into are included in the
          // patch — anything left blank stays untouched for every course.
          const patch: { lo?: number; hi?: number; pay?: number } = {};
          if (d.lo !== undefined) patch.lo = Number(d.lo) || 0;
          if (d.hi !== undefined) patch.hi = Number(d.hi) || 0;
          if (d.pay !== undefined) patch.pay = Number(d.pay) || 0;
          return saveBracketSlot(courseScope, name, patch);
        }),
        ...(officeHourOrgDefaultDraft !== null && officeHourOrgDefault
          ? [setOfficeHourOrgDefault(officeHourOrgDefault.id, Number(officeHourOrgDefaultDraft) || 0)]
          : []),
        ...Object.entries(officeHourRateDrafts).map(([offeringId, v]) => setOfficeHourRateForOffering(offeringId, Number(v) || 0)),
        ...Object.entries(categoryRateDrafts).map(([key, v]) => {
          const [categoryId, offeringId] = key.split("::");
          const row = categoryRates?.find((r) => r.categoryId === categoryId && r.offeringId === offeringId);
          if (!row) return Promise.resolve();
          return setCategoryRateForOffering(offeringId, row.kind, row.label, row.mode, Number(v) || 0, null);
        }),
        ...Array.from(new Set(Object.keys(categoryOptionDrafts).map((k) => k.split("::").slice(0, 2).join("::")))).map((key) => {
          const [categoryId, offeringId] = key.split("::");
          const row = categoryRates?.find((r) => r.categoryId === categoryId && r.offeringId === offeringId);
          if (!row) return Promise.resolve();
          // Sends the complete option set (defaults + edits) — the override
          // row's options are fully replaced on save, not merged field-by-field.
          const options = row.options.map((o) => ({
            label: o.label,
            amount: Number(categoryOptionDrafts[`${categoryId}::${offeringId}::${o.label}`] ?? o.amount) || 0,
          }));
          return setCategoryRateForOffering(offeringId, row.kind, row.label, row.mode, row.rate, options);
        }),
        ...Object.entries(officeHoursDefaultDrafts).map(([key, v]) => {
          const [offeringId, assistantId] = key.split("::");
          return setAssistantOfficeHoursDefault(offeringId, assistantId, v === "" ? null : Number(v) || 0);
        }),
      ]);
      await reload();
      await refetchBrackets(courseScope);
      await refetchCategoryRates(courseScope);
      await refetchOfficeHoursDefaults(courseScope);
    } catch {
      setError("Couldn't save your changes — try again.");
    } finally {
      setSaving(false);
    }
  }

  const extraCats = categories?.filter((c) => c.kind === "extra") ?? [];
  const dedCats = categories?.filter((c) => c.kind === "deduction") ?? [];

  // Groups the flat (course × category) rate list back into one card per
  // category, each listing its rows for the currently selected courses.
  const categoryRateGroups = (() => {
    const order: { categoryId: string; kind: "extra" | "deduction"; label: string; mode: CategoryMode; rows: CategoryOfferingRate[] }[] = [];
    const byId = new Map<string, (typeof order)[number]>();
    for (const r of categoryRates ?? []) {
      let g = byId.get(r.categoryId);
      if (!g) {
        g = { categoryId: r.categoryId, kind: r.kind, label: r.label, mode: r.mode, rows: [] };
        byId.set(r.categoryId, g);
        order.push(g);
      }
      g.rows.push(r);
    }
    return order;
  })();

  function toggleScope(offeringId: string) {
    setCourseScope((prev) => (prev.includes(offeringId) ? prev.filter((x) => x !== offeringId) : [...prev, offeringId]));
  }

  const visibleCourseRates = courseScope.length ? (courseRates ?? []).filter((c) => courseScope.includes(c.offeringId)) : [];
  const visibleOfficeHourRates = courseScope.length ? (officeHourRates ?? []).filter((c) => courseScope.includes(c.offeringId)) : [];
  const scopeLabel =
    courseScope.length === 0
      ? "Select course(s)…"
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
          <span className="text-[12.5px] font-semibold text-[var(--muted)]">Rates &amp; brackets apply to</span>
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

          {/* PER-PAPER RATE & FIXED SALARY BY COURSE — the fixed-salary field
              feeds the "Fixed + per paper" calc method (fixed base + this
              same per-paper rate × papers checked), set here per course. */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Per-paper rate & fixed salary by course</h3>
              <p className="m-0 mt-[2px] text-[12px] text-[var(--muted)]">
                The fixed salary is used by the &quot;Fixed + per paper&quot; calc method — a flat base plus this course&apos;s per-paper rate.
              </p>
            </header>
            {courseScope.length === 0 ? (
              <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">Select one or more courses above to set their rates.</div>
            ) : (
              <div className="grid grid-cols-1 gap-[10px] p-[10px] sm:grid-cols-2">
                {visibleCourseRates.map((c) => (
                  <div key={c.offeringId} className="flex flex-col gap-[8px] rounded-[9px] border border-[var(--border2)] p-[10px_12px]">
                    <span className="text-[13px] font-semibold text-[var(--text)]">{c.label}</span>
                    <div className="flex items-center gap-[10px]">
                      <span className="w-[80px] flex-none text-[11.5px] text-[var(--subtle)]">per paper</span>
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
                    <div className="flex items-center gap-[10px]">
                      <span className="w-[80px] flex-none text-[11.5px] text-[var(--subtle)]">fixed salary</span>
                      <div className="flex h-[34px] w-[88px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                        <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                        <input
                          value={courseFixedSalaryDrafts[c.offeringId] ?? String(c.fixedSalary)}
                          onChange={(e) => draftCourseFixedSalary(c.offeringId, e.target.value.replace(/[^0-9]/g, ""))}
                          inputMode="numeric"
                          className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--brand)] outline-none"
                        />
                      </div>
                    </div>
                    {mockExamEnabled && (
                      <div className="flex items-center gap-[10px]">
                        <span className="w-[80px] flex-none text-[11.5px] text-[var(--subtle)]">mock exam</span>
                        <div className="flex h-[34px] w-[88px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                          <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                          <input
                            value={courseMockExamRateDrafts[c.offeringId] ?? String(c.mockExamRate ?? "")}
                            onChange={(e) => draftCourseMockExamRate(c.offeringId, e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="—"
                            inputMode="numeric"
                            className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--info)] outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* OFFICE HOUR RATE BY COURSE — each course's own rate if Finance
              has set one, else the org-wide default edited right here. */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="flex flex-wrap items-center justify-between gap-[10px] border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Office hour rate by course</h3>
              {officeHourOrgDefault && (
                <div className="flex items-center gap-[8px]">
                  <span className="text-[11.5px] font-semibold text-[var(--muted)]">Org-wide default</span>
                  <div className="flex h-[30px] w-[80px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                    <span className="text-[12px] font-semibold text-[var(--subtle)]">{sym}</span>
                    <input
                      value={officeHourOrgDefaultDraft ?? String(officeHourOrgDefault.rate)}
                      onChange={(e) => draftOfficeHourOrgDefault(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      className="w-full border-none bg-transparent font-mono text-[12.5px] font-bold text-[var(--text)] outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-[var(--subtle)]">per hour</span>
                </div>
              )}
            </header>
            {courseScope.length === 0 ? (
              <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">Select one or more courses above to set their office-hour rate.</div>
            ) : (
              <div className="grid grid-cols-1 gap-[10px] p-[10px] sm:grid-cols-2">
                {visibleOfficeHourRates.map((c) => (
                  <div key={c.offeringId} className="flex items-center gap-[10px] rounded-[9px] border border-[var(--border2)] p-[10px_12px]">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{c.label}</span>
                      {!c.isOverride && <span className="text-[10.5px] text-[var(--subtle)]">Using org default</span>}
                    </div>
                    <span className="text-[11.5px] text-[var(--subtle)]">per hour</span>
                    <div className="flex h-[34px] w-[88px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                      <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                      <input
                        value={officeHourRateDrafts[c.offeringId] ?? String(c.rate)}
                        onChange={(e) => draftOfficeHourRate(c.offeringId, e.target.value.replace(/[^0-9]/g, ""))}
                        inputMode="numeric"
                        className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                      />
                    </div>
                    {c.isOverride && (
                      <button
                        onClick={() => onClearOfficeHourOverride(c.offeringId)}
                        disabled={busyId === c.offeringId}
                        title="Clear override — use org default instead"
                        className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                      >
                        {busyId === c.offeringId ? <Spinner size={12} /> : <Icon name="x" size={13} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* EXTRA WORK & DEDUCTION RATES BY COURSE — same shadowing pattern
              as office-hour rate: a course's own rate/options if Finance has
              set one, else the org-wide default from the cards above. */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Extra work &amp; deduction rates by course</h3>
              <p className="m-0 mt-1 text-[12px] text-[var(--muted)]">Override a category&apos;s rate/amounts for the selected course(s); leave alone to keep the org-wide default.</p>
            </header>
            {courseScope.length === 0 ? (
              <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">Select one or more courses above to set their extra-work/deduction rates.</div>
            ) : categoryRateGroups.length === 0 ? (
              <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No extra-work or deduction categories yet.</div>
            ) : (
              <div className="flex flex-col gap-[10px] p-[10px]">
                {categoryRateGroups.map((g) => (
                  <div key={g.categoryId} className="rounded-[9px] border border-[var(--border2)] p-[10px_12px]">
                    <div className="mb-[7px] flex items-center gap-[8px]">
                      <span
                        className="rounded-[5px] px-[7px] py-[2px] text-[10px] font-bold uppercase tracking-[0.04em]"
                        style={g.kind === "extra" ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--dangers)", color: "var(--danger)" }}
                      >
                        {g.kind === "extra" ? "Extra" : "Deduction"}
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--text)]">{g.label}</span>
                    </div>
                    <div className="flex flex-col gap-[8px]">
                      {g.rows.map((r) => (
                        <div key={r.offeringId} className="flex flex-wrap items-center gap-[10px] rounded-[8px] bg-[var(--surface2)] p-[8px_10px]">
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{r.offeringLabel}</span>
                            {!r.isOverride && <span className="text-[10.5px] text-[var(--subtle)]">Using org default</span>}
                          </div>
                          {r.mode === "dropdown" ? (
                            <div className="flex flex-wrap items-center gap-[8px]">
                              {r.options.map((o) => (
                                <div key={o.label} className="flex h-8 items-center gap-[6px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[8px]">
                                  <span className="text-[11px] text-[var(--subtle)]">{o.label}</span>
                                  <span className="text-[11px] font-semibold text-[var(--subtle)]">{sym}</span>
                                  <input
                                    value={categoryOptionDrafts[`${r.categoryId}::${r.offeringId}::${o.label}`] ?? String(o.amount)}
                                    onChange={(e) => draftCategoryOption(r.categoryId, r.offeringId, o.label, e.target.value.replace(/[^0-9]/g, ""))}
                                    inputMode="numeric"
                                    className="w-14 border-none bg-transparent font-mono text-[12px] font-bold text-[var(--ok)] outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex h-[32px] w-[84px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[9px]">
                              <span className="text-[12px] font-semibold text-[var(--subtle)]">{sym}</span>
                              <input
                                value={categoryRateDrafts[`${r.categoryId}::${r.offeringId}`] ?? String(r.rate ?? 0)}
                                onChange={(e) => draftCategoryRate(r.categoryId, r.offeringId, e.target.value.replace(/[^0-9]/g, ""))}
                                inputMode="numeric"
                                className="w-full border-none bg-transparent font-mono text-[12.5px] font-bold text-[var(--ok)] outline-none"
                              />
                            </div>
                          )}
                          {r.isOverride && (
                            <button
                              onClick={() => onClearCategoryOverride(r.categoryId, r.offeringId, r.kind, r.label)}
                              disabled={busyId === `${r.categoryId}::${r.offeringId}`}
                              title="Clear override — use org default instead"
                              className="flex h-[28px] w-[28px] flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                            >
                              {busyId === `${r.categoryId}::${r.offeringId}` ? <Spinner size={11} /> : <Icon name="x" size={12} />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* FIXED OFFICE HOURS PER ASSISTANT — a standing monthly figure per
              assistant on the selected course(s); generateSalariesForPeriod
              auto-creates that month's office-hours line from it, so Finance
              doesn't need to retype it every period. Blank = no fixed
              default, entered manually in Salaries as before. */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Fixed office hours per assistant</h3>
              <p className="m-0 mt-1 text-[12px] text-[var(--muted)]">Auto-applied to Salaries each month once set — still editable per period there.</p>
            </header>
            {courseScope.length === 0 ? (
              <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">Select one or more courses above to assign fixed office hours.</div>
            ) : (
              <div className="flex flex-col gap-[12px] p-[10px]">
                {courseScope.map((offeringId) => {
                  const course = (courseRates ?? []).find((c) => c.offeringId === offeringId);
                  const assistants = officeHoursDefaults[offeringId] ?? [];
                  return (
                    <div key={offeringId}>
                      <div className="mb-[6px] text-[11.5px] font-semibold text-[var(--muted)]">{course?.label ?? offeringId}</div>
                      {assistants.length === 0 ? (
                        <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No assistants on this course yet.</div>
                      ) : (
                        <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                          {assistants.map((a) => {
                            const key = `${offeringId}::${a.assistantId}`;
                            return (
                              <div key={a.assistantId} className="flex items-center gap-[10px] rounded-[9px] border border-[var(--border2)] p-[9px_11px]">
                                <span className="flex-1 truncate text-[13px] font-semibold text-[var(--text)]">{a.name}</span>
                                <span className="text-[11.5px] text-[var(--subtle)]">hrs/mo</span>
                                <input
                                  value={officeHoursDefaultDrafts[key] ?? (a.hours != null ? String(a.hours) : "")}
                                  placeholder="—"
                                  onChange={(e) => draftOfficeHoursDefault(offeringId, a.assistantId, e.target.value.replace(/[^0-9]/g, ""))}
                                  inputMode="numeric"
                                  className="h-8 w-16 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] text-center font-mono text-[12.5px] font-bold text-[var(--text)] outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* BRACKETS — per selected course(s). A field shows a value only if
              every selected course currently agrees on it; otherwise it's
              blank so saving it doesn't silently overwrite courses that
              intentionally differ. */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Average-paper brackets</h3>
              <button
                onClick={onAddBracket}
                disabled={addingId === "bracket" || courseScope.length === 0}
                className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
              >
                {addingId === "bracket" ? <Spinner size={13} /> : <Icon name="plus" size={14} />}
                Add range
              </button>
            </header>
            {courseScope.length === 0 ? (
              <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">Select one or more courses above to set their average-paper brackets.</div>
            ) : bracketsLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 2 }, (_, i) => (
                  <SkeletonRow key={i} className="h-[44px]" />
                ))}
              </div>
            ) : (
              <div className="p-2">
                {(bracketSlots ?? []).map((b) => {
                  const draft = bracketDrafts[b.name] ?? {};
                  const loVal = draft.lo ?? (b.lo != null ? String(b.lo) : "");
                  const hiVal = draft.hi ?? (b.hi != null ? String(b.hi) : "");
                  const payVal = draft.pay ?? (b.pay != null ? String(b.pay) : "");
                  return (
                    <div key={b.name} className="flex flex-wrap items-center gap-[10px] rounded-[9px] p-[9px_11px] hover:bg-[var(--surface2)]">
                      <span className="w-20 flex-none text-[13px] font-semibold text-[var(--text)]">{b.name}</span>
                      <div className="flex min-w-[150px] flex-1 items-center gap-[6px]">
                        <span className="text-[11.5px] text-[var(--subtle)]">papers</span>
                        <input
                          value={loVal}
                          placeholder={courseScope.length > 1 ? "Differs" : "0"}
                          onChange={(e) => draftBracket(b.name, { lo: e.target.value.replace(/[^0-9]/g, "") })}
                          inputMode="numeric"
                          className="h-8 w-14 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] text-center font-mono text-[12.5px] text-[var(--text)] outline-none placeholder:text-[10.5px] placeholder:font-sans"
                        />
                        <span className="text-[var(--subtle)]">–</span>
                        <input
                          value={hiVal}
                          placeholder={courseScope.length > 1 ? "Differs" : "0"}
                          onChange={(e) => draftBracket(b.name, { hi: e.target.value.replace(/[^0-9]/g, "") })}
                          inputMode="numeric"
                          className="h-8 w-14 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] text-center font-mono text-[12.5px] text-[var(--text)] outline-none placeholder:text-[10.5px] placeholder:font-sans"
                        />
                      </div>
                      <div className="flex h-[34px] w-[100px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                        <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                        <input
                          value={payVal}
                          placeholder={courseScope.length > 1 ? "Differs" : "0"}
                          onChange={(e) => draftBracket(b.name, { pay: e.target.value.replace(/[^0-9]/g, "") })}
                          inputMode="numeric"
                          className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none placeholder:text-[10.5px] placeholder:font-sans"
                        />
                      </div>
                      {busyId === b.name && <Spinner size={13} className="text-[var(--subtle)]" />}
                      <button
                        onClick={() => onDeleteBracket(b.name)}
                        disabled={busyId === b.name}
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  );
                })}
                {(bracketSlots ?? []).length === 0 && <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No brackets yet for these courses.</div>}
              </div>
            )}
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
