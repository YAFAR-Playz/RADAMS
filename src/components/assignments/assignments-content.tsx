"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { toneColors } from "@/lib/tone";
import type { Role } from "@/lib/roles";
import {
  STATUS_DEFS,
  statusDef,
  mockAssignmentStudents,
  COURSE_OFFERINGS,
  type AssignmentStatus,
  type AssignmentStudent,
} from "@/lib/assignments-data";

const PAGE_SIZE = 10;

function buildMessage(student: AssignmentStudent) {
  const def = statusDef(student.status);
  const lines = [
    "Assalamu alaikum, this is RadAMS — Physics (June · Unit 1).",
    "",
    `Update for ${student.name} on "Paper 3 — Mechanics":`,
    `Status: ${def ? def.label : "Not yet logged"}`,
  ];
  if (student.grade) lines.push(`Grade: ${student.grade}/100`);
  if (student.comment) lines.push(`Note: ${student.comment}`);
  lines.push("", "Thank you.");
  return lines.join("\n");
}

function StatusSelect({
  student,
  onChange,
  size = "sm",
}: {
  student: AssignmentStudent;
  onChange: (id: number, status: AssignmentStatus | "") => void;
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
        onChange={(e) => onChange(student.id, e.target.value as AssignmentStatus | "")}
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

export function AssignmentsContent({ role }: { role: Role }) {
  const isHead = role === "head";
  const [students, setStudents] = useState<AssignmentStudent[]>(() => mockAssignmentStudents(isHead ? 60 : 30));
  const [offering, setOffering] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [modalId, setModalId] = useState<number | null>(null);

  function updateStudent(id: number, patch: Partial<AssignmentStudent>) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  const sorted = useMemo(() => students.slice().sort((a, b) => a.name.localeCompare(b.name)), [students]);
  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sorted.filter((s) => s.name.toLowerCase().includes(q)) : sorted;
  }, [sorted, search]);

  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageStudents = matched.slice(pageStart, pageStart + PAGE_SIZE);

  const total = students.length;
  const logged = students.filter((s) => s.status !== null).length;
  const pct = total ? Math.round((logged / total) * 100) : 0;

  const modalStudent = modalId != null ? students.find((s) => s.id === modalId) ?? null : null;
  const modalMessage = modalStudent ? buildMessage(modalStudent) : "";
  const modalDigits = modalStudent ? "447700900" + (100 + modalStudent.id) : "";
  const modalWaUrl = modalStudent ? `https://wa.me/${modalDigits}?text=${encodeURIComponent(modalMessage)}` : "";
  const modalDef = modalStudent ? statusDef(modalStudent.status) : null;
  const modalToneColors = modalDef ? toneColors(modalDef.tone) : toneColors("neutral");

  function onStatusChange(id: number, status: AssignmentStatus | "") {
    updateStudent(id, { status: status || null });
  }

  const pageNumbers = useMemo(() => {
    const lo = Math.max(0, safePage - 2);
    const hi = Math.min(pageCount - 1, safePage + 2);
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  }, [safePage, pageCount]);

  return (
    <div className="flex flex-col gap-4">
      {/* CONTEXT HEADER */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">
              Assignment logging
            </div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              Paper 3 — Mechanics
            </h1>
            <div className="mt-[3px] text-[13px] text-[var(--muted)]">
              Out of 100 · Logging due 18 Jun · {COURSE_OFFERINGS[offering]}
              {isHead ? " · all students" : ""}
            </div>
            {isHead && (
              <div className="mt-[9px] inline-flex items-center gap-[6px] rounded-full bg-[var(--brands)] px-[10px] py-[4px] text-[12px] font-semibold text-[var(--brand)]">
                <Icon name="shield" size={13} />
                As Head you can log on behalf of any student in this course.
              </div>
            )}
          </div>
          <button className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]">
            <Icon name="check" size={16} />
            Save all
          </button>
        </div>

        <div className="mt-[15px] flex flex-wrap items-center gap-2">
          <span className="mr-[2px] flex-none text-[12.5px] font-semibold text-[var(--muted)]">Course</span>
          {COURSE_OFFERINGS.map((label, i) => {
            const active = i === offering;
            return (
              <button
                key={label}
                onClick={() => setOffering(i)}
                className="flex flex-none items-center gap-[7px] rounded-full border px-[13px] py-2 text-[13px] font-semibold"
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
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-[14px] flex flex-wrap items-center gap-[14px]">
          <div className="flex h-10 min-w-[220px] max-w-[320px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
            <Icon name="clipboard-list" size={16} className="text-[var(--subtle)]" />
            <select className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13.5px] font-semibold text-[var(--text)] outline-none">
              <option>Paper 3 — Mechanics</option>
              <option>Paper 1 — Multiple Choice</option>
              <option>Paper 2 — Structured Questions</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mb-[6px] flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-[var(--muted)]">Logging progress</span>
              <span className="text-[12.5px] font-bold text-[var(--text)]">
                {logged} of {total} logged
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${pct}%` }} />
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
            placeholder="Search students…"
            className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {STATUS_DEFS.map((s) => {
            const { bg, fg } = toneColors(s.tone);
            return (
              <span key={s.key} className="inline-flex items-center gap-[5px] text-[12px] font-medium text-[var(--muted)]">
                <span
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px]"
                  style={{ background: bg, color: fg }}
                >
                  <Icon name={s.icon} size={12} />
                </span>
                {s.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden overflow-x-auto rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] md:block">
        <div className="min-w-[760px]">
          <div className="flex items-center gap-[14px] border-b border-[var(--border2)] px-[18px] py-[11px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
            <span className="w-[172px] flex-none">Student</span>
            <span className="flex-1">Status</span>
            <span className="w-[66px] flex-none">Grade</span>
            <span className="min-w-0 flex-[1.4]">Comment</span>
            <span className="w-[36px] flex-none" />
          </div>
          {pageStudents.map((st) => (
            <div
              key={st.id}
              className="flex items-center gap-[14px] border-b border-[var(--border2)] px-[18px] py-[11px] hover:bg-[var(--surface2)]"
            >
              <div className="flex w-[172px] flex-none items-center gap-[10px]">
                <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                  {st.initials}
                </div>
                <div className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[var(--text)]">
                  {st.name}
                </div>
              </div>
              <div className="flex flex-1 items-center">
                <StatusSelect student={st} onChange={onStatusChange} />
              </div>
              <input
                value={st.grade}
                onChange={(e) => updateStudent(st.id, { grade: e.target.value })}
                placeholder="—"
                className="h-[36px] w-[66px] flex-none rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-center text-[13px] font-semibold text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
              />
              <input
                value={st.comment}
                onChange={(e) => updateStudent(st.id, { comment: e.target.value })}
                placeholder="Add comment…"
                className="h-[36px] min-w-0 flex-[1.4] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[11px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
              />
              <button
                onClick={() => setModalId(st.id)}
                title="Send update to guardian"
                className="flex h-[36px] w-[36px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ok)] hover:border-[var(--ok)] hover:bg-[var(--oks)]"
              >
                <Icon name="send" size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="flex flex-col gap-3 md:hidden">
        {pageStudents.map((st) => {
          const def = statusDef(st.status);
          const { bg, fg } = def ? toneColors(def.tone) : { bg: "var(--surface2)", fg: "var(--muted)" };
          return (
            <div
              key={st.id}
              className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[14px] shadow-[var(--shadow)]"
            >
              <div className="mb-[13px] flex items-center gap-[11px]">
                <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                  {st.initials}
                </div>
                <div className="min-w-0 flex-1 text-[14.5px] font-semibold text-[var(--text)]">{st.name}</div>
                <span
                  className="inline-flex items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                  style={{ background: bg, color: fg }}
                >
                  <Icon name={def ? def.icon : "clock"} size={13} />
                  {def ? def.label : "Not logged"}
                </span>
              </div>
              <div className="mb-3">
                <StatusSelect student={st} onChange={onStatusChange} size="lg" />
              </div>
              <div className="flex gap-[10px]">
                <input
                  value={st.grade}
                  onChange={(e) => updateStudent(st.id, { grade: e.target.value })}
                  placeholder="Grade"
                  className="h-[44px] w-[84px] flex-none rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] text-center text-[14px] font-semibold text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
                <input
                  value={st.comment}
                  onChange={(e) => updateStudent(st.id, { comment: e.target.value })}
                  placeholder="Add comment…"
                  className="h-[44px] min-w-0 flex-1 rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[14px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <button
                onClick={() => setModalId(st.id)}
                className="mt-[11px] flex h-[46px] w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--ok)] bg-[var(--oks)] text-[14px] font-semibold text-[var(--ok)]"
              >
                <Icon name="send" size={16} />
                Send update to guardian
              </button>
            </div>
          );
        })}
      </div>

      {/* PAGINATION */}
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[11px_16px] shadow-[var(--shadow)]">
          <span className="text-[12.5px] text-[var(--subtle)]">
            Showing {matched.length ? pageStart + 1 : 0}–{Math.min(pageStart + PAGE_SIZE, matched.length)} of {matched.length}
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

      {/* WHATSAPP SEND CONFIRMATION */}
      {modalStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
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
            <div className="p-[18px]">
              <div className="mb-[15px] flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                  {modalStudent.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">
                    {modalStudent.name.split(" ")[0]}&apos;s guardian
                  </div>
                  <div className="font-mono text-[12px] text-[var(--muted)]">{modalStudent.guardianPhone}</div>
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
                onClick={() => setModalId(null)}
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
