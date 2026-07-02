"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { listActivityLog, type ActivityLogRow } from "@/lib/actions/activity-log";
import { ACTIVITY_CATEGORIES, type ActivityCategory } from "@/lib/activity-categories";

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  staff: "Staff",
  students: "Students",
  payments: "Payments",
  assignments: "Assignments",
  attendance: "Attendance",
  requests: "Requests",
};

const CATEGORY_ICON: Record<ActivityCategory, "users" | "grad" | "wallet" | "clipboard-list" | "cal-check" | "inbox"> = {
  staff: "users",
  students: "grad",
  payments: "wallet",
  assignments: "clipboard-list",
  attendance: "cal-check",
  requests: "inbox",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function HistoryContent() {
  const [log, setLog] = useState<ActivityLogRow[] | null>(null);
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listActivityLog(filter === "all" ? undefined : filter)
      .then(setLog)
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Admin</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Activity history</h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">Every logged action across your org, last 30 days.</p>

        <div className="mt-[15px] flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("all")}
            className="flex flex-none items-center gap-[7px] rounded-full border px-[14px] py-2 text-[13px] font-semibold"
            style={
              filter === "all"
                ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
            }
          >
            All
          </button>
          {ACTIVITY_CATEGORIES.map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className="flex flex-none items-center gap-[7px] rounded-full border px-[14px] py-2 text-[13px] font-semibold"
                style={
                  active
                    ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                }
              >
                <Icon name={CATEGORY_ICON[c]} size={13} />
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>
      </div>

      <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {loading ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} className="h-[46px]" />
            ))}
          </div>
        ) : !log || log.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No activity logged in the last 30 days.</div>
        ) : (
          log.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 border-b border-[var(--border2)] px-[18px] py-[12px] last:border-b-0">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--surface2)] text-[var(--muted)]">
                <Icon name={CATEGORY_ICON[entry.category]} size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-medium text-[var(--text)]">{entry.summary}</div>
                <div className="text-[11.5px] text-[var(--subtle)]">{entry.actorName}</div>
              </div>
              <span className="flex-none text-[11.5px] text-[var(--subtle)]">{timeAgo(entry.createdAt)}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
