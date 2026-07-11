"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import type { Tone } from "@/lib/roles";
import { toneColors } from "@/lib/tone";
import { getPayrollSettings, setPayrollFlag, setCurrency, type PayrollFlags, type PayrollSettings } from "@/lib/actions/payroll-settings";
import {
  listStaffForCalcMethod,
  updatePaySettings,
  bulkSetCalcMethodForOffering,
  type CalcMethod,
} from "@/lib/actions/staff-payments";
import { listAllOfferingsForOrg, type OfferingChoice } from "@/lib/actions/students";
import { getTrafficLightBands, setTrafficLightBands, type GradeBand } from "@/lib/actions/traffic-light";

const CALC_METHOD_OPTS: { value: CalcMethod; label: string }[] = [
  { value: "paper", label: "Per paper" },
  { value: "category", label: "Avg-paper category" },
  { value: "fixed", label: "Fixed salary" },
];

const TOGGLE_DEFS: { key: keyof PayrollFlags; label: string; desc: string; icon: IconName; tone: Tone }[] = [
  {
    key: "salaryVisibleToHeads",
    label: "Show salary impact to Heads",
    desc: "Heads see amounts and the adjusted total in evaluations. Off = categories and notes only.",
    icon: "wallet",
    tone: "brand",
  },
  {
    key: "headEditAmounts",
    label: "Let Heads edit amounts",
    desc: "Allow Heads to type adjustment amounts instead of using preset category values only.",
    icon: "settings",
    tone: "info",
  },
  {
    key: "assistantSeeBreakdown",
    label: "Assistants see full breakdown",
    desc: "Assistants view the per-course method, bonuses and deductions — not just the total.",
    icon: "users",
    tone: "ok",
  },
  {
    key: "autoRelease",
    label: "Auto-release on approval",
    desc: "Mark salaries as paid automatically once an admin approves the payroll run.",
    icon: "check2",
    tone: "warn",
  },
];

const CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: "GBP", symbol: "£", name: "Pound" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "EGP", symbol: "E£", name: "Eg. Pound" },
  { code: "AED", symbol: "د.إ", name: "Dirham" },
];

