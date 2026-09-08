"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  getStaffCoursesForReport,
  generateStaffReport,
  listStaffReportHistory,
  type StaffReportCourseOption,
  type StaffReportHistoryEntry,
} from "@/lib/actions/staff-reports";
import { downloadBlob } from "@/lib/pdf-export";

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function StaffReportModal({ staffId, staffName, onClose }: { staffId: string; staffName: string; onClose: () => void }) {
  const [courses, setCourses] = useState<StaffReportCourseOption[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<StaffReportHistoryEntry[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [driveWarning, setDriveWarning] = useState<string | null>(null);

  async function reloadHistory() {
    setHistory(await listStaffReportHistory(staffId));
  }

  useEffect(() => {
    (async () => {
      const list = await getStaffCoursesForReport(staffId);
      setCourses(list);
      setSelected(list.map((c) => c.offeringId));
      await reloadHistory();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onGenerate() {
    if (!selected.length) return;
    setGenerating(true);
    setError(null);
    setDone(null);
    setDriveWarning(null);
    try {
      // The signed URL points straight at Supabase Storage — fetched
      // directly from the browser so a large merged PDF (contract + several
      // receipts) never has to round-trip through the Server Action itself.
      const { fileName, url, driveFolderUrl, driveError } = await generateStaffReport(staffId, selected);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Couldn't download the generated report — try again.");
      downloadBlob(await res.blob(), fileName);
      setDone(driveFolderUrl ? `Downloaded ${fileName} and sent it to Drive.` : `Downloaded ${fileName}.`);
      if (driveError) setDriveWarning(`Downloaded fine, but couldn't deliver to Drive: ${driveError}`);
      await reloadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the report — try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
      <div className="flex max-h-[85vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
        <div className="flex flex-none items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
            <Icon name="printer" size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Generate report — {staffName}</h3>
            <div className="text-[12px] text-[var(--muted)]">Contract, receipts, and pay/workload history for the course(s) you pick</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto p-[16px_18px]">
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-3 py-2 text-[12.5px] font-medium text-[var(--danger)]">
              {error}
              <button onClick={() => setError(null)} className="flex-none">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}
          {done && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--ok)] bg-[var(--oks)] px-3 py-2 text-[12.5px] font-medium text-[var(--ok)]">
              {done}
              <button onClick={() => setDone(null)} className="flex-none">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}
          {driveWarning && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--warn)] bg-[var(--warns)] px-3 py-2 text-[12.5px] font-medium text-[var(--warn)]">
              {driveWarning}
              <button onClick={() => setDriveWarning(null)} className="flex-none">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}

          <div>
            <div className="mb-[8px] text-[12.5px] font-semibold text-[var(--text)]">Courses to include</div>
            {courses === null ? (
              <div className="flex flex-col gap-[6px]">
                <SkeletonRow className="h-[36px]" />
                <SkeletonRow className="h-[36px]" />
              </div>
            ) : courses.length === 0 ? (
              <div className="rounded-[var(--rad-sm)] border border-dashed border-[var(--border)] p-[16px] text-center text-[12.5px] text-[var(--muted)]">
                No salary history found for this staff member yet.
              </div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {courses.map((c) => {
                  const isSel = selected.includes(c.offeringId);
                  return (
                    <label
                      key={c.offeringId}
                      className="flex cursor-pointer items-center gap-[10px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[9px_11px]"
                    >
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggle(c.offeringId)}
                        className="h-[17px] w-[17px] flex-none cursor-pointer accent-[var(--brand)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">{c.label}</div>
                        <div className="text-[11px] text-[var(--subtle)]">
                          {c.firstPeriod === c.lastPeriod ? c.firstPeriod : `${c.firstPeriod} – ${c.lastPeriod}`}
                        </div>
                      </div>
                      {!c.active && (
                        <span className="flex-none rounded-full bg-[var(--warns)] px-[8px] py-[3px] text-[10.5px] font-semibold text-[var(--warn)]">Left</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-[8px] text-[12.5px] font-semibold text-[var(--text)]">Past generations</div>
            {history === null ? (
              <SkeletonRow className="h-[36px]" />
            ) : history.length === 0 ? (
              <div className="rounded-[var(--rad-sm)] border border-dashed border-[var(--border)] p-[14px] text-center text-[12px] text-[var(--muted)]">
                No reports generated yet.
              </div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-[10px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[9px_11px]">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold text-[var(--text)]">
                        {new Date(h.generatedAt).toLocaleDateString()} · {h.monthYearFolder}
                        {h.generatedByName ? ` · ${h.generatedByName}` : ""}
                      </div>
                      <div className="text-[11px] text-[var(--subtle)]">
                        {h.periodsCovered.length ? h.periodsCovered.map(periodLabel).join(", ") : "No periods"}
                      </div>
                    </div>
                    {h.status === "ok" && h.driveFileUrl ? (
                      <a
                        href={h.driveFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-none rounded-[7px] bg-[var(--oks)] px-[9px] py-[5px] text-[11px] font-semibold text-[var(--ok)] hover:opacity-80"
                      >
                        Open in Drive
                      </a>
                    ) : (
                      <span
                        title={h.errorMessage ?? undefined}
                        className="flex-none rounded-[7px] bg-[var(--dangers)] px-[9px] py-[5px] text-[11px] font-semibold text-[var(--danger)]"
                      >
                        Drive failed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-none gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
          <button onClick={onClose} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
            Close
          </button>
          <button
            onClick={onGenerate}
            disabled={!selected.length || generating}
            className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            {generating ? <Spinner size={15} /> : <Icon name="printer" size={15} />}
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}
