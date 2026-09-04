"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { formatGradeByScale } from "@/lib/grade-scale";
import { renderElementToPdfBlob, downloadBlob, shareOrDownloadPdf } from "@/lib/pdf-export";
import type { GeneratedReportMeta, GeneratedStudentReport } from "@/lib/actions/academic-report";
import { shouldShowGrade } from "@/lib/report-grade";
import type { ReportSettings } from "@/lib/actions/report-settings";

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function markFraction(grade: string | null, maxMarks: number | null): string | null {
  if (grade == null || grade.trim() === "") return null;
  return maxMarks ? `${grade}/${maxMarks}` : grade;
}

function StatusOnlyTable({ items }: { items: { title: string; status: string | null }[] }) {
  if (items.length === 0) return null;
  return (
    <table className="w-full border-collapse text-[12.5px]">
      <tbody>
        {items.map((a, i) => (
          <tr key={i} className="border-b border-[#ddd]">
            <td className="w-1/2 py-[7px] pr-2 font-semibold text-[#2a5298]">{a.title}</td>
            <td className="py-[7px] capitalize">{a.status ?? "not logged"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Grade and Mark used to render as two separate rows, but Mark is just
// Grade formatted as a fraction when a max score exists (or literally
// identical to Grade when it doesn't) — never a second distinct fact.
// One row, preferring the fraction when there's a max to show.
function GradeBlocks({ items }: { items: { title: string; status: string | null; grade: string | null; maxMarks: number | null }[] }) {
  if (items.length === 0) return null;
  return (
    <>
      {items.map((a, i) => (
        <div key={i} className="mb-3">
          <div className="mb-1 text-[13px] font-bold text-[#2a5298]">{a.title}</div>
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              <tr className="border-b border-[#ddd]">
                <td className="w-1/3 py-[6px] pr-2 font-semibold">Status</td>
                <td className="py-[6px] capitalize">{a.status ?? "not logged"}</td>
              </tr>
              <tr className="border-b border-[#ddd]">
                <td className="py-[6px] pr-2 font-semibold">Grade</td>
                <td className="py-[6px]">{markFraction(a.grade, a.maxMarks) ?? a.grade ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

const MATERIAL_KIND_LABEL: Record<"video" | "notes" | "tricky_question", string> = {
  video: "Video",
  notes: "Notes",
  tricky_question: "Tricky Question",
};

function MaterialCard({ label, link, duration, actionLabel }: { label: string; link: string; duration: string | null; actionLabel: string }) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-[8px] border border-[#ddd] px-3 py-2 text-[12.5px]">
      <div>
        <div className="font-semibold">{label}</div>
        {duration && <div className="text-[11px] text-[#777]">⏱ {duration}</div>}
      </div>
      <a href={link} target="_blank" rel="noreferrer" className="rounded-full bg-[#2a5298] px-3 py-1 text-[11.5px] font-semibold text-white">
        {actionLabel}
      </a>
    </div>
  );
}

export function PrintReportView({
  meta,
  students,
  courseName,
  orgName,
  logoUrl,
  settings,
  autoAction,
}: {
  meta: GeneratedReportMeta | null;
  students: GeneratedStudentReport[];
  courseName: string;
  orgName: string;
  logoUrl: string | null;
  settings: ReportSettings;
  autoAction?: "print" | "download" | "share";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function fileName() {
    const monthPart = meta ? periodLabel(meta.period) : "Report";
    if (students.length === 1) return `${students[0].studentName} - Monthly Report (${monthPart}).pdf`;
    return `${courseName} - Monthly Reports (${monthPart}).pdf`;
  }

  async function onDownload() {
    if (!containerRef.current || busy) return;
    setBusy("download");
    setActionError(null);
    try {
      const blob = await renderElementToPdfBlob(containerRef.current);
      downloadBlob(blob, fileName());
    } catch {
      setActionError("Couldn't build the PDF — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    if (!containerRef.current || busy) return;
    setBusy("share");
    setActionError(null);
    try {
      await shareOrDownloadPdf(containerRef.current, fileName());
    } catch {
      setActionError("Couldn't share the PDF — try again.");
    } finally {
      setBusy(null);
    }
  }

  // The list view's Share/Download/Print actions open this same page with
  // ?action=... so the right thing happens immediately without an extra
  // click. Auto-firing navigator.share() right after a fresh navigation can
  // fail in some browsers (Web Share generally wants a direct user gesture),
  // but shareOrDownloadPdf already falls back to a plain download when
  // sharing is rejected, so there's no silent failure either way.
  useEffect(() => {
    (() => {
      if (!meta || !autoAction) return;
      if (autoAction === "print") window.print();
      if (autoAction === "download") onDownload();
      if (autoAction === "share") onShare();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAction, meta]);

  if (!meta) {
    return <div className="p-10 text-[14px] text-[#666]">No report has been generated for this month yet.</div>;
  }

  return (
    <div className="mx-auto max-w-[820px] p-8 text-[#111] print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-page { break-after: page; }
          .report-page:last-child { break-after: auto; }
          .revision-page { break-before: page; }
        }
      `}</style>

      <div className="no-print mb-6 flex flex-col gap-3 rounded-[10px] border border-[#ddd] bg-[#f7f7f8] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-[#555]">
            {students.length} student report{students.length === 1 ? "" : "s"} · {periodLabel(meta.period)}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShare}
              disabled={busy !== null}
              className="flex items-center gap-[6px] rounded-[8px] border border-[#ccc] bg-white px-3 py-2 text-[13px] font-semibold text-[#333] disabled:opacity-60"
            >
              <Icon name="share" size={15} />
              {busy === "share" ? "Sharing…" : "Share"}
            </button>
            <button
              onClick={onDownload}
              disabled={busy !== null}
              className="flex items-center gap-[6px] rounded-[8px] border border-[#ccc] bg-white px-3 py-2 text-[13px] font-semibold text-[#333] disabled:opacity-60"
            >
              <Icon name="download" size={15} />
              {busy === "download" ? "Preparing…" : "Download"}
            </button>
            <button
              onClick={() => window.print()}
              disabled={busy !== null}
              className="flex items-center gap-[6px] rounded-[8px] bg-[#2563eb] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              <Icon name="printer" size={15} />
              Print
            </button>
          </div>
        </div>
        {actionError && <div className="text-[12.5px] font-medium text-[#c0392b]">{actionError}</div>}
      </div>

      {students.length === 0 ? (
        <div className="text-[14px] text-[#666]">No student found for this report.</div>
      ) : (
        <div ref={containerRef}>
        {students.map((s) => {
          const homeworks = s.assignments.filter((a) => a.reportGroup === "homework");
          const classwork = s.assignments.filter((a) => a.reportGroup === "classwork");
          const quizzes = s.assignments.filter((a) => a.reportGroup === "quiz");
          const mockExams = s.assignments.filter((a) => a.reportGroup === "mock_exam");
          const other = s.assignments.filter((a) => !a.reportGroup || a.reportGroup === "other");

          return (
            <div key={s.studentId} className="report-page mb-10 border-b border-[#eee] pb-8">
              {settings.groupByType ? (
                <>
                  {logoUrl && (
                    <div className="mb-4 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element -- print view, not part of Next's optimized image pipeline */}
                      <img src={logoUrl} alt={orgName} className="h-[90px] w-auto object-contain" />
                    </div>
                  )}
                  <h1 className="mb-4 text-center text-[22px] font-bold">
                    {s.studentName} - Monthly Report ({periodLabel(meta.period)})
                  </h1>
                  <div className="mb-5 text-[13px] leading-[1.7]">
                    <div>
                      <span className="font-bold">Course:</span> {courseName}
                    </div>
                    <div>
                      <span className="font-bold">Assistant:</span> {s.assistantName ?? "—"}
                    </div>
                    <div>
                      <span className="font-bold">Month:</span> {periodLabel(meta.period)}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-5 flex items-start justify-between border-b-2 border-[#111] pb-3">
                    <div>
                      <div className="text-[19px] font-bold">{orgName}</div>
                      <div className="text-[13px] text-[#555]">{courseName} · Monthly report</div>
                    </div>
                    <div className="text-right text-[13px] text-[#555]">
                      <div>{periodLabel(meta.period)}</div>
                      <div>Generated {new Date(meta.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <div className="text-[17px] font-semibold">{s.studentName}</div>
                      <div className="text-[12px] text-[#777]">#{s.studentCode}</div>
                    </div>
                    {settings.showAverageGrade && (
                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-wide text-[#777]">Average grade</div>
                        <div className="text-[22px] font-bold">{formatGradeByScale(s.avgGrade, meta.gradeScale)}</div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {settings.groupByType ? (
                <>
                  {homeworks.length > 0 && (
                    <div className="mb-5">
                      <div className="mb-2 border-b-2 border-[#2a5298] pb-1 text-[15px] font-bold text-[#2a5298]">Homeworks</div>
                      <StatusOnlyTable items={homeworks.filter((a) => !shouldShowGrade(a))} />
                      <GradeBlocks items={homeworks.filter(shouldShowGrade)} />
                    </div>
                  )}

                  {classwork.length > 0 && (
                    <div className="mb-5">
                      <div className="mb-2 border-b-2 border-[#2a5298] pb-1 text-[15px] font-bold text-[#2a5298]">Classwork</div>
                      <StatusOnlyTable items={classwork.filter((a) => !shouldShowGrade(a))} />
                      <GradeBlocks items={classwork.filter(shouldShowGrade)} />
                    </div>
                  )}

                  {quizzes.length > 0 && (
                    <div className="mb-5">
                      <div className="mb-2 border-b-2 border-[#2a5298] pb-1 text-[15px] font-bold text-[#2a5298]">Quizzes</div>
                      <StatusOnlyTable items={quizzes.filter((a) => !shouldShowGrade(a))} />
                      <GradeBlocks items={quizzes.filter(shouldShowGrade)} />
                    </div>
                  )}

                  {mockExams.length > 0 && (
                    <div className="mb-5">
                      <div className="mb-2 border-b-2 border-[#2a5298] pb-1 text-[15px] font-bold text-[#2a5298]">Mock Exams</div>
                      <StatusOnlyTable items={mockExams.filter((a) => !shouldShowGrade(a))} />
                      <GradeBlocks items={mockExams.filter(shouldShowGrade)} />
                    </div>
                  )}

                  {other.length > 0 && (
                    <div className="mb-5">
                      <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#555]">Other</div>
                      <table className="w-full border-collapse text-[12.5px]">
                        <thead>
                          <tr className="border-b border-[#ccc] text-left text-[#555]">
                            <th className="py-[6px] pr-2">Assignment</th>
                            <th className="py-[6px] pr-2">Status</th>
                            <th className="py-[6px]">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {other.map((a, i) => (
                            <tr key={i} className="border-b border-[#eee]">
                              <td className="py-[6px] pr-2 font-medium">{a.title}</td>
                              <td className="py-[6px] pr-2 capitalize">{a.status ?? "not logged"}</td>
                              <td className="py-[6px]">{a.grade ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {s.assignments.length === 0 && <div className="mb-5 text-[13px] text-[#777]">No assignments included in this report.</div>}
                </>
              ) : (
                <div className="mb-5">
                  <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#555]">Assignments</div>
                  {s.assignments.length === 0 ? (
                    <div className="text-[13px] text-[#777]">No assignments included in this report.</div>
                  ) : (
                    <table className="w-full border-collapse text-[12.5px]">
                      <thead>
                        <tr className="border-b border-[#ccc] text-left text-[#555]">
                          <th className="py-[6px] pr-2">Assignment</th>
                          <th className="py-[6px] pr-2">Status</th>
                          <th className="py-[6px]">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.assignments.map((a, i) => (
                          <tr key={i} className="border-b border-[#eee]">
                            <td className="py-[6px] pr-2 font-medium">{a.title}</td>
                            <td className="py-[6px] pr-2 capitalize">{a.status ?? "not logged"}</td>
                            <td className="py-[6px]">{a.grade ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {settings.showWeakTopics && !settings.groupByType && (
                <div className="mb-5">
                  <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#555]">Weak topics</div>
                  {s.weakTopics.length === 0 ? (
                    <div className="text-[13px] text-[#777]">None flagged this month.</div>
                  ) : (
                    <ul className="list-disc pl-5 text-[13px]">
                      {s.weakTopics.map((t, i) => (
                        <li key={i} className="mb-1">
                          <span className="font-medium">{t.label}</span>
                          {t.materials.length > 0 && (
                            <span className="text-[#555]">
                              {" — "}
                              {t.materials.map((m) => `${m.label?.trim() || MATERIAL_KIND_LABEL[m.kind]}${m.duration ? ` (${m.duration})` : ""}`).join(", ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {settings.groupByType ? (
                (settings.showComment || settings.showAverageGrade) && (
                  <div>
                    <div className="mb-2 border-b-2 border-[#2a5298] pb-1 text-[15px] font-bold text-[#2a5298]">Monthly Performance Summary</div>
                    <table className="w-full border-collapse text-[12.5px]">
                      <tbody>
                        {settings.showComment && (
                          <tr className="border-b border-[#ddd]">
                            <td className="w-1/3 py-[7px] pr-2 align-top font-semibold text-[#2a5298]">
                              {new Date(meta.period + "-01").toLocaleDateString("en-US", { month: "long" })} Performance Comment
                            </td>
                            <td className="whitespace-pre-wrap py-[7px] leading-[1.5]">{s.assistantComment || <span className="text-[#777]">No comment left.</span>}</td>
                          </tr>
                        )}
                        {settings.showAverageGrade && (
                          <tr className="border-b border-[#ddd]">
                            <td className="py-[7px] pr-2 font-semibold text-[#2a5298]">Average Grade</td>
                            <td className="py-[7px]">{formatGradeByScale(s.avgGrade, meta.gradeScale)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                settings.showComment && (
                  <div>
                    <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#555]">Assistant&apos;s comment</div>
                    <div className="whitespace-pre-wrap text-[13px] leading-[1.5]">{s.assistantComment || <span className="text-[#777]">No comment left.</span>}</div>
                  </div>
                )
              )}

              {settings.groupByType && settings.showWeakTopics && s.weakTopics.length > 0 && (
                <div className="revision-page mt-8">
                  <h2 className="mb-6 border-b-2 border-[#2a5298] pb-2 text-center text-[20px] font-bold text-[#2a5298]">Weak Topics</h2>
                  {s.weakTopics.map((t, i) => {
                    const notes = t.materials.filter((m) => m.kind === "notes");
                    const trickyQuestions = t.materials.filter((m) => m.kind === "tricky_question");
                    const videos = t.materials.filter((m) => m.kind === "video");
                    return (
                      <div key={i} className="mb-6">
                        <div className="mb-2 border-b-2 border-[#2a5298] pb-1 text-[15px] font-bold text-[#2a5298]">{t.label}</div>
                        {notes.length > 0 && (
                          <div className="mb-3">
                            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#2a5298]">Notes ({notes.length})</div>
                            {notes.map((m, j) => (
                              <MaterialCard key={j} label={m.label?.trim() || MATERIAL_KIND_LABEL.notes} link={m.link} duration={null} actionLabel="View" />
                            ))}
                          </div>
                        )}
                        {trickyQuestions.length > 0 && (
                          <div className="mb-3">
                            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#2a5298]">Tricky Questions ({trickyQuestions.length})</div>
                            {trickyQuestions.map((m, j) => (
                              <MaterialCard key={j} label={m.label?.trim() || MATERIAL_KIND_LABEL.tricky_question} link={m.link} duration={null} actionLabel="View" />
                            ))}
                          </div>
                        )}
                        {videos.length > 0 && (
                          <div className="mb-3">
                            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#2a5298]">Summarized Videos ({videos.length})</div>
                            {videos.map((m, j) => (
                              <MaterialCard key={j} label={m.label?.trim() || MATERIAL_KIND_LABEL.video} link={m.link} duration={m.duration} actionLabel="Watch" />
                            ))}
                          </div>
                        )}
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
    </div>
  );
}
