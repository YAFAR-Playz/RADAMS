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

function CategoryGroup({
  title,
  icon,
  iconBg,
  iconFg,
  cats,
  sym,
  busyId,
  onAdd,
  onPatch,
  onDelete,
  onAddOption,
  onPatchOption,
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
  onAdd: () => void;
  onPatch: (id: string, patch: Parameters<typeof updatePayCategory>[1]) => void;
  onDelete: (id: string) => void;
  onAddOption: (categoryId: string) => void;
  onPatchOption: (id: string, patch: Parameters<typeof updateCategoryOption>[1]) => void;
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
        <button onClick={onAdd} className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]">
          <Icon name="plus" size={14} />
          Add
        </button>
      </header>
      <div className="p-2">
        {cats.length === 0 && <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No categories yet.</div>}
        {cats.map((c) => (
          <div key={c.id} className="m-1 rounded-[10px] border border-[var(--border2)] p-[11px]">
            <div className="flex items-center gap-[10px]">
              <input
                defaultValue={c.label}
                onBlur={(e) => onPatch(c.id, { label: e.target.value })}
                className="flex-1 border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
              />
              <div className="flex h-8 items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                <select
                  value={c.mode}
                  onChange={(e) => onPatch(c.id, { mode: e.target.value as CategoryMode })}
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
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)]"
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
                    defaultValue={c.rate ?? 0}
                    onBlur={(e) => onPatch(c.id, { rate: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
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
                  <button onClick={() => onAddOption(c.id)} className="flex items-center gap-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[9px] py-1 text-[11px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]">
                    <Icon name="plus" size={12} />
                    Add option
                  </button>
                </div>
                <div className="flex flex-col gap-[6px]">
                  {c.options.map((o) => (
                    <div key={o.id} className="flex items-center gap-[7px]">
                      <input
                        defaultValue={o.label}
                        onBlur={(e) => onPatchOption(o.id, { label: e.target.value })}
                        placeholder="Option name"
                        className="h-8 min-w-0 flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                      />
                      <div className="flex h-8 w-20 flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-2">
                        <span className="text-[11.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                        <input
                          defaultValue={o.amount}
                          onBlur={(e) => onPatchOption(o.id, { amount: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                          inputMode="numeric"
                          className="w-full border-none bg-transparent font-mono text-[12px] font-bold text-[var(--text)] outline-none"
                        />
                      </div>
                      <button
                        onClick={() => onDeleteOption(o.id)}
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)]"
                      >
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
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

  async function onAddCategory(kind: "extra" | "deduction") {
    await withBusy("new", async () => {
      await addPayCategory(kind, "New category");
      await reload();
    });
  }
  async function onPatchCategory(id: string, patch: Parameters<typeof updatePayCategory>[1]) {
    await withBusy(id, async () => {
      await updatePayCategory(id, patch);
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
    await withBusy(categoryId, async () => {
      await addCategoryOption(categoryId);
      await reload();
    });
  }
  async function onPatchOption(id: string, patch: Parameters<typeof updateCategoryOption>[1]) {
    await withBusy(id, async () => {
      await updateCategoryOption(id, patch);
      await reload();
    });
  }
  async function onDeleteOption(id: string) {
    await withBusy(id, async () => {
      await deleteCategoryOption(id);
      await reload();
    });
  }
  async function onSetCourseRate(offeringId: string, rate: number) {
    await withBusy(offeringId, async () => {
      await setCourseRate(offeringId, rate);
      await reload();
    });
  }
  async function onAddBracket() {
    await withBusy("new-bracket", async () => {
      await addBracket();
      await reload();
    });
  }
  async function onPatchBracket(id: string, patch: Parameters<typeof updateBracket>[1]) {
    await withBusy(id, async () => {
      await updateBracket(id, patch);
      await reload();
    });
  }
  async function onDeleteBracket(id: string) {
    await withBusy(id, async () => {
      await deleteBracket(id);
      await reload();
    });
  }
  async function onPatchOtherRate(id: string, rate: number) {
    await withBusy(id, async () => {
      await updateOtherRate(id, rate);
      await reload();
    });
  }

  const extraCats = categories?.filter((c) => c.kind === "extra") ?? [];
  const dedCats = categories?.filter((c) => c.kind === "deduction") ?? [];

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
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Finance</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Pay categories &amp; rates</h1>
        <p className="m-0 mt-[3px] max-w-[560px] text-[13px] leading-[1.5] text-[var(--muted)]">
          Define the extra-work and deduction categories Heads choose from in evaluations, plus per-course and bracket pay rates.
        </p>
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
              onAdd={() => onAddCategory("extra")}
              onPatch={onPatchCategory}
              onDelete={onDeleteCategory}
              onAddOption={onAddOption}
              onPatchOption={onPatchOption}
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
              onAdd={() => onAddCategory("deduction")}
              onPatch={onPatchCategory}
              onDelete={onDeleteCategory}
              onAddOption={onAddOption}
              onPatchOption={onPatchOption}
              onDeleteOption={onDeleteOption}
            />
          </div>

          {/* PER-PAPER RATE BY COURSE */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Per-paper rate by course</h3>
            </header>
            <div className="grid grid-cols-1 gap-[10px] p-[10px] sm:grid-cols-2">
              {(courseRates ?? []).map((c) => (
                <div key={c.offeringId} className="flex items-center gap-[10px] rounded-[9px] border border-[var(--border2)] p-[10px_12px]">
                  <span className="flex-1 text-[13px] font-semibold text-[var(--text)]">{c.label}</span>
                  <span className="text-[11.5px] text-[var(--subtle)]">per paper</span>
                  <div className="flex h-[34px] w-[88px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                    <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                    <input
                      defaultValue={c.rate}
                      onBlur={(e) => onSetCourseRate(c.offeringId, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                      inputMode="numeric"
                      className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                    />
                  </div>
                  {busyId === c.offeringId && <Spinner size={13} className="text-[var(--subtle)]" />}
                </div>
              ))}
              {(courseRates ?? []).length === 0 && <div className="p-2 text-[12.5px] text-[var(--subtle)]">No courses yet.</div>}
            </div>
          </section>

          {/* BRACKETS */}
          <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_16px]">
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Average-paper brackets</h3>
              <button onClick={onAddBracket} className="flex items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[6px] text-[12px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]">
                <Icon name="plus" size={14} />
                Add range
              </button>
            </header>
            <div className="p-2">
              {(brackets ?? []).map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-[10px] rounded-[9px] p-[9px_11px] hover:bg-[var(--surface2)]">
                  <input
                    defaultValue={b.name}
                    onBlur={(e) => onPatchBracket(b.id, { name: e.target.value })}
                    className="w-20 flex-none border-none bg-transparent text-[13px] font-semibold text-[var(--text)] outline-none"
                  />
                  <div className="flex min-w-[150px] flex-1 items-center gap-[6px]">
                    <span className="text-[11.5px] text-[var(--subtle)]">papers</span>
                    <input
                      defaultValue={b.lo}
                      onBlur={(e) => onPatchBracket(b.id, { lo: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                      inputMode="numeric"
                      className="h-8 w-14 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] text-center font-mono text-[12.5px] text-[var(--text)] outline-none"
                    />
                    <span className="text-[var(--subtle)]">–</span>
                    <input
                      defaultValue={b.hi}
                      onBlur={(e) => onPatchBracket(b.id, { hi: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                      inputMode="numeric"
                      className="h-8 w-14 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] text-center font-mono text-[12.5px] text-[var(--text)] outline-none"
                    />
                  </div>
                  <div className="flex h-[34px] w-[100px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                    <span className="text-[12.5px] font-semibold text-[var(--subtle)]">{sym}</span>
                    <input
                      defaultValue={b.pay}
                      onBlur={(e) => onPatchBracket(b.id, { pay: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
                      inputMode="numeric"
                      className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                    />
                  </div>
                  {busyId === b.id && <Spinner size={13} className="text-[var(--subtle)]" />}
                  <button
                    onClick={() => onDeleteBracket(b.id)}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)]"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
              ))}
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
                      defaultValue={o.rate}
                      onBlur={(e) => onPatchOtherRate(o.id, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                      inputMode="numeric"
                      className="w-full border-none bg-transparent font-mono text-[13px] font-bold text-[var(--ok)] outline-none"
                    />
                  </div>
                  {busyId === o.id && <Spinner size={13} className="text-[var(--subtle)]" />}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
