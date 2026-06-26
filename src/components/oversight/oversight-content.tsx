"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { toneColors } from "@/lib/tone";
import { statusDef, STATUS_DEFS, type AssignmentStatus } from "@/lib/assignments-data";
import { trackInfo } from "@/lib/oversight-data";
import {
  listHeadOfferings,
  getOversightSummary,
  getAssistantComments,
  type OfferingOption,
  type AssistantSummary,
  type OversightStats,
  type OversightComment,
} from "@/lib/actions/oversight";
import { setStatus, setGrade, setComment } from "@/lib/actions/assignments";

const COMMENTS_PAGE_SIZE = 10;

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[6px] overflow-hidden rounded-full bg-[var(--surface2)]">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function AssistantRow({
  assistant,
  offeringId,
  expanded,
  onToggle,
}: {
  assistant: AssistantSummary;
  offeringId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pct = assistant.total ? Math.round((assistant.sent / assistant.total) * 100) : 0;
  const track = trackInfo(pct);
  const trackColors = toneColors(track.tone);
  const pending = assistant.total - assistant.sent;

  const [comments, setComments] = useState<OversightComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ status: string; grade: string; comment: string }>({ status: "", grade: "", comment: "" });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  async function reloadComments() {
    setComments(await getAssistantComments(offeringId, assistant.id));
  }

  useEffect(() => {
    (async () => {
      if (!expanded || comments !== null) return;
      setLoading(true);
      try {
        await reloadComments();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, comments, offeringId, assistant.id]);

  function keyOf(c: OversightComment) {
    return `${c.assignmentId}:${c.studentId}`;
  }

  function startEdit(c: OversightComment) {
    setEditingKey(keyOf(c));
    setDraft({ status: c.status ?? "", grade: c.grade ?? "", comment: c.comment ?? "" });
    setEditError(null);
  }

  async function saveEdit(c: OversightComment) {
    const key = keyOf(c);
    setSavingKey(key);
    setEditError(null);
    try {
      await Promise.all([
        setStatus(c.assignmentId, c.studentId, (draft.status || null) as AssignmentStatus | null),
        setGrade(c.assignmentId, c.studentId, draft.grade),
        setComment(c.assignmentId, c.studentId, draft.comment),
      ]);
      await reloadComments();
      setEditingKey(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Couldn't save this override — try again.");
    } finally {
      setSavingKey(null);
    }
  }

  const pageCount = Math.max(1, Math.ceil((comments?.length ?? 0) / COMMENTS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * COMMENTS_PAGE_SIZE;
  const pageComments = (comments ?? []).slice(pageStart, pageStart + COMMENTS_PAGE_SIZE);

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
          {loading ? (
            <div className="flex flex-col gap-2 p-[11px_18px]">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} className="h-[40px]" />
              ))}
            </div>
          ) : pageComments.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-[18px] text-[12.5px] text-[var(--subtle)]">
              <Icon name="check2" size={14} />
              No logged comments yet for this assistant.
            </div>
          ) : (
            pageComments.map((c) => {
              const def = statusDef(c.status);
              const { bg, fg } = def ? toneColors(def.tone) : { bg: "var(--surface2)", fg: "var(--muted)" };
              const key = keyOf(c);
              const isEditing = editingKey === key;
              const showGrade = c.template === "grade" || c.template === "rubric";
              return (
                <div key={key} className="border-t border-[var(--border2)]">
                  <div className="flex flex-wrap items-center gap-[11px] p-[11px_18px]">
                    <div className="flex w-[160px] flex-none items-center gap-[9px]">
                      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[10.5px] font-bold text-[var(--muted)]">
                        {c.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-[var(--text)]">
                          {c.studentName}
                        </div>
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--subtle)]">
                          {c.assignment}
                        </div>
                      </div>
                    </div>
                    {!isEditing && (
                      <>
                        <span
                          className="inline-flex flex-none items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold"
                          style={{ background: bg, color: fg }}
                        >
                          <Icon name={def ? def.icon : "clock"} size={12} />
                          {def ? def.label : "Not logged"}
                        </span>
                        {showGrade && <span className="w-[38px] flex-none text-[12.5px] font-bold text-[var(--text)]">{c.grade || "—"}</span>}
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
                        <button
                          onClick={() => startEdit(c)}
                          title="Override this entry"
                          className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)] hover:bg-[var(--brands)] hover:text-[var(--brand)]"
                        >
                          <Icon name="settings" size={13} />
                        </button>
                      </>
                    )}
                    {isEditing && (
                      <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-[8px]">
                        <select
                          value={draft.status}
                          onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                          className="h-8 flex-none rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] font-semibold text-[var(--text)] outline-none"
                        >
                          <option value="">Not logged</option>
                          {STATUS_DEFS.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        {showGrade && (
                          <input
                            value={draft.grade}
                            onChange={(e) => setDraft((d) => ({ ...d, grade: e.target.value }))}
                            placeholder={c.lettered ? "Letter" : `/${c.maxMarks}`}
                            className="h-8 w-[64px] flex-none rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2 text-center text-[12px] font-semibold text-[var(--text)] outline-none"
                          />
                        )}
                        <input
                          value={draft.comment}
                          onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))}
                          placeholder="Comment"
                          className="h-8 min-w-[140px] flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-2 text-[12px] text-[var(--text)] outline-none"
                        />
                        <button
                          onClick={() => saveEdit(c)}
                          disabled={savingKey === key}
                          className="flex h-8 flex-none items-center gap-[5px] rounded-[7px] bg-[var(--brand)] px-[10px] text-[12px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                        >
                          {savingKey === key ? <Spinner size={12} /> : <Icon name="check" size={12} />}
                          Save
                        </button>
                        <button
                          onClick={() => setEditingKey(null)}
                          disabled={savingKey === key}
                          className="flex h-8 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] font-semibold text-[var(--muted)] disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing && editError && (
                    <div className="px-[18px] pb-[10px] text-[12px] font-medium text-[var(--danger)]">{editError}</div>
                  )}
                </div>
              );
            })
          )}
          {!loading && (comments?.length ?? 0) > COMMENTS_PAGE_SIZE && (
            <div className="flex items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[9px_18px]">
              <span className="text-[11.5px] text-[var(--subtle)]">
                {pageStart + 1}–{Math.min(pageStart + COMMENTS_PAGE_SIZE, comments!.length)} of {comments!.length}
              </span>
              <div className="flex gap-[5px]">
                {Array.from({ length: pageCount }, (_, i) => i).map((i) => {
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
      )}
    </div>
  );
}

export function OversightContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [stats, setStats] = useState<OversightStats | null>(null);
  const [assistants, setAssistants] = useState<AssistantSummary[] | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    listHeadOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      if (!offeringId) {
        setStats(null);
        setAssistants(null);
        return;
      }
      setSummaryLoading(true);
      setOpen({});
      try {
        const { stats, assistants } = await getOversightSummary(offeringId);
        setStats(stats);
        setAssistants(assistants);
      } finally {
        setSummaryLoading(false);
      }
    })();
  }, [offeringId]);

  const current = useMemo(() => offerings?.find((o) => o.id === offeringId) ?? null, [offerings, offeringId]);

  const statRows = stats
    ? [
        { value: String(stats.assistants), label: "Assistants", color: "var(--text)" },
        { value: String(stats.sent), label: "Messages sent", color: "var(--ok)" },
        { value: String(stats.pending), label: "Pending", color: "var(--warn)" },
        { value: `${stats.completionPct}%`, label: "Completion", color: "var(--brand)" },
      ]
    : [];

  function toggleAssistant(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const offeringsLoading = offerings === null;

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
          {offeringsLoading ? (
            <>
              <SkeletonRow className="h-[36px] w-[160px]" />
              <SkeletonRow className="h-[36px] w-[140px]" />
            </>
          ) : offerings && offerings.length ? (
            offerings.map((o) => {
              const active = o.id === offeringId;
              return (
                <button
                  key={o.id}
                  onClick={() => setOfferingId(o.id)}
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
            })
          ) : (
            <span className="text-[13px] text-[var(--subtle)]">No courses assigned yet.</span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryLoading || !stats
            ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} className="h-[62px]" />)
            : statRows.map((s) => (
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
          <span className="flex items-center gap-2 text-[12.5px] text-[var(--subtle)]">
            {summaryLoading && <Spinner size={13} />}
            {current?.label ?? ""}
          </span>
        </header>
        {summaryLoading || !assistants ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonRow key={i} className="h-[58px]" />
            ))}
          </div>
        ) : assistants.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No assistants assigned to this offering.</div>
        ) : (
          assistants.map((a) =>
            offeringId ? (
              <AssistantRow
                key={a.id}
                assistant={a}
                offeringId={offeringId}
                expanded={!!open[a.id]}
                onToggle={() => toggleAssistant(a.id)}
              />
            ) : null
          )
        )}
      </section>
    </div>
  );
}
