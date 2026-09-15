"use client";

import { Icon } from "@/components/icons";
import type { FeatureKey } from "@/lib/landing-copy";

// Purpose-built, simplified mockups per feature — not real product
// screenshots. A dense real admin screen (packed tables, multi-column
// filters) doesn't read well shrunk into a marketing card, so these
// recreate just the one idea each feature is about, styled with the same
// CSS variables (--brand, --surface, --border, etc.) the real app uses, so
// it still feels authentic rather than generic stock-art.

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-center gap-[10px] overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-[22px] shadow-[0_1px_2px_rgba(16,23,41,0.04),0_18px_40px_rgba(16,23,41,0.10)]">
      {children}
    </div>
  );
}

function AttendanceVisual({ brand }: { brand: string }) {
  const rows = [
    { name: "Yara M.", status: "present" },
    { name: "Omar K.", status: "present" },
    { name: "Sara T.", status: "late" },
    { name: "Ahmed F.", status: "absent" },
  ];
  const dot: Record<string, string> = { present: "var(--ok)", late: "var(--warn)", absent: "var(--danger)" };
  return (
    <Chrome>
      <div className="mb-[10px] flex items-center gap-[8px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)`, color: brand }}>
          <Icon name="cal-check" size={14} />
        </div>
        <div className="text-[12px] font-semibold text-[var(--text)]">Today&apos;s session</div>
      </div>
      <div className="flex flex-col gap-[6px]">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-[8px] border border-[var(--border2)] bg-[var(--surface2)] px-[10px] py-[7px]">
            <span className="text-[11px] font-medium text-[var(--text)]">{r.name}</span>
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: dot[r.status] }} />
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function AssignmentsVisual({ brand }: { brand: string }) {
  const pills = [
    { label: "Checked", value: "128", tone: "var(--ok)" },
    { label: "Late", value: "6", tone: "var(--warn)" },
    { label: "Missing", value: "3", tone: "var(--danger)" },
  ];
  return (
    <Chrome>
      <div className="mb-[10px] flex items-center gap-[8px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)`, color: brand }}>
          <Icon name="clipboard-list" size={14} />
        </div>
        <div className="text-[12px] font-semibold text-[var(--text)]">Unit 3 · Assignment 2</div>
      </div>
      <div className="grid grid-cols-3 gap-[8px]">
        {pills.map((p) => (
          <div key={p.label} className="rounded-[10px] border border-[var(--border2)] bg-[var(--surface2)] p-[10px] text-center">
            <div className="text-[16px] font-bold" style={{ color: p.tone }}>{p.value}</div>
            <div className="text-[9.5px] font-medium text-[var(--subtle)]">{p.label}</div>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function PayrollVisual({ brand }: { brand: string }) {
  const rows = [
    { name: "Per paper", value: "$0.80 / paper" },
    { name: "Fixed", value: "$220 / month" },
    { name: "Hourly", value: "$12 / hr" },
  ];
  return (
    <Chrome>
      <div className="mb-[10px] flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)`, color: brand }}>
            <Icon name="wallet" size={14} />
          </div>
          <div className="text-[12px] font-semibold text-[var(--text)]">This month&apos;s payroll</div>
        </div>
        <span className="rounded-full px-[8px] py-[2px] text-[9.5px] font-semibold" style={{ background: "var(--oks)", color: "var(--ok)" }}>Released</span>
      </div>
      <div className="flex flex-col gap-[6px]">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between rounded-[8px] border border-[var(--border2)] bg-[var(--surface2)] px-[10px] py-[7px]">
            <span className="text-[11px] font-medium text-[var(--text)]">{r.name}</span>
            <span className="text-[11px] font-semibold text-[var(--muted)]">{r.value}</span>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function WeakTopicsVisual({ brand }: { brand: string }) {
  const topics = [
    { label: "Organic chemistry", pct: 38 },
    { label: "Trigonometry", pct: 52 },
    { label: "Cell division", pct: 71 },
  ];
  return (
    <Chrome>
      <div className="mb-[10px] flex items-center gap-[8px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)`, color: brand }}>
          <Icon name="target" size={14} />
        </div>
        <div className="text-[12px] font-semibold text-[var(--text)]">Weak topics · Class avg</div>
      </div>
      <div className="flex flex-col gap-[8px]">
        {topics.map((t) => (
          <div key={t.label}>
            <div className="mb-[3px] flex items-center justify-between text-[10.5px] font-medium text-[var(--muted)]">
              <span>{t.label}</span>
              <span>{t.pct}%</span>
            </div>
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface2)]">
              <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: t.pct < 50 ? "var(--danger)" : "var(--warn)" }} />
            </div>
          </div>
        ))}
      </div>
    </Chrome>
  );
}

function MessagingVisual({ brand }: { brand: string }) {
  return (
    <Chrome>
      <div className="mb-[10px] flex items-center gap-[8px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)`, color: brand }}>
          <Icon name="message" size={14} />
        </div>
        <div className="text-[12px] font-semibold text-[var(--text)]">Message parent</div>
      </div>
      <div className="rounded-[10px] border border-[var(--border2)] bg-[var(--surface2)] p-[10px] text-[10.5px] leading-[1.5] text-[var(--muted)]">
        &ldquo;Hi! Yara scored 92% on today&apos;s quiz — great progress this week 🎉&rdquo;
      </div>
      <div className="mt-[10px] flex items-center gap-[6px] self-start rounded-[8px] border border-[#25D366] px-[10px] py-[6px] text-[10.5px] font-semibold text-[#1ea952]">
        <Icon name="send" size={11} />
        Send on WhatsApp
      </div>
    </Chrome>
  );
}

function ReportsVisual({ brand }: { brand: string }) {
  return (
    <Chrome>
      <div className="mb-[10px] flex items-center gap-[8px]">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px]" style={{ background: `color-mix(in srgb, ${brand} 12%, transparent)`, color: brand }}>
          <Icon name="trend" size={14} />
        </div>
        <div className="text-[12px] font-semibold text-[var(--text)]">Monthly report</div>
      </div>
      <div className="flex flex-col gap-[6px]">
        {["Yara_Monthly_Report.pdf", "Omar_Monthly_Report.pdf", "Sara_Monthly_Report.pdf"].map((f) => (
          <div key={f} className="flex items-center gap-[8px] rounded-[8px] border border-[var(--border2)] bg-[var(--surface2)] px-[10px] py-[7px]">
            <Icon name="download" size={12} className="text-[var(--subtle)]" />
            <span className="truncate text-[10.5px] font-medium text-[var(--text)]">{f}</span>
            <Icon name="check" size={12} className="ms-auto text-[var(--ok)]" />
          </div>
        ))}
      </div>
    </Chrome>
  );
}

const VISUALS: Record<FeatureKey, (props: { brand: string }) => React.ReactElement> = {
  attendance: AttendanceVisual,
  assignments: AssignmentsVisual,
  payroll: PayrollVisual,
  weakTopics: WeakTopicsVisual,
  messaging: MessagingVisual,
  reports: ReportsVisual,
};

export function FeatureVisual({ feature, brand }: { feature: FeatureKey; brand: string }) {
  const Cmp = VISUALS[feature];
  return <Cmp brand={brand} />;
}
