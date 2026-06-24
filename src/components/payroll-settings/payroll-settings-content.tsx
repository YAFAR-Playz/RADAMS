"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import type { Tone } from "@/lib/roles";
import { toneColors } from "@/lib/tone";
import { getPayrollSettings, setPayrollFlag, setCurrency, type PayrollFlags, type PayrollSettings } from "@/lib/actions/payroll-settings";

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
  }, []);

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
