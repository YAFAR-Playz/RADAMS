"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import type { AttendanceStatus } from "@/lib/actions/attendance";
import { getOfferingAttendanceIdRoster, commitAttendanceImport, type AttendanceIdRosterEntry } from "@/lib/actions/attendance-import";
import { getAttendanceThresholds } from "@/lib/actions/payroll-settings";
import { parseZoomAttendanceCsv, guessAttendanceStatus } from "@/lib/zoom-attendance-parser";

const STATUS_LABEL: Record<AttendanceStatus, string> = { present: "Present", late: "Late", absent: "Absent" };

// Unmatched rows get an explicit Skip / Search-for-student choice rather
// than one long dropdown listing every unmatched roster student — with a
// few hundred students that dropdown becomes unusable, and defaulting
// straight to "skip" with no chance to confirm made it easy to miss a real
// person who just didn't have an id extracted from the sheet.
function MatchPicker({
  roster,
  usedStudentIds,
  onPick,
}: {
  roster: AttendanceIdRosterEntry[];
  usedStudentIds: Set<string>;
  onPick: (studentId: string) => void;
}) {
  const [mode, setMode] = useState<"choice" | "search" | "skipped">("choice");
  const [query, setQuery] = useState("");

  if (mode === "skipped") {
    return (
      <div className="flex items-center gap-[8px] text-[12px] text-[var(--subtle)]">
        Skipped
        <button type="button" onClick={() => setMode("choice")} className="font-semibold underline">
          Change
        </button>
      </div>
    );
  }

  if (mode === "search") {
    const available = roster.filter((x) => !usedStudentIds.has(x.studentId));
    const q = query.trim().toLowerCase();
    const results = (q ? available.filter((x) => x.name.toLowerCase().includes(q)) : available).slice(0, 6);
    return (
      <div className="relative w-full max-w-[220px]">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a student name…"
          className="h-9 w-full rounded-[8px] border border-[var(--brand)] bg-[var(--surface)] px-[9px] text-[12.5px] text-[var(--text)] outline-none"
        />
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-[180px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_20px_rgba(8,12,22,.18)]">
          {results.length === 0 ? (
            <div className="p-[9px] text-[12px] text-[var(--subtle)]">No matches</div>
          ) : (
            results.map((x) => (
              <button
                key={x.studentId}
                type="button"
                onClick={() => onPick(x.studentId)}
                className="flex w-full items-center px-[9px] py-[7px] text-left text-[12.5px] text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                {x.name}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              setMode("choice");
              setQuery("");
            }}
            className="w-full border-t border-[var(--border2)] px-[9px] py-[7px] text-left text-[11.5px] text-[var(--subtle)] hover:bg-[var(--surface2)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-[6px]">
      <button
        type="button"
        onClick={() => setMode("skipped")}
        className="h-9 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[9px] text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)]"
      >
        Skip
      </button>
      <button
        type="button"
        onClick={() => setMode("search")}
        className="h-9 flex-1 rounded-[8px] border border-[var(--warn)] bg-[var(--warns)] px-[9px] text-[12px] font-semibold text-[var(--text)]"
      >
        Search for student
      </button>
    </div>
  );
}

type ReviewRow = {
  key: string;
  name: string;
  email: string;
  minutesAttended: number;
  extractedId: string | null;
  studentId: string | null;
  status: AttendanceStatus;
};

export function ImportAttendanceModal({
  sessionId,
  offeringId,
  sessionTitle,
  onClose,
  onImported,
}: {
  sessionId: string;
  offeringId: string;
  sessionTitle: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [roster, setRoster] = useState<AttendanceIdRosterEntry[] | null>(null);
  const [committing, setCommitting] = useState(false);
  const [committedCount, setCommittedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileSelected(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file - export it directly from Zoom's Attendee Report.");
      return;
    }
    setFileName(file.name);

    try {
      const [rosterList, thresholds] = await Promise.all([
        roster ?? getOfferingAttendanceIdRoster(offeringId),
        getAttendanceThresholds(),
      ]);
      setRoster(rosterList);
      const byAttendanceId = new Map(rosterList.filter((r) => r.attendanceId).map((r) => [r.attendanceId as string, r]));

      const text = await file.text();
      const parsed = parseZoomAttendanceCsv(text);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      const usedStudentIds = new Set<string>();
      const reviewRows: ReviewRow[] = parsed.attendees.map((a) => {
        const match = a.extractedId ? byAttendanceId.get(a.extractedId) : undefined;
        if (match) usedStudentIds.add(match.studentId);
        return {
          key: a.email,
          name: a.name,
          email: a.email,
          minutesAttended: a.minutesAttended,
          extractedId: a.extractedId,
          studentId: match?.studentId ?? null,
          status: guessAttendanceStatus(a.minutesAttended, parsed.durationMinutes, thresholds.presentPct, thresholds.latePct),
        };
      });
      setDurationMinutes(parsed.durationMinutes);
      setRows(reviewRows);
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read this file - try again.");
    }
  }

  function setRowStatus(key: string, status: AttendanceStatus) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, status } : r)));
  }

  function setRowStudent(key: string, studentId: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, studentId: studentId || null } : r)));
  }

  const usedStudentIds = new Set(rows.filter((r) => r.studentId).map((r) => r.studentId as string));
  const matchedCount = rows.filter((r) => r.studentId).length;

  async function onCommit() {
    const entries = rows.filter((r) => r.studentId).map((r) => ({ studentId: r.studentId as string, status: r.status }));
    setCommitting(true);
    try {
      await commitAttendanceImport(sessionId, entries);
      setCommittedCount(entries.length);
      setStep("done");
      onImported();
    } catch {
      setError("Couldn't import attendance - try again.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
      <div className="flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
        <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
            <Icon name="file-up" size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Import attendance</h3>
            <div className="truncate text-[12px] text-[var(--muted)]">{sessionTitle}</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        {error && (
          <div className="m-[14px_18px_0] flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
            {error}
            <button onClick={() => setError(null)} className="flex-none">
              <Icon name="x" size={16} />
            </button>
          </div>
        )}

        {step === "upload" && (
          <div className="p-[18px]">
            <p className="m-0 mb-[14px] text-[13px] leading-[1.5] text-[var(--muted)]">
              Upload the Zoom &quot;Attendee Report&quot; CSV for this session. Students are matched by the Attendance ID stored on
              their profile - anyone without a match can be picked manually before you confirm.
            </p>
            <div className="flex flex-col items-center gap-[10px] rounded-[var(--rad)] border-2 border-dashed border-[var(--border)] bg-[var(--surface2)] p-[34px_20px] text-center">
              <div className="flex h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="upload" size={24} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[var(--text)]">{fileName || "Drag & drop your file here"}</div>
                <div className="mt-[2px] text-[12.5px] text-[var(--muted)]">Zoom Attendee Report CSV</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFileSelected(f);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-4 py-[9px] text-[13px] font-semibold text-[var(--brandfg)]"
              >
                <Icon name="file-up" size={15} />
                Browse files
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <>
            <div className="flex flex-wrap items-center gap-[10px_18px] border-b border-[var(--border2)] p-[12px_18px] text-[12.5px] text-[var(--muted)]">
              <span>
                Session length: <span className="font-semibold text-[var(--text)]">{durationMinutes} min</span>
              </span>
              <span>
                Matched: <span className="font-semibold" style={{ color: "var(--ok)" }}>{matchedCount}</span> / {rows.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="hidden items-center gap-[10px] border-b border-[var(--border2)] p-[10px_18px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)] sm:flex">
                <span className="min-w-0 flex-[1.3_1_150px]">Attendee</span>
                <span className="w-[80px] flex-none">Minutes</span>
                <span className="min-w-0 flex-[1.2_1_160px]">Matched student</span>
                <span className="w-[110px] flex-none">Status</span>
              </div>
              {rows.map((r) => (
                <div key={r.key} className="flex flex-wrap items-center gap-[8px_10px] border-b border-[var(--border2)] p-[10px_18px]">
                  <div className="min-w-0 flex-[1.3_1_150px]">
                    <div className="truncate text-[13px] font-semibold text-[var(--text)]">{r.name}</div>
                    <div className="truncate text-[11.5px] text-[var(--subtle)]">
                      {r.email}
                      {r.extractedId ? ` · ID ${r.extractedId}` : " · no ID found"}
                    </div>
                  </div>
                  <span className="w-[80px] flex-none font-mono text-[13px] text-[var(--muted)]">{r.minutesAttended}</span>
                  <div className="min-w-0 flex-[1.2_1_160px]">
                    {r.studentId && roster?.find((x) => x.studentId === r.studentId) ? (
                      <span className="flex items-center gap-[6px] truncate text-[12.5px] font-semibold" style={{ color: "var(--brand)" }}>
                        <Icon name="user-check" size={14} />
                        {roster.find((x) => x.studentId === r.studentId)?.name}
                      </span>
                    ) : (
                      <MatchPicker roster={roster ?? []} usedStudentIds={usedStudentIds} onPick={(studentId) => setRowStudent(r.key, studentId)} />
                    )}
                  </div>
                  <select
                    value={r.status}
                    onChange={(e) => setRowStatus(r.key, e.target.value as AttendanceStatus)}
                    disabled={!r.studentId}
                    className="h-9 w-[110px] flex-none rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[9px] text-[12.5px] font-medium text-[var(--text)] outline-none disabled:opacity-50"
                  >
                    {(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={onClose} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onCommit}
                disabled={committing || matchedCount === 0}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {committing ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                Import {matchedCount} student{matchedCount === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-[14px] p-[34px_24px] text-center">
            <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-[var(--oks)] text-[var(--ok)]">
              <Icon name="check" size={30} />
            </div>
            <div>
              <h2 className="m-0 mb-[6px] text-[19px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                Attendance imported for {committedCount} student{committedCount === 1 ? "" : "s"}
              </h2>
              <p className="m-0 text-[13.5px] text-[var(--muted)]">Anyone not in the file keeps their current status.</p>
            </div>
            <button onClick={onClose} className="mt-1 flex items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]">
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
