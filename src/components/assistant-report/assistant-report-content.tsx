"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import { getMyGeneratedReport, type GeneratedReportMeta, type GeneratedStudentReport } from "@/lib/actions/academic-report";
import { formatGradeByScale } from "@/lib/grade-scale";
import { pickerOnlyDateProps } from "@/lib/date-input";
import { matchesStudentQuery } from "@/lib/student-search";
import { ReportActionButtons } from "@/components/academic-report/report-action-buttons";
import { SendReportMessageButton, type ReportMessageTemplates } from "@/components/academic-report/send-report-message-button";
import { getEffectiveTemplates, getOrgBrandName } from "@/lib/actions/templates";

const PAGE_SIZE = 10;

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function AssistantReportContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());

  const [meta, setMeta] = useState<GeneratedReportMeta | null>(null);
  const [students, setStudents] = useState<GeneratedStudentReport[] | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [messageTemplates, setMessageTemplates] = useState<ReportMessageTemplates | null>(null);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    getEffectiveTemplates(["monthly_report_student", "monthly_report_parent"]).then((t) =>
      setMessageTemplates({ student: t.monthly_report_student, parent: t.monthly_report_parent })
    );
    getOrgBrandName().then(setOrgName);
  }, []);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      if (data.length) setOfferingId(data[0].id);
    });
  }, []);

  function reload() {
    if (!offeringId) return;
    setMeta(null);
    setStudents(null);
    setPage(0);
    setSearch("");
    getMyGeneratedReport(offeringId, period).then(({ meta, students }) => {
      setMeta(meta);
      setStudents(students);
    });
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, period]);

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => matchesStudentQuery(search, s.studentName, s.studentCode));
  }, [students, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Monthly Reports</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">My students&apos; reports</h1>
            <p className="m-0 mt-[3px] max-w-[560px] text-[13px] leading-[1.5] text-[var(--muted)]">
              View, share, download, or print each of your students&apos; monthly reports — available once the head generates the report for that month.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-[10px]">
          <select
            value={offeringId}
            onChange={(e) => setOfferingId(e.target.value)}
            disabled={!offerings || offerings.length === 0}
            className="h-10 flex-none rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none disabled:opacity-60"
          >
            {offerings === null ? (
              <option>Loading…</option>
            ) : offerings.length === 0 ? (
              <option>No courses</option>
            ) : (
              offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))
            )}
          </select>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            {...pickerOnlyDateProps}
            className="h-10 cursor-pointer rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search student name or code…"
            className="h-10 min-w-[200px] flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
          />
          <ReportActionButtons href={`/report-print?offeringId=${offeringId}&period=${period}`} disabled={!meta} />
        </div>
      </div>

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {students === null ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonRow key={i} className="h-[56px]" />
            ))}
          </div>
        ) : !meta ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Icon name="clock" size={26} className="text-[var(--subtle)]" />
            <div className="text-[13.5px] font-semibold text-[var(--text)]">Not generated yet</div>
            <div className="max-w-[360px] text-[13px] leading-[1.5] text-[var(--muted)]">
              The head hasn&apos;t generated the monthly report for {periodLabel(period)} yet. Check back once they have.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">
            {students.length === 0 ? "None of your students are in this report." : "No students match your search."}
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--border)]">
              {pageRows.map((s) => (
                <div key={s.studentId} className="flex flex-wrap items-center justify-between gap-[10px] p-[14px_18px]">
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--text)]">{s.studentName}</div>
                    <div className="text-[11.5px] text-[var(--subtle)]">{s.studentCode}</div>
                  </div>
                  <div className="flex items-center gap-[14px]">
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-[0.03em] text-[var(--subtle)]">Avg grade</div>
                      <div className="font-mono text-[15px] font-bold text-[var(--text)]">{formatGradeByScale(s.avgGrade, meta.gradeScale)}</div>
                    </div>
                    <ReportActionButtons href={`/report-print?offeringId=${offeringId}&period=${period}&studentId=${s.studentId}`} compact />
                    <SendReportMessageButton
                      compact
                      templates={messageTemplates}
                      orgName={orgName}
                      courseName={offerings?.find((o) => o.id === offeringId)?.label ?? ""}
                      monthLabel={periodLabel(period)}
                      studentName={s.studentName}
                      studentInitials={initialsOf(s.studentName)}
                      guardianName={s.guardianName}
                      phone={s.phone}
                      guardianPhone={s.guardianPhone}
                      driveFolderLink={s.driveFolderLink}
                      avgGradeDisplay={formatGradeByScale(s.avgGrade, meta.gradeScale)}
                    />
                  </div>
                </div>
              ))}
            </div>
            {pageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-[10px] p-[12px_18px]">
                <span className="text-[12px] text-[var(--subtle)]">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} students
                </span>
                <div className="flex flex-wrap gap-[5px]">
                  {Array.from({ length: pageCount }, (_, i) => i)
                    .filter((i) => i >= safePage - 2 && i <= safePage + 2)
                    .map((i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className="h-7 min-w-7 rounded-[7px] border px-[7px] text-[12px] font-semibold"
                        style={
                          i === safePage
                            ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                            : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                        }
                      >
                        {i + 1}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