export function PayrollSettingsContent() {
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<{ id: string; name: string; role: "head" | "assistant"; calcMethod: CalcMethod }[] | null>(null);
  const [offerings, setOfferings] = useState<OfferingChoice[] | null>(null);

  const [staffPickId, setStaffPickId] = useState("");
  const [staffPickMethod, setStaffPickMethod] = useState<CalcMethod>("paper");
  const [savingStaffDefault, setSavingStaffDefault] = useState(false);

  const [coursePickId, setCoursePickId] = useState("");
  const [coursePickMethod, setCoursePickMethod] = useState<CalcMethod>("paper");
  const [applyingToCourse, setApplyingToCourse] = useState(false);

  const [bands, setBands] = useState<GradeBand[] | null>(null);
  const [savingBands, setSavingBands] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setSettings(await getPayrollSettings());
      } catch {
        setError("Couldn't load payroll settings.");
      } finally {
        setLoading(false);
      }
    })();
    listStaffForCalcMethod().then((data) => {
      setStaffList(data);
      if (data.length) {
        setStaffPickId(data[0].id);
        setStaffPickMethod(data[0].calcMethod);
      }
    });
    listAllOfferingsForOrg().then((data) => {
      setOfferings(data);
      if (data.length) setCoursePickId(data[0].id);
    });
    getTrafficLightBands().then(setBands);
  }, []);

  function addBand() {
    setBands((prev) => [...(prev ?? []), { label: "", min: 0 }]);
  }
  function updateBand(i: number, patch: Partial<GradeBand>) {
    setBands((prev) => (prev ? prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) : prev));
  }
  function removeBand(i: number) {
    setBands((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  }
  async function onSaveBands() {
    if (!bands) return;
    setSavingBands(true);
    setError(null);
    try {
      const sorted = [...bands].sort((a, b) => b.min - a.min);
      await setTrafficLightBands(sorted);
      setBands(sorted);
      setNotice("Traffic light grade bands saved.");
    } catch {
      setError("Couldn't save these bands — try again.");
    } finally {
      setSavingBands(false);
    }
  }

  function onPickStaff(id: string) {
    setStaffPickId(id);
    const found = staffList?.find((s) => s.id === id);
    if (found) setStaffPickMethod(found.calcMethod);
  }

  async function onSaveStaffDefault() {
    if (!staffPickId) return;
    setSavingStaffDefault(true);
    setError(null);
    try {
      await updatePaySettings(staffPickId, { calcMethod: staffPickMethod });
      setStaffList((prev) => (prev ? prev.map((s) => (s.id === staffPickId ? { ...s, calcMethod: staffPickMethod } : s)) : prev));
      const name = staffList?.find((s) => s.id === staffPickId)?.name;
      setNotice(`Default calc method saved for ${name ?? "this staff member"}.`);
    } catch {
      setError("Couldn't save this default — try again.");
    } finally {
      setSavingStaffDefault(false);
    }
  }

  async function onApplyToCourse() {
    if (!coursePickId) return;
    setApplyingToCourse(true);
    setError(null);
    try {
      const { updated } = await bulkSetCalcMethodForOffering(coursePickId, coursePickMethod);
      const courseName = offerings?.find((o) => o.id === coursePickId)?.label;
      setNotice(
        updated
          ? `Applied to ${updated} assistant${updated === 1 ? "" : "s"} on ${courseName ?? "this course"}.`
          : `No assistants are currently assigned to ${courseName ?? "this course"}.`
      );
      if (updated) listStaffForCalcMethod().then(setStaffList); // keep the per-staff picker's cached defaults in sync
    } catch {
      setError("Couldn't apply this default — try again.");
    } finally {
      setApplyingToCourse(false);
    }
  }

  async function onToggle(key: keyof PayrollFlags) {
    if (!settings) return;
    const next = !settings[key];
    setSettings({ ...settings, [key]: next });
    setSavingKey(key);
    try {
      await setPayrollFlag(key, next);
    } catch {
      setError("Couldn't save this setting — try again.");
      setSettings((prev) => (prev ? { ...prev, [key]: !next } : prev));
    } finally {
      setSavingKey(null);
    }
  }

  async function onCurrency(code: string) {
    if (!settings) return;
    setSettings({ ...settings, currency: code });
    setSavingKey("currency");
    try {
      await setCurrency(code);
    } catch {
      setError("Couldn't save currency — try again.");
    } finally {
      setSavingKey(null);
    }
  }

  const sym = CURRENCIES.find((c) => c.code === settings?.currency)?.symbol ?? "£";
  const visible = !!settings?.salaryVisibleToHeads;

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
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Admin · Finance controls</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Payroll settings</h1>
        <p className="m-0 mt-[3px] max-w-[560px] text-[13px] leading-[1.5] text-[var(--muted)]">
          These controls are set by Finance and Admin. They apply org-wide and change what Heads see in evaluations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
            <h3 className="m-0 mb-1 text-[14px] font-semibold text-[var(--text)]">Permissions &amp; visibility</h3>
            <p className="m-0 mb-[13px] text-[12px] text-[var(--subtle)]">Set by Finance &amp; Admin. Apply org-wide.</p>
            {loading || !settings ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <SkeletonRow key={i} className="h-[60px]" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-[9px]">
                {TOGGLE_DEFS.map((t) => {
                  const on = settings[t.key];
                  const { bg, fg } = toneColors(t.tone);
                  return (
                    <div key={t.key} className="flex items-center gap-3 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[12px_13px]">
                      <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px]" style={{ background: bg, color: fg }}>
                        <Icon name={t.icon} size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-[var(--text)]">{t.label}</div>
                        <div className="text-[11.5px] leading-[1.4] text-[var(--muted)]">{t.desc}</div>
                      </div>
                      {savingKey === t.key && <Spinner size={13} className="flex-none text-[var(--subtle)]" />}
                      <button
                        onClick={() => onToggle(t.key)}
                        role="switch"
                        aria-checked={on}
                        className="relative h-6 w-[42px] flex-none rounded-full transition-colors"
                        style={{ background: on ? "var(--brand)" : "var(--border)" }}
                      >
                        <span
                          className="absolute top-[2px] h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left]"
                          style={{ left: on ? "20px" : "2px" }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
            <h3 className="m-0 mb-1 text-[14px] font-semibold text-[var(--text)]">Currency</h3>
            <p className="m-0 mb-[13px] text-[12px] text-[var(--subtle)]">Used across salaries, evaluations and payslips.</p>
            {loading || !settings ? (
              <SkeletonRow className="h-[52px] w-full" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map((c) => {
                  const active = c.code === settings.currency;
                  return (
                    <button
                      key={c.code}
                      onClick={() => onCurrency(c.code)}
                      className="flex items-center gap-2 rounded-[var(--rad-sm)] border-[1.5px] p-[10px_14px]"
                      style={{ borderColor: active ? "var(--brand)" : "var(--border)", background: active ? "var(--brands)" : "var(--surface)" }}
                    >
                      <span className="font-mono text-[15px] font-bold" style={{ color: active ? "var(--brand)" : "var(--muted)" }}>
                        {c.symbol}
                      </span>
                      <div className="text-left leading-[1.2]">
                        <div className="text-[12.5px] font-semibold text-[var(--text)]">{c.code}</div>
                        <div className="text-[11px] text-[var(--subtle)]">{c.name}</div>
                      </div>
                      {active && <Icon name="check" size={15} className="text-[var(--brand)]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
            <h3 className="m-0 mb-1 text-[14px] font-semibold text-[var(--text)]">Default calc method</h3>
            <p className="m-0 mb-[13px] text-[12px] text-[var(--subtle)]">
              How an assistant&apos;s pay is worked out when nothing&apos;s been set on their salary line yet. A per-line override in
              Salaries always wins over this.
            </p>

            {notice && (
              <div className="mb-[13px] flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--ok)] bg-[var(--oks)] px-[13px] py-[9px] text-[12.5px] font-medium text-[var(--ok)]">
                {notice}
                <button onClick={() => setNotice(null)} className="flex-none">
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}

            {/* PER STAFF MEMBER */}
            <div className="mb-4 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[13px]">
              <div className="mb-[9px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">For one staff member</div>
              {staffList === null ? (
                <SkeletonRow className="h-[70px]" />
              ) : staffList.length === 0 ? (
                <p className="m-0 text-[12.5px] text-[var(--muted)]">No heads or assistants yet.</p>
              ) : (
                <div className="flex flex-col gap-[9px]">
                  <div className="flex flex-wrap gap-[9px]">
                    <div className="flex h-9 min-w-[160px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px]">
                      <select
                        value={staffPickId}
                        onChange={(e) => onPickStaff(e.target.value)}
                        className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                      >
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.role === "head" ? "Head" : "Assistant"})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex h-9 min-w-[150px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px]">
                      <select
                        value={staffPickMethod}
                        onChange={(e) => setStaffPickMethod(e.target.value as CalcMethod)}
                        className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                      >
                        {CALC_METHOD_OPTS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={onSaveStaffDefault}
                    disabled={savingStaffDefault || !staffPickId}
                    className="flex h-9 items-center justify-center gap-[7px] rounded-[8px] bg-[var(--brand)] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                  >
                    {savingStaffDefault && <Spinner size={13} />}
                    Save default
                  </button>
                </div>
              )}
            </div>

            {/* BULK PER COURSE */}
            <div className="rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[13px]">
              <div className="mb-[9px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Apply to a whole course</div>
              {offerings === null ? (
                <SkeletonRow className="h-[70px]" />
              ) : offerings.length === 0 ? (
                <p className="m-0 text-[12.5px] text-[var(--muted)]">No active courses yet.</p>
              ) : (
                <div className="flex flex-col gap-[9px]">
                  <div className="flex flex-wrap gap-[9px]">
                    <div className="flex h-9 min-w-[160px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px]">
                      <select
                        value={coursePickId}
                        onChange={(e) => setCoursePickId(e.target.value)}
                        className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                      >
                        {offerings.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex h-9 min-w-[150px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px]">
                      <select
                        value={coursePickMethod}
                        onChange={(e) => setCoursePickMethod(e.target.value as CalcMethod)}
                        className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                      >
                        {CALC_METHOD_OPTS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={onApplyToCourse}
                    disabled={applyingToCourse || !coursePickId}
                    className="flex h-9 items-center justify-center gap-[7px] rounded-[8px] bg-[var(--brand)] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                  >
                    {applyingToCourse && <Spinner size={13} />}
                    Apply to all assistants on this course
                  </button>
                  <p className="m-0 text-[11px] leading-[1.4] text-[var(--subtle)]">
                    Sets the default for every assistant currently assigned to this course. Doesn&apos;t change salary lines already
                    generated — edit those individually in Salaries.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
            <h3 className="m-0 mb-1 text-[14px] font-semibold text-[var(--text)]">Traffic light grade bands</h3>
            <p className="m-0 mb-[13px] text-[12px] text-[var(--subtle)]">
              None of your courses use letter grades, so these org-wide percentage bands decide what counts as &quot;B&quot; and
              &quot;C or below&quot; for each student&apos;s Green/Yellow/Red status on the Students tab. Highest band first.
            </p>
            {bands === null ? (
              <SkeletonRow className="h-[140px]" />
            ) : (
              <div className="flex flex-col gap-[8px]">
                {bands.map((b, i) => (
                  <div key={i} className="flex items-center gap-[8px]">
                    <input
                      value={b.label}
                      onChange={(e) => updateBand(i, { label: e.target.value })}
                      placeholder="A"
                      className="h-9 w-[70px] flex-none rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                    />
                    <div className="flex h-9 flex-1 items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
                      <input
                        type="number"
                        value={b.min}
                        onChange={(e) => updateBand(i, { min: Number(e.target.value) || 0 })}
                        placeholder="85"
                        className="h-full w-full border-none bg-transparent text-[12.5px] text-[var(--text)] outline-none"
                      />
                      <span className="text-[11.5px] font-semibold text-[var(--subtle)]">% min</span>
                    </div>
                    <button
                      onClick={() => removeBand(i)}
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addBand}
                  className="flex h-9 items-center justify-center gap-[6px] rounded-[8px] border border-dashed border-[var(--border)] text-[12.5px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)]"
                >
                  <Icon name="plus" size={13} />
                  Add band
                </button>
                <button
                  onClick={onSaveBands}
                  disabled={savingBands}
                  className="mt-[4px] flex h-9 items-center justify-center gap-[7px] rounded-[8px] bg-[var(--brand)] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                >
                  {savingBands && <Spinner size={13} />}
                  Save bands
                </button>
              </div>
            )}
          </section>
        </div>

        {/* PREVIEW */}
        <aside className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] lg:sticky lg:top-[18px] lg:self-start">
          <div className="border-b border-[var(--border2)] p-[13px_16px]">
            <h3 className="m-0 text-[13px] font-semibold text-[var(--text)]">What a Head sees</h3>
          </div>
          <div className="bg-[var(--bg)] p-4">
            <div className="overflow-hidden rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)]">
              <div className="border-b border-[var(--border2)] p-[11px_13px] text-[12.5px] font-semibold text-[var(--text)]">Salary impact</div>
              {visible ? (
                <div className="flex flex-col gap-2 p-[13px]">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--muted)]">Base</span>
                    <span className="font-mono font-semibold text-[var(--text)]">{sym}1,856</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--muted)]">Extra work</span>
                    <span className="font-mono font-semibold text-[var(--ok)]">+{sym}150</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--muted)]">Deductions</span>
                    <span className="font-mono font-semibold text-[var(--danger)]">−{sym}40</span>
                  </div>
                  <div className="h-px bg-[var(--border2)]" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-[var(--text)]">Total</span>
                    <span className="font-mono text-[16px] font-bold text-[var(--text)]">{sym}1,966</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 p-[20px_14px] text-center">
                  <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[var(--surface2)] text-[var(--subtle)]">
                    <Icon name="shield" size={19} />
                  </div>
                  <span className="text-[12px] leading-[1.45] text-[var(--muted)]">Hidden — Heads fill categories and notes only.</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
