"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { listDepartedStaff, type DepartedStaffMember } from "@/lib/actions/staff";
import { getDepartedStaffFinalMonthDetail, backfillDepartedSalaryLine, type DepartedStaffOffering } from "@/lib/actions/finance-salaries";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  hr: "HR",
  head: "Head",
  assistant: "Assistant",
  registration: "Registration",
  finance: "Finance",
};

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function tenureLabel(days: number | null) {
  if (days === null) return "Join date unknown";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `~${months} month${months === 1 ? "" : "s"}`;
  return `~${Math.round(months / 12)} years`;
}

function DepartedRow({ person }: { person: DepartedStaffMember }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<{ finalPeriod: string | null; offerings: DepartedStaffOffering[] } | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  function toggle() {
    setExpanded((v) => !v);
    if (!detail) getDepartedStaffFinalMonthDetail(person.id).then(setDetail);
  }

  async function onAdd(offering: DepartedStaffOffering) {
    const key = `${offering.offeringId}:${offering.period}`;
    setAddingId(key);
    try {
      await backfillDepartedSalaryLine(person.id, offering.offeringId, offering.period);
      setDetail(await getDepartedStaffFinalMonthDetail(person.id));
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="border-b border-[var(--border2)] last:border-b-0">
      <div onClick={toggle} className="flex flex-wrap items-center gap-3 p-[13px_16px] cursor-pointer hover:bg-[var(--surface2)]">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--surface2)] text-[12.5px] font-bold text-[var(--muted)]">
          {person.initials}
        </div>
        <div className="min-w-[160px] flex-1">
          <div className="text-[13.5px] font-semibold text-[var(--text)]">{person.name}</div>
          <div className="text-[11.5px] text-[var(--subtle)]">
            {ROLE_LABEL[person.role] ?? person.role} · {tenureLabel(person.tenureDays)}
          </div>
        </div>
        <div className="flex-none text-right text-[12px] text-[var(--muted)]">
          <div>Joined {person.hiredAt ?? "—"}</div>
          <div>Left {person.leftAt}</div>
        </div>
        <span
          className="inline-flex flex-none items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[11px] font-semibold"
          style={
            person.gaveNotice
              ? { background: "var(--oks)", color: "var(--ok)" }
              : { background: "var(--warns)", color: "var(--warn)" }
          }
        >
          {person.gaveNotice ? "Gave notice" : "No notice"}
        </span>
        <Icon name="chevron-down" size={16} className="flex-none text-[var(--subtle)]" style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
      </div>

      {expanded && (
        <div className="border-t border-[var(--border2)] bg-[var(--surface2)] p-[13px_16px]">
          {detail === null ? (
            <SkeletonRow className="h-[36px]" />
          ) : !detail.finalPeriod ? (
            <div className="text-[12.5px] text-[var(--muted)]">Couldn&apos;t determine their final month.</div>
          ) : detail.offerings.length === 0 ? (
            <div className="text-[12.5px] text-[var(--muted)]">
              No courses found with logged work for {periodLabel(detail.finalPeriod)} — they may not have checked any papers before leaving.
            </div>
          ) : (
            <div className="flex flex-col gap-[8px]">
              {detail.offerings.map((o) => {
                const key = `${o.offeringId}:${o.period}`;
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center gap-[10px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-[9px_11px]"
                  >
                    <div className="min-w-[140px] flex-1">
                      <div className="text-[12.5px] font-semibold text-[var(--text)]">{o.courseLabel}</div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">{periodLabel(o.period)}</div>
                    </div>
                    <span className="flex-none text-[12px] text-[var(--muted)]">
                      {o.papers} paper{o.papers === 1 ? "" : "s"} checked · {o.assignments} assignment{o.assignments === 1 ? "" : "s"} due
                    </span>
                    {o.hasSalaryLine ? (
                      <span className="flex flex-none items-center gap-[5px] rounded-[7px] bg-[var(--oks)] px-[9px] py-[6px] text-[11.5px] font-semibold text-[var(--ok)]">
                        <Icon name="check2" size={12} />
                        Already in Salaries
                      </span>
                    ) : (
                      <button
                        onClick={() => onAdd(o)}
                        disabled={addingId === key}
                        className="flex flex-none items-center gap-[6px] rounded-[7px] bg-[var(--brand)] px-[10px] py-[6px] text-[11.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                      >
                        {addingId === key ? <Spinner size={12} /> : <Icon name="plus" size={12} />}
                        Add to Salaries
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DepartedStaffPanel({ onClose }: { onClose: () => void }) {
  const [people, setPeople] = useState<DepartedStaffMember[] | null>(null);

  useEffect(() => {
    listDepartedStaff().then(setPeople);
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
      <div className="flex max-h-[85vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
        <div className="flex flex-none items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--dangers)] text-[var(--danger)]">
            <Icon name="logout" size={19} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Departed staff</h3>
            <div className="text-[12px] text-[var(--muted)]">Join/leave history, notice status, and final-month pay</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {people === null ? (
            <div className="flex flex-col gap-2 p-[16px_18px]">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} className="h-[54px]" />
              ))}
            </div>
          ) : people.length === 0 ? (
            <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No one has left yet.</div>
          ) : (
            people.map((p) => <DepartedRow key={p.id} person={p} />)
          )}
        </div>
      </div>
    </div>
  );
}
