"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { getAssistantWorkloads, setAssistantMaxStudents, autoAssignUnassigned, type AssistantWorkload } from "@/lib/actions/assistant-groups";

export function AutoAssignModal({
  offeringId,
  unassignedCount,
  onClose,
  onDone,
}: {
  offeringId: string;
  unassignedCount: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [workloads, setWorkloads] = useState<AssistantWorkload[] | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [maxDrafts, setMaxDrafts] = useState<Record<string, string>>({});
  const [strategy, setStrategy] = useState<"equal" | "alpha">("equal");
  const [savingMax, setSavingMax] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAssistantWorkloads(offeringId).then((data) => {
      setWorkloads(data);
      setSelected(Object.fromEntries(data.map((w) => [w.id, true])));
      setMaxDrafts(Object.fromEntries(data.map((w) => [w.id, w.maxStudents == null ? "" : String(w.maxStudents)])));
    });
  }, [offeringId]);

  async function onSaveMax(assistantId: string) {
    setSavingMax(assistantId);
    try {
      const raw = maxDrafts[assistantId] ?? "";
      const parsed = raw.trim() === "" ? null : Math.max(0, Math.round(Number(raw)));
      await setAssistantMaxStudents(offeringId, assistantId, parsed);
      setWorkloads((prev) => prev?.map((w) => (w.id === assistantId ? { ...w, maxStudents: parsed } : w)) ?? null);
    } catch {
      setError("Couldn't save that cap — try again.");
    } finally {
      setSavingMax(null);
    }
  }

  async function onRun() {
    setRunning(true);
    try {
      const includeIds = Object.entries(selected)
        .filter(([, v]) => v)
        .map(([k]) => k);
      await autoAssignUnassigned(offeringId, strategy, includeIds);
      onDone();
    } catch {
      setError("Couldn't auto-assign students — try again.");
    } finally {
      setRunning(false);
    }
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
      <div className="flex max-h-[88vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
        <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
            <Icon name="users" size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Auto-assign students</h3>
            <div className="text-[12px] text-[var(--muted)]">{unassignedCount} students not yet assigned to an assistant</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
            <Icon name="x" size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-[18px] mt-[14px] rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-[12px] py-[8px] text-[12px] font-medium text-[var(--danger)]">
            {error}
          </div>
        )}

        <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto p-[16px_18px]">
          <div>
            <div className="mb-[8px] text-[12.5px] font-semibold text-[var(--text)]">Distribution method</div>
            <div className="flex gap-[6px] rounded-[10px] border border-[var(--border)] bg-[var(--surface2)] p-[3px]">
              {(["equal", "alpha"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  className="h-9 flex-1 rounded-[8px] text-[12.5px] font-semibold"
                  style={strategy === s ? { background: "var(--surface)", color: "var(--text)", boxShadow: "var(--shadow)" } : { color: "var(--muted)" }}
                >
                  {s === "equal" ? "Equal (round-robin)" : "Alphabetical blocks"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-[8px] flex items-center justify-between text-[12.5px] font-semibold text-[var(--text)]">
              Include assistants
              <span className="font-normal text-[var(--subtle)]">{selectedCount} selected</span>
            </div>
            {workloads === null ? (
              <SkeletonRow className="h-[80px]" />
            ) : workloads.length === 0 ? (
              <div className="text-[12.5px] text-[var(--subtle)]">No assistants on this course yet.</div>
            ) : (
              <div className="flex flex-col gap-[6px]">
                {workloads.map((w) => {
                  const remaining = w.maxStudents == null ? null : Math.max(0, w.maxStudents - w.currentCount);
                  return (
                    <div key={w.id} className="flex items-center gap-[8px] rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] p-[9px_10px]">
                      <input
                        type="checkbox"
                        checked={!!selected[w.id]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [w.id]: e.target.checked }))}
                        className="h-[17px] w-[17px] flex-none cursor-pointer accent-[var(--brand)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-[var(--text)]">{w.name}</div>
                        <div className="text-[11px] text-[var(--subtle)]">
                          {w.currentCount} assigned{remaining != null ? ` · ${remaining} spot${remaining === 1 ? "" : "s"} left` : ""}
                        </div>
                      </div>
                      <input
                        key={`max-${w.id}-${w.maxStudents}`}
                        type="number"
                        min={0}
                        defaultValue={w.maxStudents ?? ""}
                        placeholder="No cap"
                        onChange={(e) => setMaxDrafts((prev) => ({ ...prev, [w.id]: e.target.value }))}
                        onBlur={() => onSaveMax(w.id)}
                        title="Max students for this course"
                        className="h-9 w-[84px] flex-none rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[8px] text-center text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                      />
                      {savingMax === w.id && <Spinner size={12} className="flex-none text-[var(--subtle)]" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
          <button
            onClick={onClose}
            className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
          >
            Cancel
          </button>
          <button
            onClick={onRun}
            disabled={running || selectedCount === 0}
            className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            {running ? <Spinner size={15} /> : <Icon name="check" size={15} />}
            Assign {unassignedCount} students
          </button>
        </div>
      </div>
    </div>
  );
}
