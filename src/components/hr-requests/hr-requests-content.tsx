"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listAllStaffingRequests, type StaffingRequestDetail } from "@/lib/actions/hr";
import { resolveStaffingRequest } from "@/lib/actions/staff";

const KIND_META: Record<StaffingRequestDetail["kind"], { title: string; icon: "user-plus" | "x" | "users"; color: string }> = {
  add: { title: "New assistant requested", icon: "user-plus", color: "var(--brand)" },
  remove: { title: "Removal requested", icon: "x", color: "var(--danger)" },
  replace: { title: "Replacement requested", icon: "users", color: "var(--warn)" },
};

function statusBadge(status: string) {
  if (status === "approved") return { text: "Approved", icon: "check" as const, bg: "var(--oks)", fg: "var(--ok)" };
  if (status === "declined") return { text: "Declined", icon: "x" as const, bg: "var(--dangers)", fg: "var(--danger)" };
  return { text: "Pending", icon: "clock" as const, bg: "var(--warns)", fg: "var(--warn)" };
}

export function HrRequestsContent() {
  const [requests, setRequests] = useState<StaffingRequestDetail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setRequests(await listAllStaffingRequests());
      } catch {
        setError("Couldn't load staffing requests.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onAction(id: string, status: "approved" | "declined") {
    setResolvingId(id);
    try {
      await resolveStaffingRequest(id, status);
      setRequests((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, status } : r)) : prev));
    } catch {
      setError("Couldn't update this request — try again.");
    } finally {
      setResolvingId(null);
    }
  }

  const pendingCount = requests?.filter((r) => r.status === "pending").length ?? 0;
  const approvedCount = requests?.filter((r) => r.status === "approved").length ?? 0;
  const stats = [
    { value: String(pendingCount), label: "Pending review", color: "var(--warn)" },
    { value: String(approvedCount), label: "Approved", color: "var(--ok)" },
    { value: String(requests?.length ?? 0), label: "Total requests", color: "var(--text)" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">HR</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Staffing requests</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
          Add / remove / replace requests from course heads. Review the full details, then approve or decline.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {loading || !requests
            ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[56px]" />)
            : stats.map((s) => (
                <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[12px_14px]">
                  <div className="text-[20px] font-bold leading-[1.1] tracking-[-0.02em]" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="mt-[2px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
                </div>
              ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {loading && !requests ? (
          Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[70px]" />)
        ) : requests && requests.length === 0 ? (
          <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)]">
            No staffing requests yet.
          </div>
        ) : (
          requests?.map((r) => {
            const meta = KIND_META[r.kind];
            const badge = statusBadge(r.status);
            const expanded = !!open[r.id];
            const personName = r.candidateName ?? r.targetName ?? "—";
            return (
              <div key={r.id} className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="flex flex-wrap items-center gap-3 p-[14px_16px]">
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[var(--surface2)]" style={{ color: meta.color }}>
                    <Icon name={meta.icon} size={17} />
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">{meta.title}</div>
                    <div className="text-[12px] text-[var(--subtle)]">
                      Requested by {r.requestedByName ?? "—"} · {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className="inline-flex flex-none items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                    style={{ background: badge.bg, color: badge.fg }}
                  >
                    <Icon name={badge.icon} size={12} />
                    {badge.text}
                  </span>
                  <button
                    onClick={() => setOpen((p) => ({ ...p, [r.id]: !p[r.id] }))}
                    className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)]"
                  >
                    <Icon name="chevron-down" size={17} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
                  </button>
                </div>
                {expanded && (
                  <div className="flex flex-col gap-[13px] border-t border-[var(--border2)] bg-[var(--surface2)] p-[14px_16px]">
                    <div>
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
                        {r.kind === "add" ? "Candidate" : "Staff member"}
                      </div>
                      <div className="flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] p-[11px_13px]">
                        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                          {personName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div className="grid min-w-0 flex-1 grid-cols-2 gap-[6px_14px]">
                          <div className="col-span-2">
                            <div className="text-[14px] font-semibold text-[var(--text)]">{personName}</div>
                            <div className="text-[11.5px] text-[var(--subtle)]">{r.offeringLabel}</div>
                          </div>
                          {r.candidatePhone && (
                            <div>
                              <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">Phone</div>
                              <div className="font-mono text-[12.5px] text-[var(--text)]">{r.candidatePhone}</div>
                            </div>
                          )}
                          {r.candidateEmail && (
                            <div>
                              <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">Email</div>
                              <div className="truncate text-[12.5px] text-[var(--text)]">{r.candidateEmail}</div>
                            </div>
                          )}
                          {r.proposedDate && (
                            <div>
                              <div className="text-[10px] font-bold uppercase text-[var(--subtle)]">{r.kind === "remove" ? "Leave date" : "Proposed start"}</div>
                              <div className="text-[12.5px] text-[var(--text)]">{new Date(r.proposedDate).toLocaleDateString()}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {r.reason && (
                      <div>
                        <div className="mb-[5px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Reason</div>
                        <div className="text-[13px] leading-[1.5] text-[var(--text)]">{r.reason}</div>
                      </div>
                    )}
                    {r.status === "pending" ? (
                      <div className="flex gap-[9px]">
                        <button
                          onClick={() => onAction(r.id, "approved")}
                          disabled={resolvingId === r.id}
                          className="flex h-11 flex-1 items-center justify-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                        >
                          {resolvingId === r.id ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                          Approve
                        </button>
                        <button
                          onClick={() => onAction(r.id, "declined")}
                          disabled={resolvingId === r.id}
                          className="flex h-11 flex-1 items-center justify-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--danger)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] disabled:opacity-60"
                        >
                          <Icon name="x" size={15} />
                          Decline
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-[7px] text-[13px] font-semibold"
                        style={{ color: r.status === "approved" ? "var(--ok)" : "var(--danger)" }}
                      >
                        <Icon name="check" size={15} />
                        Request {r.status}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
