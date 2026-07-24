"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { getMonthlyReport, listGradeScalesForOrg, type MonthlyReport, type OfferingGradeScale } from "@/lib/actions/monthly-report";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { listApprovedTopicsForPeriod, type ApprovedStudentTopic } from "@/lib/actions/weak-topics";
import { downloadCsv } from "@/lib/csv-export";
import { currencySymbol } from "@/lib/currency";
import { pickerOnlyDateProps } from "@/lib/date-input";

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(0);
  const [gradeScales, setGradeScales] = useState<OfferingGradeScale[] | null>(null);

  useEffect(() => {
    getPayrollSettings().then((s) => {
      if (s) setCurrency(s.currency);
    });
    listGradeScalesForOrg().then(setGradeScales);
  }, []);

  useEffect(() => {
    (() => {
      setLoading(true);
      getMonthlyReport(period)
        .then(setReport)
        .finally(() => setLoading(false));
      setWeakTopics(null);
      setPage(0);
      listApprovedTopicsForPeriod(period).then(setWeakTopics);
    })();
  }, [period]);

  const sym = currencySymbol(currency);
  const pageCount = Math.max(1, Math.ceil((weakTopics?.length ?? 0) / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = (weakTopics ?? []).slice(pageStart, pageStart + PAGE_SIZE);

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
              {...pickerOnlyDateProps}
              className="h-10 cursor-pointer rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
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
          <h2 className="m-0 text-[15px] font-semibold text-[var(--text)]">Grade scale by course</h2>
          <p className="m-0 mt-[2px] text-[12.5px] text-[var(--muted)]">Reference for how each course&apos;s assignment grades map to bands — set by each Head under Courses.</p>
        </div>
        {gradeScales === null ? (
          <div className="p-[16px]">
            <SkeletonRow className="h-[40px]" />
          </div>
        ) : gradeScales.length === 0 ? (
          <div className="p-[24px] text-center text-[13px] text-[var(--muted)]">No courses yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {gradeScales.map((g) => (
              <div key={g.offeringId} className="flex flex-wrap items-center justify-between gap-[10px] p-[12px_18px]">
                <span className="text-[13px] font-semibold text-[var(--text)]">{g.label}</span>
                {g.bands.length > 0 ? (
                  <div className="flex flex-wrap gap-[6px]">
                    {g.bands.map((b) => (
                      <span
                        key={b.label}
                        className="inline-flex items-center gap-[5px] rounded-full bg-[var(--surface2)] px-[9px] py-[3px] text-[11.5px] font-semibold text-[var(--text)]"
                      >
                        {b.label} ≥ {b.min}%
                      </span>
                    ))}
                  </div>
                ) : g.scale === "percentage" ? (
                  <span className="text-[12.5px] text-[var(--muted)]">Percentage (0–100)</span>
                ) : (
                  <span className="text-[12.5px] text-[var(--subtle)]">{g.scale === "numeric" ? "Numeric" : "Letter"} scale — no bands set</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] p-[16px_18px]">
          <div>
            <h2 className="m-0 text-[15px] font-semibold text-[var(--text)]">Approved weak topics</h2>
            <p className="m-0 mt-[2px] text-[12.5px] text-[var(--muted)]">Topics approved for {periodLabel(period)}, with linked study material.</p>
          </div>
          {!!weakTopics?.length && (
            <span className="text-[11.5px] text-[var(--subtle)]">
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, weakTopics.length)} of {weakTopics.length}
            </span>
          )}
        </div>
        {weakTopics === null ? (
          <div className="p-[16px]">
            <SkeletonRow className="h-[40px]" />
          </div>
        ) : weakTopics.length === 0 ? (
          <div className="p-[24px] text-center text-[13px] text-[var(--muted)]">No approved weak topics for this month.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {pageRows.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-[10px] p-[12px_18px]">
                <div>
                  <span className="text-[13px] font-semibold text-[var(--text)]">{t.studentName}</span>
                  <span className="ml-[8px] text-[13px] text-[var(--muted)]">{t.topicLabel}</span>
                </div>
                <div className="flex items-center gap-[12px] text-[12px]">
                  {t.materials.map((m, j) => (
                    <a key={j} href={m.link} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                      {m.label?.trim() || (m.kind === "video" ? "Video" : "Document")}
                      {m.duration ? ` (${m.duration})` : ""}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {pageCount > 1 && (
          <div className="flex flex-wrap items-center gap-[5px] border-t border-[var(--border2)] p-[10px_18px]">
            {Array.from({ length: pageCount }, (_, i) => i)
              .filter((i) => i >= safePage - 2 && i <= safePage + 2)
              .map((i) => {
                const active = i === safePage;
                return (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    className="h-7 min-w-7 rounded-[7px] border px-[7px] text-[12px] font-semibold"
                    style={
                      active
                        ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                        : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                    }
                  >
                    {i + 1}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
