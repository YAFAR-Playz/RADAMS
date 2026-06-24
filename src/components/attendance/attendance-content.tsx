"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { toneColors } from "@/lib/tone";
import type { Role, Tone } from "@/lib/roles";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import {
  listSessions,
  getSessionRoster,
  createSession,
  markAttendance,
  markAllPresent,
  type SessionSummary,
  type AttendanceRosterRow,
  type AttendanceStatus,
} from "@/lib/actions/attendance";
import { getEffectiveTemplate, getOrgBrandName } from "@/lib/actions/templates";
import { applyTemplateVars } from "@/lib/message-vars";

const PAGE_SIZE = 20;
const STATUS_OPTS: { key: AttendanceStatus; label: string; icon: "check" | "clock" | "x"; tone: Tone }[] = [
  { key: "present", label: "Present", icon: "check", tone: "ok" },
  { key: "late", label: "Late", icon: "clock", tone: "warn" },
  { key: "absent", label: "Absent", icon: "x", tone: "danger" },
];

function statusMeta(status: AttendanceStatus) {
  return STATUS_OPTS.find((o) => o.key === status) ?? STATUS_OPTS[0];
}

export function AttendanceContent({ role }: { role: Role }) {
  const canEdit = role === "registration";
  const useCourseDropdown = role === "registration";

  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [roster, setRoster] = useState<AttendanceRosterRow[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [waId, setWaId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTime, setNewTime] = useState("16:00");
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("RadAMS");

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
    Promise.all([getEffectiveTemplate("attendance"), getOrgBrandName()]).then(([tpl, org]) => {
      setTemplate(tpl);
      setOrgName(org);
    });
  }, []);

  async function reloadSessions(id: string, selectId?: string) {
    const data = await listSessions(id);
    setSessions(data);
    setSessionId(selectId ?? data[0]?.id ?? null);
  }

  useEffect(() => {
    (async () => {
      if (!offeringId) {
        setSessions([]);
        setSessionId(null);
        return;
      }
      await reloadSessions(offeringId);
    })();
  }, [offeringId]);

  async function reloadRoster(id: string) {
    setRosterLoading(true);
    try {
      setRoster(await getSessionRoster(id));
    } catch {
      setError("Couldn't load this session's roster.");
    } finally {
      setRosterLoading(false);
    }
  }

  useEffect(() => {
    (() => {
      if (!sessionId) {
        setRoster(null);
        return;
      }
      reloadRoster(sessionId);
    })();
  }, [sessionId]);

  const offeringsLoading = offerings === null;
  const current = offerings?.find((o) => o.id === offeringId) ?? null;
  const activeSession = sessions?.find((s) => s.id === sessionId) ?? null;

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = search.trim().toLowerCase();
    return q ? roster.filter((r) => r.name.toLowerCase().includes(q)) : roster;
  }, [roster, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const summary = STATUS_OPTS.map((o) => ({
    ...o,
    n: (roster ?? []).filter((r) => r.status === o.key).length,
  }));
  const presentCount = (roster ?? []).filter((r) => r.status === "present" || r.status === "late").length;

  async function onMark(studentId: string, status: AttendanceStatus) {
    if (!sessionId) return;
    setRoster((prev) => (prev ? prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)) : prev));
    setSavingId(studentId);
    try {
      await markAttendance(sessionId, studentId, status);
      setSessions((prev) =>
        prev
          ? prev.map((s) => (s.id === sessionId ? { ...s } : s))
          : prev
      );
      if (sessionId) reloadSessions(offeringId!, sessionId);
    } catch {
      setError("Couldn't save attendance — try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function onAllPresent() {
    if (!sessionId) return;
    setMarkingAll(true);
    setRoster((prev) => (prev ? prev.map((r) => ({ ...r, status: "present" as AttendanceStatus })) : prev));
    try {
      await markAllPresent(sessionId);
      reloadSessions(offeringId!, sessionId);
    } catch {
      setError("Couldn't mark all present — try again.");
    } finally {
      setMarkingAll(false);
    }
  }

  async function onCreateSession() {
    if (!offeringId) return;
    setCreating(true);
    try {
      const { id } = await createSession({ offeringId, title: newTitle.trim() || "New session", date: newDate, time: newTime });
      setModalOpen(false);
      setNewTitle("");
      await reloadSessions(offeringId, id);
    } catch {
      setError("Couldn't create this session — try again.");
    } finally {
      setCreating(false);
    }
  }

  const waStudent = waId ? roster?.find((r) => r.studentId === waId) ?? null : null;
  const waMeta = waStudent ? statusMeta(waStudent.status) : null;
  const waToneColors = waMeta ? toneColors(waMeta.tone) : toneColors("neutral");
  const waMessage =
    waStudent && waMeta && template
      ? applyTemplateVars(template, {
          org: orgName,
          student: waStudent.name,
          status: waMeta.label,
          session: activeSession?.title ?? "",
          date: activeSession?.date ?? "",
        })
      : "";
  const waDigits = waStudent?.guardianPhone ? waStudent.guardianPhone.replace(/[^\d]/g, "") : "";
  const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent(waMessage)}`;

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

      {/* HEADER */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Attendance</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              {canEdit ? "Take attendance" : role === "assistant" ? "My students' attendance" : "Attendance records"}
            </h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              {canEdit
                ? "Create a session for a course and mark each student."
                : role === "assistant"
                  ? "Attendance for your assigned students, per session."
                  : "Attendance recorded by the Registration team, per session."}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setModalOpen(true)}
              disabled={!offeringId}
              className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
            >
              <Icon name="plus" size={16} />
              New session
            </button>
          )}
        </div>

        <div className="mt-[15px] flex flex-wrap items-center gap-2">
          <span className="mr-[2px] flex-none text-[12.5px] font-semibold text-[var(--muted)]">Course</span>
          {offeringsLoading ? (
            <>
              <SkeletonRow className="h-[36px] w-[150px]" />
              <SkeletonRow className="h-[36px] w-[130px]" />
            </>
          ) : offerings && offerings.length ? (
            useCourseDropdown ? (
              <div className="flex h-[38px] min-w-[240px] max-w-[320px] items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                <Icon name="book" size={15} className="text-[var(--subtle)]" />
                <select
                  value={offeringId ?? ""}
                  onChange={(e) => setOfferingId(e.target.value)}
                  className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13px] font-semibold text-[var(--text)] outline-none"
                >
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              offerings.map((o) => {
                const active = o.id === offeringId;
                return (
                  <button
                    key={o.id}
                    onClick={() => setOfferingId(o.id)}
                    className="flex flex-none items-center gap-[7px] rounded-full border px-[13px] py-2 text-[13px] font-semibold"
                    style={
                      active
                        ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                        : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                    }
                  >
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: active ? "var(--brandfg)" : "var(--subtle)" }} />
                    {o.label}
                  </button>
                );
              })
            )
          ) : (
            <span className="text-[13px] text-[var(--subtle)]">No courses yet.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {/* SESSIONS LIST */}
        <section className="min-w-0 flex-[1_1_300px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_18px]">
            <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">Sessions</h3>
            <span className="text-[11px] font-medium text-[var(--subtle)]">Latest first</span>
          </header>
          <div className="p-[7px_8px]">
            {sessions === null ? (
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <SkeletonRow key={i} className="h-[60px]" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-[28px_12px] text-center text-[13px] text-[var(--muted)]">No sessions yet for this course.</div>
            ) : (
              sessions.map((s) => {
                const active = s.id === sessionId;
                const d = new Date(s.date);
                const mon = d.toLocaleDateString("en-US", { month: "short" });
                const day = String(d.getDate()).padStart(2, "0");
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSessionId(s.id);
                      setPage(0);
                    }}
                    className="flex cursor-pointer items-center gap-[11px] rounded-[10px] p-[11px] hover:bg-[var(--surface2)]"
                    style={{ background: active ? "var(--brands)" : "transparent" }}
                  >
                    <div
                      className="flex h-[42px] w-[42px] flex-none flex-col items-center justify-center rounded-[11px] leading-none"
                      style={{ background: active ? "var(--brand)" : "var(--surface2)", color: active ? "var(--brandfg)" : "var(--muted)" }}
                    >
                      <span className="text-[9px] font-bold uppercase tracking-[0.04em]">{mon}</span>
                      <span className="text-[16px] font-bold">{day}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-[var(--text)]">{s.title}</div>
                      <div className="text-[12px] text-[var(--subtle)]">
                        {s.present}/{s.total} present{s.time ? ` · ${s.time}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ROSTER */}
        <section className="min-w-0 flex-[2_1_380px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
          <header className="flex flex-wrap items-center justify-between gap-[10px] border-b border-[var(--border2)] p-[14px_18px]">
            <div>
              <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">{activeSession?.title ?? "—"}</h3>
              <p className="m-0 mt-[2px] text-[12px] text-[var(--subtle)]">
                {activeSession ? `${activeSession.date} · ${presentCount}/${activeSession.total} present` : ""}
              </p>
            </div>
            {canEdit ? (
              <div className="flex gap-[7px]">
                <button
                  onClick={onAllPresent}
                  disabled={!sessionId || markingAll}
                  className="flex items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] py-[7px] text-[12px] font-semibold text-[var(--ok)] hover:bg-[var(--oks)] disabled:opacity-60"
                >
                  {markingAll ? <Spinner size={13} /> : <Icon name="check2" size={14} />}
                  All present
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-[6px] text-[12px] font-medium text-[var(--muted)]">
                <Icon name="shield" size={14} />
                View only
              </span>
            )}
          </header>

          <div className="flex flex-wrap items-center gap-[10px] border-b border-[var(--border2)] p-[11px_14px]">
            <div className="flex h-[38px] min-w-[170px] max-w-[300px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px]">
              <Icon name="search" size={15} className="text-[var(--subtle)]" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Find a student…"
                className="h-full w-full border-none bg-transparent text-[13px] text-[var(--text)] outline-none"
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-[6px]">
              {summary.map((s) => {
                const { bg, fg } = toneColors(s.tone);
                return (
                  <span key={s.key} className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[12px] font-semibold" style={{ background: bg, color: fg }}>
                    <Icon name={s.icon} size={12} />
                    {s.n} {s.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="p-[7px_8px]">
            {rosterLoading && !roster ? (
              <div className="flex flex-col gap-2 p-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <SkeletonRow key={i} className="h-[52px]" />
                ))}
              </div>
            ) : pageRows.length === 0 ? (
              <div className="p-[28px_12px] text-center text-[13px] text-[var(--muted)]">
                {search ? `No students match "${search}"` : "No students enrolled in this course yet."}
              </div>
            ) : (
              pageRows.map((r) => {
                const meta = statusMeta(r.status);
                const { bg, fg } = toneColors(meta.tone);
                return (
                  <div key={r.studentId} className="flex flex-wrap items-center gap-[8px_10px] rounded-[10px] p-[9px_11px] hover:bg-[var(--surface2)]">
                    <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--surface2)] text-[12px] font-bold text-[var(--muted)]">
                      {r.initials}
                    </div>
                    <div className="min-w-[130px] flex-[1_1_140px]">
                      <div className="text-[13.5px] font-semibold text-[var(--text)]">
                        {r.name}
                        {savingId === r.studentId && <Spinner size={12} className="ml-2 inline text-[var(--subtle)]" />}
                      </div>
                    </div>
                    {canEdit ? (
                      <div className="ml-auto flex flex-none flex-wrap gap-[6px]">
                        {STATUS_OPTS.map((o) => {
                          const active = r.status === o.key;
                          const tc = toneColors(o.tone);
                          return (
                            <button
                              key={o.key}
                              onClick={() => onMark(r.studentId, o.key)}
                              title={o.label}
                              className="flex min-h-[38px] items-center gap-[5px] rounded-[8px] border px-[11px] text-[12px] font-semibold"
                              style={{
                                borderColor: active ? tc.fg : "var(--border)",
                                background: active ? tc.bg : "transparent",
                                color: active ? tc.fg : "var(--muted)",
                              }}
                            >
                              <Icon name={o.icon} size={14} />
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="ml-auto flex flex-none items-center gap-[8px]">
                        <span className="inline-flex items-center gap-[6px] rounded-full px-[11px] py-[4px] text-[12px] font-semibold" style={{ background: bg, color: fg }}>
                          <Icon name={meta.icon} size={13} />
                          {meta.label}
                        </span>
                        <button
                          onClick={() => setWaId(r.studentId)}
                          title="Message parent about attendance"
                          className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[#1ea952] hover:border-[var(--ok)] hover:bg-[var(--oks)]"
                        >
                          <Icon name="send" size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[11px_14px]">
              <span className="text-[12px] text-[var(--subtle)]">
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} students
              </span>
              <div className="flex items-center gap-[5px]">
                {Array.from({ length: pageCount }, (_, i) => i)
                  .filter((i) => i >= safePage - 2 && i <= safePage + 2)
                  .map((i) => {
                    const active = i === safePage;
                    return (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className="h-8 min-w-8 rounded-[7px] border px-2 text-[12.5px] font-semibold"
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
        </section>
      </div>

      {/* WHATSAPP ATTENDANCE MODAL */}
      {waStudent && waMeta && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[rgba(37,211,102,0.14)] text-[#1ea952]">
                <Icon name="send" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Message parent · attendance</h3>
                <div className="text-[12px] text-[var(--muted)]">{activeSession?.title}</div>
              </div>
              <button onClick={() => setWaId(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="p-[18px]">
              <div className="mb-[14px] flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                  {waStudent.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{waStudent.name.split(" ")[0]}&apos;s guardian</div>
                  <div className="font-mono text-[12px] text-[var(--muted)]">{waStudent.guardianPhone ?? "No phone on file"}</div>
                </div>
                <span className="inline-flex flex-none items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[11.5px] font-semibold" style={{ background: waToneColors.bg, color: waToneColors.fg }}>
                  <Icon name={waMeta.icon} size={12} />
                  {waMeta.label}
                </span>
              </div>
              <div className="mb-[7px] text-[12px] font-semibold text-[var(--muted)]">Message preview</div>
              <div className="max-h-[180px] overflow-auto whitespace-pre-wrap rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[13px] text-[13px] leading-[1.55] text-[var(--text)]">
                {waMessage}
              </div>
            </div>
            <div className="flex gap-[10px] p-[0_18px_16px]">
              <button onClick={() => setWaId(null)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener"
                onClick={() => setWaId(null)}
                className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[#25D366] text-[13.5px] font-semibold text-white"
              >
                <Icon name="send" size={16} />
                Open WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* NEW SESSION MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[430px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="cal-check" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">New attendance session</h3>
                <div className="text-[12px] text-[var(--muted)]">{current?.label}</div>
              </div>
              <button onClick={() => setModalOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[14px] p-[18px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Session title</label>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Week 7 — Lecture"
                  className="h-11 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Date</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-11 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Time</label>
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="h-11 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-[9px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                <Icon name="users" size={16} className="flex-none text-[var(--muted)]" />
                <span className="text-[12.5px] text-[var(--muted)]">
                  All enrolled students in <span className="font-semibold text-[var(--text)]">{current?.label}</span> will be added.
                </span>
              </div>
            </div>
            <div className="flex gap-[10px] p-[0_18px_16px]">
              <button onClick={() => setModalOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onCreateSession}
                disabled={creating}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {creating ? <Spinner size={15} /> : <Icon name="plus" size={15} />}
                Create &amp; take attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
