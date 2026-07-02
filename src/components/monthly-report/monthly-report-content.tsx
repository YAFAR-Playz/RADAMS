"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { getMonthlyReport, type MonthlyReport } from "@/lib/actions/monthly-report";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { listApprovedTopicsForPeriod, type ApprovedStudentTopic } from "@/lib/actions/weak-topics";
import { downloadCsv } from "@/lib/csv-export";
import { currencySymbol } from "@/lib/currency";

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function MonthlyReportContent() {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("GBP");
  const [weakTopics, setWeakTopics] = useState<ApprovedStudentTopic[] | null>(null);

  useEffect(() => {
    getPayrollSettings().then((s) => {
      if (s) setCurrency(s.currency);
    });
  }, []);

  useEffect(() => {
    (() => {
      setLoading(true);
      getMonthlyReport(period)
        .then(setReport)
        .finally(() => setLoading(false));
      setWeakTopics(null);
      listApprovedTopicsForPeriod(period).then(setWeakTopics);
    })();
  }, [period]);

  const sym = currencySymbol(currency);

  function onExport() {
    if (!report) return;
    downloadCsv(`monthly-report-${report.period}`, ["Metric", "Value"], [
      ["Period", periodLabel(report.period)],
      ["Total students", report.totalStudents],
      ["New students", report.newStudents],
      ["Students left", report.studentsLeft],
      ["Attendance %", report.attendancePct],
      ["Assignment completion %", report.assignmentCompletionPct],
      ["Payroll total", report.payroll.total],
      ["Payroll paid", report.payroll.paid],
      ["Payroll pending", report.payroll.pending],
      ["Staff added", report.staffAdded],
      ["Staff removed", report.staffRemoved],
    ]);
  }

  const cards = report
    ? [
        { label: "Total students", value: String(report.totalStudents), sub: `+${report.newStudents} new · -${report.studentsLeft} left` },
        { label: "Attendance", value: `${report.attendancePct}%`, sub: "across the month" },
        { label: "Assignments checked", value: `${report.assignmentCompletionPct}%`, sub: "of assignments logged this month" },
        { label: "Payroll", value: `${sym}${Math.round(report.payroll.total).toLocaleString()}`, sub: `${sym}${Math.round(report.payroll.paid).toLocaleString()} paid · ${sym}${Math.round(report.payroll.pending).toLocaleString()} pending` },
        { label: "Staffing changes", value: `${report.staffAdded + report.staffRemoved}`, sub: `+${report.staffAdded} added · -${report.staffRemoved} removed` },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Report</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Monthly report</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Org-wide activity for {periodLabel(period)}.</p>
          </div>
          <div className="flex flex-none items-center gap-[8px]">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-10 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
            />
            <button
              onClick={onExport}
              disabled={!report}
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              <Icon name="file-up" size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading || !report
          ? Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} className="h-[92px]" />)
          : cards.map((c) => (
              <div key={c.label} className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[16px_18px] shadow-[var(--shadow)]">
                <div className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">{c.label}</div>
                <div className="mt-1 text-[24px] font-bold tracking-[-0.01em] text-[var(--text)]">{c.value}</div>
                <div className="mt-[2px] text-[12px] text-[var(--muted)]">{c.sub}</div>
              </div>
            ))}
      </div>

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="border-b border-[var(--border)] p-[16px_18px]">
          <h2 className="m-0 text-[15px] font-semibold text-[var(--text)]">Approved weak topics</h2>
          <p className="m-0 mt-[2px] text-[12.5px] text-[var(--muted)]">Topics approved for {periodLabel(period)}, with linked study material.</p>
        </div>
        {weakTopics === null ? (
          <div className="p-[16px]">
            <SkeletonRow className="h-[40px]" />
          </div>
        ) : weakTopics.length === 0 ? (
          <div className="p-[24px] text-center text-[13px] text-[var(--muted)]">No approved weak topics for this month.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {weakTopics.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-[10px] p-[12px_18px]">
                <div>
                  <span className="text-[13px] font-semibold text-[var(--text)]">{t.studentName}</span>
                  <span className="ml-[8px] text-[13px] text-[var(--muted)]">{t.topicLabel}</span>
                </div>
                <div className="flex items-center gap-[12px] text-[12px]">
                  {t.materials.map((m, j) => (
                    <a key={j} href={m.link} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                      {m.kind === "video" ? "Video" : "Drive"}
                      {m.duration ? ` (${m.duration})` : ""}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
