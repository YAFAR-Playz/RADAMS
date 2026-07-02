"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import {
  getReportAssignments,
  setAssignmentIncludeInReport,
  getAcademicMonthlyReport,
  type ReportAssignmentOption,
  type StudentAcademicReport,
} from "@/lib/actions/academic-report";
import { downloadCsv } from "@/lib/csv-export";

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function AcademicReportContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [assignments, setAssignments] = useState<ReportAssignmentOption[] | null>(null);
  const [report, setReport] = useState<StudentAcademicReport[] | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      if (data.length) setOfferingId(data[0].id);
    });
  }, []);

  function reload() {
    if (!offeringId) return;
    setAssignments(null);
    setReport(null);
    getReportAssignments(offeringId, period).then(setAssignments);
    getAcademicMonthlyReport(offeringId, period).then(setReport);
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, period]);

  async function onToggleAssignment(a: ReportAssignmentOption) {
    setToggling(a.id);
    try {
      await setAssignmentIncludeInReport(a.id, !a.includeInReport);
      reload();
    } finally {
      setToggling(null);
    }
  }

  function onExport() {
    if (!report) return;
    const rows: unknown[][] = [];
    for (const s of report) {
      for (const a of s.assignments) {
        rows.push([s.studentCode, s.studentName, a.title, a.status ?? "not logged", a.grade ?? "", a.comment ?? ""]);
      }
      if (s.assignments.length === 0) rows.push([s.studentCode, s.studentName, "", "", "", ""]);
    }
    rows.push([]);
    rows.push(["WEAK TOPICS"]);
    rows.push(["Student code", "Student", "Topic", "Materials"]);
    for (const s of report) {
      for (const t of s.weakTopics) {
        const materials = t.materials.map((m) => `${m.kind}: ${m.link}${m.duration ? ` (${m.duration})` : ""}`).join(" | ");
        rows.push([s.studentCode, s.studentName, t.label, materials]);
      }
    }
    rows.push([]);
    rows.push(["ASSISTANT COMMENTS"]);
    rows.push(["Student code", "Student", "Comment"]);
    for (const s of report) rows.push([s.studentCode, s.studentName, s.assistantComment]);

    downloadCsv(`academic-report-${period}`, ["Student code", "Student", "Assignment", "Status", "Grade", "Comment"], rows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Report</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Monthly academic report</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              Per-student assignments, weak topics and assistant comments for {periodLabel(period)}.
            </p>
          </div>
          <div className="flex flex-none items-center gap-[8px]">
            {offerings && offerings.length > 0 && (
              <select
                value={offeringId}
                onChange={(e) => setOfferingId(e.target.value)}
                className="h-10 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-10 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
            />
            <button
              onClick={onExport}
              disabled={!report || report.length === 0}
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              <Icon name="file-up" size={16} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {!offerings ? (
        <SkeletonRow className="h-[120px]" />
      ) : offerings.length === 0 ? (
        <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[30px] text-center text-[13px] text-[var(--muted)]">
          No courses yet.
        </div>
      ) : (
        <>
          <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
            <div className="border-b border-[var(--border)] p-[14px_18px]">
              <h2 className="m-0 text-[14px] font-semibold text-[var(--text)]">Assignments in this report</h2>
              <p className="m-0 mt-[2px] text-[12.5px] text-[var(--muted)]">Choose which of this month&apos;s assignments appear in the report below.</p>
            </div>
            {assignments === null ? (
              <div className="p-[14px]">
                <SkeletonRow className="h-[30px]" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="p-[20px] text-center text-[12.5px] text-[var(--muted)]">No assignments due this month.</div>
            ) : (
              <div className="flex flex-wrap gap-[8px] p-[14px_18px]">
                {assignments.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-[7px] rounded-full border border-[var(--border)] bg-[var(--surface2)] px-[12px] py-[6px] text-[12.5px] font-medium text-[var(--text)]">
                    <input
                      type="checkbox"
                      checked={a.includeInReport}
                      disabled={toggling === a.id}
                      onChange={() => onToggleAssignment(a)}
                      className="h-[14px] w-[14px] cursor-pointer accent-[var(--brand)]"
                    />
                    {a.title}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {report === null ? (
              Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[140px]" />)
            ) : report.length === 0 ? (
              <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[30px] text-center text-[13px] text-[var(--muted)]">
                No students enrolled in this course.
              </div>
            ) : (
              report.map((s) => (
                <div key={s.studentId} className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                  <div className="border-b border-[var(--border)] p-[14px_18px]">
                    <div className="text-[14px] font-semibold text-[var(--text)]">{s.studentName}</div>
                    <div className="text-[11.5px] text-[var(--subtle)]">{s.studentCode}</div>
                  </div>
                  <div className="flex flex-col gap-[14px] p-[14px_18px]">
                    <div>
                      <div className="mb-[6px] text-[11.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Assignments this month</div>
                      {s.assignments.length === 0 ? (
                        <div className="text-[12.5px] text-[var(--muted)]">No assignments selected for this report.</div>
                      ) : (
                        <div className="flex flex-col gap-[6px]">
                          {s.assignments.map((a, i) => (
                            <div key={i} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[9px_11px]">
                              <div className="flex flex-wrap items-center justify-between gap-[8px]">
                                <span className="text-[12.5px] font-semibold text-[var(--text)]">{a.title}</span>
                                <span className="text-[12px] font-medium text-[var(--muted)]">
                                  {a.status ?? "not logged"}
                                  {a.grade ? ` · ${a.grade}` : ""}
                                </span>
                              </div>
                              {a.comment && <div className="mt-[3px] text-[12px] text-[var(--muted)]">{a.comment}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mb-[6px] text-[11.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Weak topics this month</div>
                      {s.weakTopics.length === 0 ? (
                        <div className="text-[12.5px] text-[var(--muted)]">None approved yet.</div>
                      ) : (
                        <div className="flex flex-wrap gap-[6px]">
                          {s.weakTopics.map((t, i) => (
                            <span key={i} className="flex items-center gap-[8px] rounded-full bg-[var(--warns)] py-[4px] pl-[10px] pr-[10px] text-[12px] font-semibold text-[var(--warn)]">
                              {t.label}
                              {t.materials.map((m, j) => (
                                <a key={j} href={m.link} target="_blank" rel="noreferrer" className="font-medium underline">
                                  {m.kind === "video" ? "Video" : "Drive"}
                                  {m.duration ? ` (${m.duration})` : ""}
                                </a>
                              ))}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mb-[6px] text-[11.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Assistant&apos;s overall comment</div>
                      <div className="text-[12.5px] leading-[1.5] text-[var(--text)]">{s.assistantComment || <span className="text-[var(--muted)]">No comment left yet.</span>}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
