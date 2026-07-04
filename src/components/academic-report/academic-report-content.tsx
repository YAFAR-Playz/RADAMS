"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import {
  getReportAssignments,
  generateMonthlyAcademicReport,
  getGeneratedReport,
  listReportGenerations,
  type ReportAssignmentOption,
  type AssignmentReportMode,
  type GeneratedReportMeta,
  type GeneratedStudentReport,
} from "@/lib/actions/academic-report";
import { getGradeScale, setGradeScale, type GradeBand, type GradeScaleSetting } from "@/lib/actions/oversight";
import { formatGradeByScale } from "@/lib/grade-scale";
import { downloadCsv } from "@/lib/csv-export";
import { pickerOnlyDateProps } from "@/lib/date-input";

const PAGE_SIZE = 10;

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const SCALE_OPTIONS = ["percentage", "letter", "numeric"] as const;

export function AcademicReportContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());

  const [assignments, setAssignments] = useState<ReportAssignmentOption[] | null>(null);
  const [meta, setMeta] = useState<GeneratedReportMeta | null>(null);
  const [students, setStudents] = useState<GeneratedStudentReport[] | null>(null);
  const [history, setHistory] = useState<{ period: string; createdAt: string }[] | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [generateOpen, setGenerateOpen] = useState(false);
  const [selection, setSelection] = useState<Record<string, AssignmentReportMode | "excluded">>({});
  const [generating, setGenerating] = useState(false);

  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleDraft, setScaleDraft] = useState<GradeScaleSetting>({ scale: "percentage", bands: [] });
  const [scaleSaving, setScaleSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      if (data.length) setOfferingId(data[0].id);
    });
  }, []);

  function reload() {
    if (!offeringId) return;
    setAssignments(null);
    setMeta(null);
    setStudents(null);
    setHistory(null);
    setPage(0);
    setSearch("");
    setExpanded({});
    getReportAssignments(offeringId, period).then(setAssignments);
    getGeneratedReport(offeringId, period).then(({ meta, students }) => {
      setMeta(meta);
      setStudents(students);
    });
    listReportGenerations(offeringId).then(setHistory);
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, period]);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.studentName.toLowerCase().includes(q) || s.studentCode.toLowerCase().includes(q));
  }, [students, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  function openGenerate() {
    if (!assignments) return;
    setSelection(Object.fromEntries(assignments.map((a) => [a.id, a.includeInReport ? "grade" : "excluded"])));
    setGenerateOpen(true);
  }

  async function onGenerate() {
    if (!offeringId) return;
    setGenerating(true);
    setError(null);
    try {
      const picked = Object.entries(selection)
        .filter(([, mode]) => mode !== "excluded")
        .map(([assignmentId, mode]) => ({ assignmentId, mode: mode as AssignmentReportMode }));
      await generateMonthlyAcademicReport(offeringId, period, picked);
      setGenerateOpen(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the report — try again.");
    } finally {
      setGenerating(false);
    }
  }

  function openScale() {
    if (!offeringId) return;
    setScaleOpen(true);
    getGradeScale(offeringId).then(setScaleDraft);
  }

  function addBand() {
    setScaleDraft((d) => ({ ...d, bands: [...d.bands, { label: "", min: 0 }] }));
  }
  function updateBand(i: number, patch: Partial<GradeBand>) {
    setScaleDraft((d) => ({ ...d, bands: d.bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) }));
  }
  function removeBand(i: number) {
    setScaleDraft((d) => ({ ...d, bands: d.bands.filter((_, idx) => idx !== i) }));
  }

  async function onSaveScale() {
    if (!offeringId) return;
    setScaleSaving(true);
    try {
      const bands = [...scaleDraft.bands].sort((a, b) => b.min - a.min);
      await setGradeScale(offeringId, { ...scaleDraft, bands });
      setScaleOpen(false);
      reload();
    } catch {
      setError("Couldn't save the grade scale — try again.");
    } finally {
      setScaleSaving(false);
    }
  }

  function onExport() {
    if (!students || !meta) return;
    const rows: unknown[][] = [];
    for (const s of students) {
      for (const a of s.assignments) {
        rows.push([s.studentCode, s.studentName, formatGradeByScale(s.avgGrade, meta.gradeScale), a.title, a.status ?? "not logged", a.grade ?? "", a.comment ?? ""]);
      }
      if (s.assignments.length === 0) rows.push([s.studentCode, s.studentName, formatGradeByScale(s.avgGrade, meta.gradeScale), "", "", "", ""]);
    }
    rows.push([]);
    rows.push(["WEAK TOPICS"]);
    rows.push(["Student code", "Student", "Topic", "Materials"]);
    for (const s of students) {
      for (const t of s.weakTopics) {
        const materials = t.materials.map((m) => `${m.label?.trim() || m.kind}: ${m.link}${m.duration ? ` (${m.duration})` : ""}`).join(" | ");
        rows.push([s.studentCode, s.studentName, t.label, materials]);
      }
    }
    rows.push([]);
    rows.push(["ASSISTANT COMMENTS"]);
    rows.push(["Student code", "Student", "Comment"]);
    for (const s of students) rows.push([s.studentCode, s.studentName, s.assistantComment]);

    downloadCsv(`academic-report-${period}`, ["Student code", "Student", "Avg grade", "Assignment", "Status", "Grade", "Comment"], rows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Report</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Monthly reports</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              Generate a snapshot of assignments, weak topics and comments for {periodLabel(period)}.
            </p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-[8px]">
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
              {...pickerOnlyDateProps}
              className="h-10 cursor-pointer rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
            />
            <button
              onClick={openScale}
              disabled={!offeringId}
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              <Icon name="chart" size={16} />
              Grade scale
            </button>
            <button
              onClick={onExport}
              disabled={!students || students.length === 0}
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              <Icon name="file-up" size={16} />
              Export CSV
            </button>
            <a
              href={`/report-print?offeringId=${offeringId}&period=${period}`}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!meta}
              onClick={(e) => !meta && e.preventDefault()}
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] aria-disabled:pointer-events-none aria-disabled:opacity-60"
            >
              <Icon name="file-up" size={16} />
              Print / PDF
            </a>
            <button
              onClick={openGenerate}
              disabled={!offeringId || assignments === null}
              className="flex h-10 flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[14px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
            >
              <Icon name="check" size={16} />
              {meta ? "Re-generate" : "Generate report"}
            </button>
          </div>
        </div>

        {!!history?.length && (
          <div className="mt-[13px] flex flex-wrap items-center gap-[6px]">
            <span className="mr-[2px] text-[11.5px] font-semibold text-[var(--subtle)]">Previous months</span>
            {history.map((h) => (
              <button
                key={h.period}
                onClick={() => setPeriod(h.period)}
                className="rounded-full border px-[11px] py-[5px] text-[12px] font-semibold"
                style={
                  h.period === period
                    ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                }
              >
                {periodLabel(h.period)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      {!offerings ? (
        <SkeletonRow className="h-[120px]" />
      ) : offerings.length === 0 ? (
        <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[30px] text-center text-[13px] text-[var(--muted)]">
          No courses yet.
        </div>
      ) : students === null ? (
        Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[100px]" />)
      ) : !meta ? (
        <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[36px] text-center shadow-[var(--shadow)]">
          <div className="text-[14px] font-semibold text-[var(--text)]">No report generated for {periodLabel(period)} yet</div>
          <p className="m-0 mt-[6px] text-[13px] text-[var(--muted)]">Choose which assignments to include, then generate this month&apos;s report.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 min-w-[200px] max-w-[300px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
              <Icon name="search" size={16} className="text-[var(--subtle)]" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search students…"
                className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
              />
            </div>
            <span className="text-[12px] text-[var(--subtle)]">
              Generated {new Date(meta.createdAt).toLocaleString()}
              {meta.createdByName ? ` by ${meta.createdByName}` : ""}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {pageRows.length === 0 ? (
              <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[30px] text-center text-[13px] text-[var(--muted)]">
                No students match this search.
              </div>
            ) : (
              pageRows.map((s) => {
                const isOpen = !!expanded[s.studentId];
                return (
                  <div key={s.studentId} className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                    <div
                      onClick={() => setExpanded((prev) => ({ ...prev, [s.studentId]: !prev[s.studentId] }))}
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-[10px] p-[14px_18px]"
                    >
                      <div>
                        <div className="text-[14px] font-semibold text-[var(--text)]">{s.studentName}</div>
                        <div className="text-[11.5px] text-[var(--subtle)]">{s.studentCode}</div>
                      </div>
                      <div className="flex items-center gap-[14px]">
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-[0.03em] text-[var(--subtle)]">Avg grade</div>
                          <div className="font-mono text-[15px] font-bold text-[var(--text)]">{formatGradeByScale(s.avgGrade, meta.gradeScale)}</div>
                        </div>
                        <a
                          href={`/report-print?offeringId=${offeringId}&period=${period}&studentId=${s.studentId}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Print / Download PDF"
                          className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)]"
                        >
                          <Icon name="file-up" size={14} />
                        </a>
                        <Icon name="chevron-down" size={16} className="flex-none text-[var(--muted)]" style={{ transform: isOpen ? "none" : "rotate(-90deg)" }} />
                      </div>
                    </div>
                    {isOpen && (
                      <div className="flex flex-col gap-[14px] border-t border-[var(--border)] p-[14px_18px]">
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
                            <div className="text-[12.5px] text-[var(--muted)]">None approved this month.</div>
                          ) : (
                            <div className="flex flex-wrap gap-[6px]">
                              {s.weakTopics.map((t, i) => (
                                <span key={i} className="flex items-center gap-[8px] rounded-full bg-[var(--warns)] py-[4px] pl-[10px] pr-[10px] text-[12px] font-semibold text-[var(--warn)]">
                                  {t.label}
                                  {t.materials.map((m, j) => (
                                    <a key={j} href={m.link} target="_blank" rel="noreferrer" className="font-medium underline">
                                      {m.label?.trim() || (m.kind === "video" ? "Video" : "Document")}
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
                    )}
                  </div>
                );
              })
            )}
            {pageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-[10px]">
                <span className="text-[12px] text-[var(--subtle)]">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} students
                </span>
                <div className="flex flex-wrap gap-[5px]">
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
              </div>
            )}
          </div>
        </>
      )}

      {/* GENERATE MODAL */}
      {generateOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Generate report · {periodLabel(period)}</h3>
                <div className="text-[12px] text-[var(--muted)]">Choose how each assignment appears in the report</div>
              </div>
              <button onClick={() => setGenerateOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-col gap-[8px] overflow-y-auto p-[16px_18px]">
              {!assignments || assignments.length === 0 ? (
                <div className="text-[12.5px] text-[var(--muted)]">No assignments due this month.</div>
              ) : (
                assignments.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-[8px] rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] p-[9px_11px]">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text)]">{a.title}</span>
                    <div className="flex gap-[4px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-[2px]">
                      {(
                        [
                          ["excluded", "Excluded"],
                          ["status_only", "Status only"],
                          ["grade", "Status + grade"],
                        ] as const
                      ).map(([mode, label]) => (
                        <button
                          key={mode}
                          onClick={() => setSelection((prev) => ({ ...prev, [a.id]: mode }))}
                          className="rounded-[6px] px-[9px] py-[5px] text-[11.5px] font-semibold"
                          style={
                            (selection[a.id] ?? "excluded") === mode
                              ? { background: "var(--brand)", color: "var(--brandfg)" }
                              : { color: "var(--muted)" }
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setGenerateOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onGenerate}
                disabled={generating}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {generating ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GRADE SCALE MODAL */}
      {scaleOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[85vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[var(--rad)] bg-[var(--surface)] shadow-[var(--shadow-lg)]">
            <div className="flex items-center gap-3 border-b border-[var(--border2)] p-[16px_18px]">
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Grade scale</h3>
                <div className="text-[12px] text-[var(--muted)]">How each student&apos;s average grade is displayed</div>
              </div>
              <button onClick={() => setScaleOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto p-[16px_18px]">
              <div className="flex gap-[6px] rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] p-[3px]">
                {SCALE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setScaleDraft((d) => ({ ...d, scale: s }))}
                    className="h-9 flex-1 rounded-[8px] text-[12.5px] font-semibold capitalize"
                    style={scaleDraft.scale === s ? { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow)" } : { color: "var(--muted)" }}
                  >
                    {s === "numeric" ? "Numeric (9–1)" : s}
                  </button>
                ))}
              </div>

              {scaleDraft.scale !== "percentage" && (
                <div className="flex flex-col gap-[8px]">
                  <label className="text-[12.5px] font-semibold text-[var(--text)]">
                    Bands ({scaleDraft.scale === "numeric" ? "number" : "label"} + minimum %)
                  </label>
                  {scaleDraft.bands.map((b, i) => (
                    <div key={i} className="flex items-center gap-[8px]">
                      <input
                        value={b.label}
                        onChange={(e) => updateBand(i, { label: e.target.value })}
                        placeholder={scaleDraft.scale === "numeric" ? "9" : "A*"}
                        className="h-9 w-[70px] flex-none rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                      />
                      <input
                        type="number"
                        value={b.min}
                        onChange={(e) => updateBand(i, { min: Number(e.target.value) || 0 })}
                        placeholder="90"
                        className="h-9 flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                      />
                      <button onClick={() => removeBand(i)} className="flex h-9 w-9 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:text-[var(--danger)]">
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
                </div>
              )}
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setScaleOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onSaveScale}
                disabled={scaleSaving}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {scaleSaving ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
