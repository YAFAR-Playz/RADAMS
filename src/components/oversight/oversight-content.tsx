"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { toneColors } from "@/lib/tone";
import { statusDef } from "@/lib/assignments-data";
import { mockOversightOfferings, trackInfo, type OversightAssistant } from "@/lib/oversight-data";

const COMMENTS_PAGE_SIZE = 10;

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[6px] overflow-hidden rounded-full bg-[var(--surface2)]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function AssistantRow({
  assistant,
  expanded,
  onToggle,
  commentPage,
  onCommentPage,
}: {
  assistant: OversightAssistant;
  expanded: boolean;
  onToggle: () => void;
  commentPage: number;
  onCommentPage: (page: number) => void;
}) {
  const pct = Math.round((assistant.sent / assistant.total) * 100);
  const track = trackInfo(pct);
  const trackColors = toneColors(track.tone);
  const pending = assistant.total - assistant.sent;

  const sortedComments = useMemo(
    () => assistant.comments.slice().sort((a, b) => a.student.localeCompare(b.student)),
    [assistant.comments]
  );
  const pageCount = Math.max(1, Math.ceil(sortedComments.length / COMMENTS_PAGE_SIZE));
  const page = Math.min(commentPage, pageCount - 1);
  const pageStart = page * COMMENTS_PAGE_SIZE;
  const pageComments = expanded ? sortedComments.slice(pageStart, pageStart + COMMENTS_PAGE_SIZE) : [];

  return (
    <div className="border-b border-[var(--border2)]">
      <div
        onClick={onToggle}
        className="flex flex-wrap items-center gap-[14px] p-[14px_18px] cursor-pointer hover:bg-[var(--surface2)]"
      >
        <div className="flex min-w-[170px] flex-1 items-center gap-[11px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
            {assistant.initials}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[var(--text)]">{assistant.name}</div>
            <div className="text-[12px] text-[var(--subtle)]">{assistant.students} students</div>
          </div>
        </div>
        <div className="flex min-w-[200px] flex-1 items-center gap-3">
          <div className="min-w-[90px] flex-1">
            <div className="mb-[5px] flex justify-between">
              <span className="text-[11.5px] font-medium text-[var(--muted)]">Messages</span>
              <span className="text-[12px] font-bold text-[var(--text)]">
                {assistant.sent}/{assistant.total}
              </span>
            </div>
            <ProgressBar pct={pct} color={trackColors.fg} />
          </div>
          <span className="inline-flex flex-none items-center gap-[5px] rounded-full bg-[var(--warns)] px-[9px] py-[4px] text-[11.5px] font-semibold text-[var(--warn)]">
            <Icon name="clock" size={12} />
            {pending} pending
          </span>
        </div>
        <span
          className="inline-flex flex-none items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
          style={{ background: trackColors.bg, color: trackColors.fg }}
        >
          <Icon name={track.icon} size={13} />
          {track.text}
        </span>
        <button className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-[7px] text-[12.5px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]">
          <Icon name="chevron-down" size={14} style={{ transform: expanded ? "rotate(180deg)" : "none" }} />
          {expanded ? "Hide" : "Comments"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border2)] bg-[var(--surface2)] py-[6px]">
          {pageComments.map((c) => {
            const def = statusDef(c.status);
            const { bg, fg } = def ? toneColors(def.tone) : { bg: "var(--surface2)", fg: "var(--muted)" };
            return (
              <div
                key={c.student + c.assignment}
                className="flex flex-wrap items-center gap-[11px] border-t border-[var(--border2)] p-[11px_18px]"
              >
                <div className="flex w-[160px] flex-none items-center gap-[9px]">
                  <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10.5px] font-bold text-[var(--muted)]">
                    {c.initials}
                  </div>
                  <div className="min-w-0">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[var(--text)]">
                      {c.student}
                    </div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--subtle)]">
                      {c.assignment}
                    </div>
                  </div>
                </div>
                <span
                  className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold"
                  style={{ background: bg, color: fg }}
                >
                  <Icon name={def ? def.icon : "clock"} size={12} />
                  {def ? def.label : "Unknown"}
                </span>
                <span className="w-[38px] flex-none text-[12.5px] font-bold text-[var(--text)]">{c.grade || "—"}</span>
                <span className="min-w-[150px] flex-1 text-[12.5px] leading-[1.4] text-[var(--muted)]">
                  {c.comment || "No comment yet"}
                </span>
                <span
                  className="inline-flex flex-none items-center gap-[5px] text-[11.5px] font-semibold"
                  style={{ color: c.sent ? "var(--ok)" : "var(--warn)" }}
                >
                  <Icon name={c.sent ? "check2" : "clock"} size={13} />
                  {c.sent ? "Sent" : "Pending"}
                </span>
              </div>
            );
          })}
          {sortedComments.length > COMMENTS_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[9px_18px]">
              <span className="text-[11.5px] text-[var(--subtle)]">
                {pageStart + 1}–{Math.min(pageStart + COMMENTS_PAGE_SIZE, sortedComments.length)} of {sortedComments.length}
              </span>
              <div className="flex gap-[5px]">
                {Array.from({ length: pageCount }, (_, i) => i).map((i) => {
                  const active = i === page;
                  return (
                    <button
                      key={i}
                      onClick={() => onCommentPage(i)}
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
      )}
    </div>
  );
}

export function OversightContent() {
  const offerings = useMemo(() => mockOversightOfferings(), []);
  const [offeringIndex, setOfferingIndex] = useState(0);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [commentPages, setCommentPages] = useState<Record<number, number>>({});

  const current = offerings[offeringIndex];
  const totalSent = current.assistants.reduce((sum, a) => sum + a.sent, 0);
  const totalMessages = current.assistants.reduce((sum, a) => sum + a.total, 0);
  const pending = totalMessages - totalSent;
  const completion = totalMessages ? Math.round((totalSent / totalMessages) * 100) : 0;

  const stats = [
    { value: String(current.assistants.length), label: "Assistants", color: "var(--text)" },
    { value: String(totalSent), label: "Messages sent", color: "var(--ok)" },
    { value: String(pending), label: "Pending", color: "var(--warn)" },
    { value: `${completion}%`, label: "Completion", color: "var(--brand)" },
  ];

  function selectOffering(i: number) {
    setOfferingIndex(i);
    setOpen({});
    setCommentPages({});
  }

  function toggleAssistant(id: number) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER CARD */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">
          Course oversight
        </div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
          Assistant message tracking
        </h1>
        <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
          Switch between your course offerings and drill into any assistant&apos;s logged comments.
        </p>

        <div className="mt-[15px] flex flex-wrap items-center gap-2">
          <span className="mr-[2px] flex-none text-[12.5px] font-semibold text-[var(--muted)]">Offering</span>
          {offerings.map((o, i) => {
            const active = i === offeringIndex;
            return (
              <button
                key={o.label}
                onClick={() => selectOffering(i)}
                className="flex flex-none items-center gap-[7px] rounded-full border px-[14px] py-2 text-[13px] font-semibold"
                style={
                  active
                    ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                }
              >
                <span
                  className="h-[7px] w-[7px] rounded-full"
                  style={{ background: active ? "var(--brandfg)" : "var(--subtle)" }}
                />
                {o.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[13px_14px]">
              <div className="text-[23px] font-bold leading-[1.1] tracking-[-0.02em]" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="mt-[3px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ASSISTANTS */}
      <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <header className="flex items-center justify-between border-b border-[var(--border2)] p-[15px_18px]">
          <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Assistants · messages sent vs pending</h3>
          <span className="text-[12.5px] text-[var(--subtle)]">{current.label}</span>
        </header>
        {current.assistants.map((a) => (
          <AssistantRow
            key={a.id}
            assistant={a}
            expanded={!!open[a.id]}
            onToggle={() => toggleAssistant(a.id)}
            commentPage={commentPages[a.id] ?? 0}
            onCommentPage={(page) => setCommentPages((prev) => ({ ...prev, [a.id]: page }))}
          />
        ))}
      </section>
    </div>
  );
}
