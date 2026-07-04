"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { toneColors } from "@/lib/tone";
import { STATUS_DEFS, statusDef, type AssignmentStatus } from "@/lib/assignments-data";
import {
  listMyOfferings,
  listAssignmentsForOffering,
  getRoster,
  setStatus,
  setGrade,
  setComment,
  markSent,
  type OfferingOption,
  type AssignmentOption,
  type RosterStudent,
} from "@/lib/actions/assignments";
import { getEffectiveTemplate, getOrgBrandName } from "@/lib/actions/templates";
import { applyTemplateVars } from "@/lib/message-vars";

const PAGE_SIZE = 10;

type Recipient = "student" | "parent";

function buildMessage(template: string, orgName: string, student: RosterStudent, assignmentTitle: string, maxMarks: number) {
  const def = statusDef(student.status);
  return applyTemplateVars(template, {
    org: orgName,
    student: student.name,
    assignment: assignmentTitle,
    status: def ? def.label : "Not yet logged",
    grade: student.grade ? ` (${student.grade}/${maxMarks})` : "",
    comment: student.comment ?? "",
  });
}

function StatusSelect({
  student,
  onChange,
  size = "sm",
}: {
  student: RosterStudent;
  onChange: (status: AssignmentStatus | "") => void;
  size?: "sm" | "lg";
}) {
  const def = statusDef(student.status);
  const { bg, fg } = def ? toneColors(def.tone) : { bg: "var(--surface2)", fg: "var(--muted)" };
  const big = size === "lg";
  return (
    <div
      className={`flex items-center gap-[7px] rounded-[8px] border px-[10px] ${big ? "h-[46px]" : "h-[36px] min-w-[148px]"}`}
      style={{ background: def ? bg : "var(--surface)", borderColor: def ? fg : "var(--border)" }}
    >
      <Icon name={def ? def.icon : "clock"} size={big ? 15 : 13} className="flex-none" style={{ color: fg }} />
      <select
        value={student.status ?? ""}
        onChange={(e) => onChange(e.target.value as AssignmentStatus | "")}
        className={`h-full w-full cursor-pointer appearance-none border-none bg-transparent font-semibold outline-none ${big ? "text-[14px]" : "text-[12.5px]"}`}
        style={{ color: fg }}
      >
        <option value="">Not logged</option>
        {STATUS_DEFS.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function HeadCheckingContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentOption[] | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [rosterLoading, startRosterLoad] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | null>(null);
  const [page, setPage] = useState(0);
  const [modalId, setModalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateStudent, setTemplateStudent] = useState<string | null>(null);
  const [templateParent, setTemplateParent] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("ZAD-AMS");
  const [recipient, setRecipient] = useState<Recipient>("parent");

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
    Promise.all([getEffectiveTemplate("assignment_student"), getEffectiveTemplate("assignment_parent"), getOrgBrandName()]).then(([tplS, tplP, org]) => {
      setTemplateStudent(tplS);
      setTemplateParent(tplP);
      setOrgName(org);
    });
  }, []);

  // Refetch on every modal open (not just page mount) — an admin editing
  // Templates while a head already has this page open shouldn't leave them
  // sending a stale message.
  useEffect(() => {
    if (!modalId) return;
    Promise.all([getEffectiveTemplate("assignment_student"), getEffectiveTemplate("assignment_parent")]).then(([tplS, tplP]) => {
      setTemplateStudent(tplS);
      setTemplateParent(tplP);
    });
  }, [modalId]);

  useEffect(() => {
    (async () => {
      if (!offeringId) {
        setAssignments([]);
        setAssignmentId(null);
        return;
      }
      setAssignments(null);
      setAssignmentId(null);
      const data = await listAssignmentsForOffering(offeringId);
      setAssignments(data);
      setAssignmentId(data[0]?.id ?? null);
    })();
  }, [offeringId]);

  function reloadRoster(id: string) {
    startRosterLoad(async () => {
      try {
        const data = await getRoster(id);
        setRoster(data);
        setPage(0);
      } catch {
        setError("Couldn't load students for this assignment.");
      }
    });
  }

  useEffect(() => {
    (() => {
      if (!assignmentId) {
        setRoster(null);
        return;
      }
      reloadRoster(assignmentId);
    })();
  }, [assignmentId]);

  const currentAssignment = assignments?.find((a) => a.id === assignmentId) ?? null;
  const showGrade = currentAssignment ? currentAssignment.hasGrade : true;
  const showComment = currentAssignment ? currentAssignment.hasComment : true;
  const currentOffering = offerings?.find((o) => o.id === offeringId) ?? null;

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = search.trim().toLowerCase();
    return roster.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !(s.assistantName ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    });
  }, [roster, search, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageStudents = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const total = roster?.length ?? 0;
  const logged = roster?.filter((s) => s.status !== null).length ?? 0;
  const pct = total ? Math.round((logged / total) * 100) : 0;

  const modalStudent = modalId != null ? roster?.find((s) => s.studentId === modalId) ?? null : null;
  const activeTemplate = recipient === "student" ? templateStudent : templateParent;
  const modalMessage =
    modalStudent && currentAssignment && activeTemplate
      ? buildMessage(activeTemplate, orgName, modalStudent, currentAssignment.title, currentAssignment.maxMarks)
      : "";
  const modalPhone = recipient === "student" ? modalStudent?.phone : modalStudent?.guardianPhone;
  const modalWaUrl = modalStudent
    ? `https://wa.me/${(modalPhone ?? "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(modalMessage)}`
    : "";
  const modalDef = modalStudent ? statusDef(modalStudent.status) : null;
  const modalToneColors = modalDef ? toneColors(modalDef.tone) : toneColors("neutral");

  function patchLocal(studentId: string, patch: Partial<RosterStudent>) {
    setRoster((prev) => (prev ? prev.map((s) => (s.studentId === studentId ? { ...s, ...patch } : s)) : prev));
  }

  async function onStatusChange(studentId: string, status: AssignmentStatus | "") {
    if (!assignmentId) return;
    setSavingId(studentId);
    try {
      await setStatus(assignmentId, studentId, status || null);
      patchLocal(studentId, { status: status || null });
    } catch {
      setError("Couldn't save status — try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function onGradeBlur(studentId: string, value: string, inputEl: HTMLInputElement) {
    if (!assignmentId) return;
    if (value.trim() && currentAssignment && !currentAssignment.lettered) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > currentAssignment.maxMarks) {
        setError(`Grade can't exceed ${currentAssignment.maxMarks} for this assignment.`);
        inputEl.value = roster?.find((s) => s.studentId === studentId)?.grade ?? "";
        return;
      }
    }
    setSavingId(studentId);
    try {
      await setGrade(assignmentId, studentId, value);
      patchLocal(studentId, { grade: value || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save grade — try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function onCommentBlur(studentId: string, value: string) {
    if (!assignmentId) return;
    setSavingId(studentId);
    try {
      await setComment(assignmentId, studentId, value);
      patchLocal(studentId, { comment: value || null });
    } catch {
      setError("Couldn't save comment — try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function onConfirmSend() {
    if (!assignmentId || !modalStudent) return;
    patchLocal(modalStudent.studentId, { sentAt: new Date().toISOString() });
    try {
      await markSent(assignmentId, modalStudent.studentId);
    } catch {
      // Non-fatal — WhatsApp still opens via the link below.
    }
  }

  const pageNumbers = useMemo(() => {
    const lo = Math.max(0, safePage - 2);
    const hi = Math.min(pageCount - 1, safePage + 2);
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  }, [safePage, pageCount]);

  const offeringsLoading = offerings === null;
  const assignmentsLoading = assignments === null;

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

      {/* CONTEXT HEADER */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Checking</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              {currentAssignment?.title ?? (assignmentsLoading ? "Loading…" : "No assignments yet")}
            </h1>
            <div className="mt-[3px] text-[13px] text-[var(--muted)]">
              Review every assistant&apos;s logging for this assignment — override anything, then message a guardian.
              {currentAssignment ? ` Out of ${currentAssignment.maxMarks}.` : ""}
              {currentOffering ? ` ${currentOffering.label}.` : ""}
            </div>
          </div>
          <button
            disabled={rosterLoading || savingId !== null}
            onClick={() => assignmentId && reloadRoster(assignmentId)}
            className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            {rosterLoading ? <Spinner size={15} /> : <Icon name="check" size={16} />}
            Refresh
          </button>
        </div>

        <div className="mt-[15px] flex flex-wrap items-center gap-2">
          <span className="mr-[2px] flex-none text-[12.5px] font-semibold text-[var(--muted)]">Course</span>
          {offeringsLoading ? (
            <>
              <SkeletonRow className="h-[36px] w-[140px]" />
              <SkeletonRow className="h-[36px] w-[120px]" />
            </>
          ) : offerings && offerings.length ? (
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
          ) : (
            <span className="text-[13px] text-[var(--subtle)]">No courses assigned yet.</span>
          )}
        </div>

        <div className="mt-[14px] flex flex-wrap items-center gap-[14px]">
          <div className="flex h-10 min-w-[220px] max-w-[320px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
            <Icon name="clipboard-list" size={16} className="text-[var(--subtle)]" />
            {assignmentsLoading ? (
              <SkeletonRow className="h-[18px] w-full" />
            ) : (
              <select
                value={assignmentId ?? ""}
                onChange={(e) => setAssignmentId(e.target.value)}
                className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none"
              >
                {(assignments ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mb-[6px] flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[var(--muted)]">Logging progress</span>
              <span className="text-[12.5px] font-bold text-[var(--text)]">
                {rosterLoading ? <Spinner size={13} /> : `${logged} of ${total} logged`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
              <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-10 min-w-[200px] max-w-[300px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
          <Icon name="search" size={16} className="text-[var(--subtle)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search students or assistants…"
            className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_DEFS.map((s) => {
            const { bg, fg } = toneColors(s.tone);
            const active = statusFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => {
                  setStatusFilter(active ? null : s.key);
                  setPage(0);
                }}
                className="inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[4px] text-[12px] font-medium"
                style={{
                  borderColor: active ? fg : "transparent",
                  background: active ? bg : "transparent",
                  color: active ? fg : "var(--muted)",
                }}
                title={active ? `Showing only ${s.label}` : `Filter to ${s.label}`}
              >
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px]" style={{ background: bg, color: fg }}>
                  <Icon name={s.icon} size={12} />
                </span>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ROSTER */}
      {rosterLoading && !roster ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonRow key={i} className="h-[58px]" />
          ))}
        </div>
      ) : !assignmentId ? (
        <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)]">
          No assignment selected.
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] lg:block">
            <div className="flex items-center gap-[12px] border-b border-[var(--border2)] px-[18px] py-[11px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
              <span className="min-w-0 flex-[1.6_1_150px]">Student</span>
              <span className="min-w-0 flex-[1_1_110px]">Assistant</span>
              <span className="min-w-0 flex-[1.3_1_140px]">Status</span>
              {showGrade && <span className="w-[60px] flex-none">Grade</span>}
              {showComment && <span className="min-w-0 flex-[1.4_1_140px]">Comment</span>}
              <span className="w-[36px] flex-none" />
            </div>
            {pageStudents.map((st) => (
              <div
                key={st.studentId}
                className="flex flex-wrap items-center gap-[12px] border-b border-[var(--border2)] px-[18px] py-[11px] hover:bg-[var(--surface2)]"
              >
                <div className="flex min-w-0 flex-[1.6_1_150px] items-center gap-[10px]">
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                    {st.initials}
                  </div>
                  <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[var(--text)]">{st.name}</div>
                  {savingId === st.studentId && <Spinner size={13} className="flex-none text-[var(--subtle)]" />}
                </div>
                <div className="min-w-0 flex-[1_1_110px] overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-[var(--muted)]">
                  {st.assistantName ?? "Unassigned"}
                </div>
                <div className="flex min-w-0 flex-[1.3_1_140px] items-center">
                  <StatusSelect student={st} onChange={(status) => onStatusChange(st.studentId, status)} />
                </div>
                {showGrade && (
                  <input
                    key={`grade-${st.studentId}-${assignmentId}`}
                    defaultValue={st.grade ?? ""}
                    onBlur={(e) => onGradeBlur(st.studentId, e.target.value, e.target)}
                    placeholder="—"
                    className="h-[36px] w-[60px] flex-none rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-center text-[13px] font-semibold text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                )}
                {showComment && (
                  <input
                    key={`comment-${st.studentId}-${assignmentId}`}
                    defaultValue={st.comment ?? ""}
                    onBlur={(e) => onCommentBlur(st.studentId, e.target.value)}
                    placeholder="Add comment…"
                    className="h-[36px] min-w-0 flex-[1.4_1_140px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                )}
                <button
                  onClick={() => {
                    setRecipient("parent");
                    setModalId(st.studentId);
                  }}
                  title="Send update to guardian"
                  className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ok)] hover:border-[var(--ok)] hover:bg-[var(--oks)]"
                >
                  <Icon name="send" size={16} />
                </button>
              </div>
            ))}
            {pageStudents.length === 0 && (
              <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No students match these filters.</div>
            )}
          </div>

          {/* CARDS (mobile + tablet) */}
          <div className="flex flex-col gap-3 lg:hidden">
            {pageStudents.map((st) => {
              const def = statusDef(st.status);
              const { bg, fg } = def ? toneColors(def.tone) : { bg: "var(--surface2)", fg: "var(--muted)" };
              return (
                <div key={st.studentId} className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[14px] shadow-[var(--shadow)]">
                  <div className="mb-[13px] flex items-center gap-[11px]">
                    <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                      {st.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14.5px] font-semibold text-[var(--text)]">{st.name}</div>
                      <div className="text-[11.5px] text-[var(--subtle)]">{st.assistantName ?? "Unassigned"}</div>
                    </div>
                    {savingId === st.studentId && <Spinner size={14} className="text-[var(--subtle)]" />}
                    <span className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold" style={{ background: bg, color: fg }}>
                      <Icon name={def ? def.icon : "clock"} size={13} />
                      {def ? def.label : "Not logged"}
                    </span>
                  </div>
                  <div className="mb-3">
                    <StatusSelect student={st} onChange={(status) => onStatusChange(st.studentId, status)} size="lg" />
                  </div>
                  <div className="flex flex-wrap gap-[10px]">
                    {showGrade && (
                      <input
                        key={`grade-${st.studentId}-${assignmentId}`}
                        defaultValue={st.grade ?? ""}
                        onBlur={(e) => onGradeBlur(st.studentId, e.target.value, e.target)}
                        placeholder="Grade"
                        className="h-[44px] w-[84px] flex-none rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] text-center text-[14px] font-semibold text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                      />
                    )}
                    {showComment && (
                      <input
                        key={`comment-${st.studentId}-${assignmentId}`}
                        defaultValue={st.comment ?? ""}
                        onBlur={(e) => onCommentBlur(st.studentId, e.target.value)}
                        placeholder="Add comment…"
                        className="h-[44px] min-w-0 flex-1 rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[14px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                      />
                    )}
                  </div>
                  <button
                    onClick={() => {
                    setRecipient("parent");
                    setModalId(st.studentId);
                  }}
                    className="mt-[11px] flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--ok)] bg-[var(--oks)] text-[14px] font-semibold text-[var(--ok)]"
                  >
                    <Icon name="send" size={16} />
                    Send update to guardian
                  </button>
                </div>
              );
            })}
            {pageStudents.length === 0 && (
              <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)]">
                No students match these filters.
              </div>
            )}
          </div>

          {/* PAGINATION */}
          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[11px_16px] shadow-[var(--shadow)]">
              <span className="text-[12.5px] text-[var(--subtle)]">
                Showing {filtered.length ? pageStart + 1 : 0}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-[5px]">
                {pageNumbers.map((i) => {
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
        </>
      )}

      {/* WHATSAPP SEND CONFIRMATION */}
      {modalStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[rgba(37,211,102,0.14)] text-[#1ea952]">
                <Icon name="send" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Send update via WhatsApp</h3>
                <div className="text-[12px] text-[var(--muted)]">Review the message before opening WhatsApp</div>
              </div>
              <button
                onClick={() => setModalId(null)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-[18px]">
              <div className="mb-[11px] flex gap-[6px] rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] p-[3px]">
                {(["student", "parent"] as Recipient[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRecipient(r)}
                    className="flex-1 rounded-[7px] py-[7px] text-[12.5px] font-semibold"
                    style={{
                      background: recipient === r ? "var(--surface)" : "transparent",
                      color: recipient === r ? "var(--text)" : "var(--muted)",
                      boxShadow: recipient === r ? "var(--shadow)" : "none",
                    }}
                  >
                    {r === "student" ? "To student" : "To parent"}
                  </button>
                ))}
              </div>
              <div className="mb-[15px] flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                  {modalStudent.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">
                    {recipient === "student" ? modalStudent.name : modalStudent.guardianName ?? `${modalStudent.name.split(" ")[0]}'s guardian`}
                  </div>
                  <div className="font-mono text-[12px] text-[var(--muted)]">{modalPhone ?? "No phone on file"}</div>
                </div>
                <span
                  className="inline-flex flex-none items-center gap-[5px] rounded-full px-[9px] py-[4px] text-[11.5px] font-semibold"
                  style={{ background: modalToneColors.bg, color: modalToneColors.fg }}
                >
                  <Icon name={modalDef ? modalDef.icon : "clock"} size={12} />
                  {modalDef ? modalDef.label : "Not yet logged"}
                </span>
              </div>
              <div className="mb-[7px] text-[12px] font-semibold text-[var(--muted)]">Message preview</div>
              <div className="max-h-[190px] overflow-auto whitespace-pre-wrap rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[13px] text-[13px] leading-[1.55] text-[var(--text)]">
                {modalMessage}
              </div>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button
                onClick={() => setModalId(null)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
              <a
                href={modalWaUrl}
                target="_blank"
                rel="noopener"
                onClick={() => {
                  onConfirmSend();
                  setModalId(null);
                }}
                className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[#25D366] text-[13.5px] font-semibold text-white"
              >
                <Icon name="send" size={16} />
                Open WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
