"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { toneColors } from "@/lib/tone";
import type { Tone } from "@/lib/roles";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import {
  listOfferingAssistants,
  listAssignmentsWithProgress,
  createAssignment,
  updateAssignment,
  toggleAssignmentClosed,
  type AssistantOption,
  type AssignmentProgress,
} from "@/lib/actions/head-assignments";
import { TEMPLATE_CATEGORY_DEFS } from "@/lib/template-defs";

const ASSIGNMENT_VARS = TEMPLATE_CATEGORY_DEFS.find((c) => c.category === "assignment")!.vars;

const TEMPLATES: { value: "grade" | "checkbox" | "rubric" | "comment"; label: string; desc: string }[] = [
  { value: "grade", label: "Grade + comment", desc: "Numeric mark and a free-text note" },
  { value: "checkbox", label: "Complete / Missing", desc: "Assistant just ticks done or not — no grade" },
  { value: "rubric", label: "Rubric (criteria)", desc: "Score against named criteria" },
  { value: "comment", label: "Comment only", desc: "Qualitative feedback, no mark" },
];

const DEFAULT_MESSAGE =
  "Assalamu alaikum, this is ZAD-AMS.\n\nUpdate on {assignment} for {student}:\n{status}{grade}\n\nThank you.";

function statusFor(a: AssignmentProgress): { text: string; icon: "check2" | "clock"; tone: Tone } {
  const total = a.assignees.reduce((s, x) => s + x.total, 0);
  const logged = a.assignees.reduce((s, x) => s + x.logged, 0);
  const complete = total > 0 && logged >= total;
  if (a.closedAt) return { text: "Closed", icon: "check2", tone: "neutral" };
  if (complete) return { text: "Complete", icon: "check2", tone: "ok" };
  const pastDue = a.dueDate ? new Date(a.dueDate) < new Date() : false;
  if (pastDue) return { text: "Open · past due", icon: "clock", tone: "warn" };
  return { text: "Open", icon: "clock", tone: "brand" };
}

type FormState = {
  title: string;
  marks: string;
  due: string;
  template: "grade" | "checkbox" | "rubric" | "comment";
  gradeScheme: "numeric" | "letter";
  countsSalary: boolean;
  message: string;
  assistantIds: string[];
};

function emptyForm(assistantIds: string[]): FormState {
  return {
    title: "",
    marks: "100",
    due: "",
    template: "grade",
    gradeScheme: "numeric",
    countsSalary: true,
    message: DEFAULT_MESSAGE,
    assistantIds,
  };
}

export function HeadAssignmentsContent() {
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<AssistantOption[] | null>(null);
  const [assignments, setAssignments] = useState<AssignmentProgress[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [closingId, setClosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm([]));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
  }, []);

  async function reload(id: string) {
    setListLoading(true);
    try {
      const [a, ast] = await Promise.all([listAssignmentsWithProgress(id), listOfferingAssistants(id)]);
      setAssignments(a);
      setAssistants(ast);
    } catch {
      setError("Couldn't load assignments for this offering.");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!offeringId) {
        setAssignments([]);
        setAssistants([]);
        return;
      }
      setOpen({});
      await reload(offeringId);
    })();
  }, [offeringId]);

  const offeringsLoading = offerings === null;
  const current = offerings?.find((o) => o.id === offeringId) ?? null;

  function toggleExpand(id: string) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openNewModal() {
    setEditId(null);
    setForm(emptyForm((assistants ?? []).map((a) => a.id)));
    setModalOpen(true);
  }

  function openEditModal(a: AssignmentProgress) {
    setEditId(a.id);
    setForm({
      title: a.title,
      marks: String(a.maxMarks),
      due: a.dueDate ?? "",
      template: a.template,
      gradeScheme: a.gradeScheme,
      countsSalary: a.countsSalary,
      message: a.messageTemplate ?? DEFAULT_MESSAGE,
      assistantIds: a.assignees.map((x) => x.assistantId),
    });
    setModalOpen(true);
  }

  function toggleAssistantChip(id: string) {
    setForm((f) => ({
      ...f,
      assistantIds: f.assistantIds.includes(id) ? f.assistantIds.filter((x) => x !== id) : [...f.assistantIds, id],
    }));
  }

  function toggleSelectAll() {
    const all = (assistants ?? []).map((a) => a.id);
    const isAll = form.assistantIds.length === all.length;
    setForm((f) => ({ ...f, assistantIds: isAll ? [] : all }));
  }

  const canSave = form.title.trim().length > 0 && form.assistantIds.length > 0;
  const showGradeScheme = form.template === "grade" || form.template === "rubric";

  async function onSave() {
    if (!canSave || !offeringId) return;
    setSaving(true);
    try {
      if (editId) {
        await updateAssignment(editId, {
          title: form.title.trim(),
          maxMarks: Number(form.marks) || 100,
          dueDate: form.due || null,
          countsSalary: form.countsSalary,
        });
      } else {
        await createAssignment({
          offeringId,
          title: form.title.trim(),
          maxMarks: Number(form.marks) || 100,
          dueDate: form.due || null,
          template: form.template,
          gradeScheme: form.gradeScheme,
          countsSalary: form.countsSalary,
          messageTemplate: form.message,
          assistantIds: form.assistantIds,
        });
      }
      setModalOpen(false);
      await reload(offeringId);
    } catch {
      setError("Couldn't save this assignment — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleClose(a: AssignmentProgress) {
    if (!offeringId) return;
    setClosingId(a.id);
    try {
      await toggleAssignmentClosed(a.id, !a.closedAt);
      await reload(offeringId);
    } catch {
      setError("Couldn't update this assignment — try again.");
    } finally {
      setClosingId(null);
    }
  }

  const assistantOptions = useMemo(() => assistants ?? [], [assistants]);

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
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">
              Assignments
            </div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              Create &amp; assign work
            </h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              Each assignment is scoped to a course offering and logged by each student&apos;s assistant.
            </p>
          </div>
          <button
            onClick={openNewModal}
            disabled={!offeringId}
            className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
          >
            <Icon name="plus" size={16} />
            New assignment
          </button>
        </div>

        <div className="mt-[15px] flex flex-wrap items-center gap-2">
          <span className="mr-[2px] flex-none text-[12.5px] font-semibold text-[var(--muted)]">Offering</span>
          {offeringsLoading ? (
            <>
              <SkeletonRow className="h-[36px] w-[150px]" />
              <SkeletonRow className="h-[36px] w-[130px]" />
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
      </div>

      {/* ASSIGNMENT LIST */}
      <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        <header className="flex items-center justify-between border-b border-[var(--border2)] p-[14px_18px]">
          <h3 className="m-0 flex items-center gap-2 text-[14px] font-semibold text-[var(--text)]">
            {listLoading && <Spinner size={13} />}
            {current?.label ?? "—"} · {assignments?.length ?? 0} assignments
          </h3>
        </header>

        {listLoading && !assignments ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonRow key={i} className="h-[60px]" />
            ))}
          </div>
        ) : !assignments || assignments.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">
            No assignments yet for this offering — create one to get started.
          </div>
        ) : (
          assignments.map((a) => {
            const status = statusFor(a);
            const { bg, fg } = toneColors(status.tone);
            const total = a.assignees.reduce((s, x) => s + x.total, 0);
            const logged = a.assignees.reduce((s, x) => s + x.logged, 0);
            const pct = total ? Math.round((logged / total) * 100) : 0;
            const expanded = !!open[a.id];
            const complete = total > 0 && logged >= total;
            const canClose = !a.closedAt && !complete;

            return (
              <div key={a.id} className="border-b border-[var(--border2)]">
                <div
                  onClick={() => toggleExpand(a.id)}
                  className="flex flex-wrap items-center gap-[14px] p-[14px_18px] cursor-pointer hover:bg-[var(--surface2)]"
                >
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[var(--brands)] text-[var(--brand)]">
                    <Icon name="clipboard-list" size={19} />
                  </div>
                  <div className="min-w-[160px] flex-1">
                    <div className="text-[14px] font-semibold text-[var(--text)]">{a.title}</div>
                    <div className="text-[12px] text-[var(--subtle)]">
                      {a.template === "grade" || a.template === "rubric" ? `Out of ${a.maxMarks} · ` : a.template === "checkbox" ? "Complete / Missing · " : "Comment only · "}
                      {a.dueDate ? `Logging due ${a.dueDate}` : "No due date"} · {a.assignees.length} assistants
                    </div>
                  </div>
                  <div className="flex min-w-[130px] flex-1 flex-col gap-[5px]">
                    <div className="flex justify-between">
                      <span className="text-[11.5px] font-medium text-[var(--muted)]">Logged</span>
                      <span className="text-[12px] font-bold text-[var(--text)]">
                        {logged}/{total}
                      </span>
                    </div>
                    <div className="h-[6px] overflow-hidden rounded-full bg-[var(--surface2)]">
                      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: fg }} />
                    </div>
                  </div>
                  <span
                    className="inline-flex flex-none items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                    style={{ background: bg, color: fg }}
                  >
                    <Icon name={status.icon} size={12} />
                    {status.text}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(a);
                    }}
                    title="Edit assignment"
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                  >
                    <Icon name="settings" size={15} />
                  </button>
                  <Icon
                    name="chevron-down"
                    size={18}
                    className="flex-none text-[var(--subtle)]"
                    style={{ transform: expanded ? "rotate(180deg)" : "none" }}
                  />
                </div>

                {expanded && (
                  <div className="border-t border-[var(--border2)] bg-[var(--surface2)] py-[6px]">
                    <div className="px-[18px] pb-[5px] pt-[8px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
                      Assigned to · by assistant
                    </div>
                    {a.assignees.map((g) => {
                      const gPct = g.total ? Math.round((g.logged / g.total) * 100) : 0;
                      return (
                        <div
                          key={g.assistantId}
                          className="flex flex-wrap items-center gap-[8px_11px] border-t border-[var(--border2)] p-[9px_18px]"
                        >
                          <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[11px] font-bold text-[var(--muted)]">
                            {g.initials}
                          </div>
                          <span className="min-w-0 flex-1 text-[13px] font-semibold text-[var(--text)]">{g.name}</span>
                          <span className="flex-none text-[12px] text-[var(--muted)]">{g.total} students</span>
                          <div className="h-[6px] w-20 flex-none overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)]">
                            <div className="h-full rounded-full" style={{ width: `${gPct}%`, background: fg }} />
                          </div>
                          <span className="w-[46px] flex-none text-right text-[12px] font-bold text-[var(--text)]">
                            {g.logged}/{g.total}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[11px_18px]">
                      <span className="text-[11.5px] leading-[1.4] text-[var(--subtle)]">
                        Stays open past the due date until every student is logged — or close it manually.
                      </span>
                      {canClose && (
                        <button
                          onClick={() => onToggleClose(a)}
                          disabled={closingId === a.id}
                          className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-[7px] text-[12.5px] font-semibold text-[var(--text)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                        >
                          {closingId === a.id ? <Spinner size={13} /> : <Icon name="check2" size={14} />}
                          Close now
                        </button>
                      )}
                      {!!a.closedAt && (
                        <button
                          onClick={() => onToggleClose(a)}
                          disabled={closingId === a.id}
                          className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-[7px] text-[12.5px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:opacity-60"
                        >
                          {closingId === a.id ? <Spinner size={13} /> : <Icon name="clock" size={14} />}
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* NEW / EDIT ASSIGNMENT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[480px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="clipboard-list" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">
                  {editId ? "Edit assignment" : "New assignment"}
                </h3>
                <div className="text-[12px] text-[var(--muted)]">{current?.label}</div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto p-[18px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Paper 4 — Alternative to Practical"
                  className="h-11 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Due date</label>
                <input
                  type="date"
                  value={form.due}
                  onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))}
                  className="h-11 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>

              {!editId && (
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">
                    Comment template
                  </label>
                  <div className="flex flex-col gap-[7px]">
                    {TEMPLATES.map((t) => {
                      const active = form.template === t.value;
                      return (
                        <button
                          key={t.value}
                          onClick={() => setForm((f) => ({ ...f, template: t.value }))}
                          className="flex items-center gap-[10px] rounded-[var(--rad-sm)] border-[1.5px] p-[11px_13px] text-left"
                          style={{ borderColor: active ? "var(--brand)" : "var(--border)", background: active ? "var(--brands)" : "var(--surface)" }}
                        >
                          <div
                            className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px]"
                            style={{ borderColor: active ? "var(--brand)" : "var(--border)", background: active ? "var(--brand)" : "transparent" }}
                          >
                            {active && <div className="h-2 w-2 rounded-full bg-[var(--brandfg)]" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-[var(--text)]">{t.label}</div>
                            <div className="text-[11.5px] text-[var(--subtle)]">{t.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!editId && showGradeScheme && (
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Grade scheme</label>
                  <div className="mb-[9px] flex gap-[7px]">
                    {(["numeric", "letter"] as const).map((v) => {
                      const active = form.gradeScheme === v;
                      return (
                        <button
                          key={v}
                          onClick={() => setForm((f) => ({ ...f, gradeScheme: v }))}
                          className="h-10 flex-1 rounded-[8px] border-[1.5px] text-[13px] font-semibold"
                          style={
                            active
                              ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                              : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                          }
                        >
                          {v === "numeric" ? "Out of N" : "Letter grades"}
                        </button>
                      );
                    })}
                  </div>
                  {form.gradeScheme === "numeric" ? (
                    <div className="flex h-[42px] items-center gap-[9px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3">
                      <span className="flex-none text-[13px] font-medium text-[var(--muted)]">Marks out of</span>
                      <input
                        value={form.marks}
                        onChange={(e) => setForm((f) => ({ ...f, marks: e.target.value.replace(/[^0-9]/g, "") }))}
                        inputMode="numeric"
                        placeholder="100"
                        className="h-full w-full border-none bg-transparent font-mono text-[13.5px] font-semibold text-[var(--text)] outline-none"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[10px_12px]">
                      <Icon name="grad" size={15} className="flex-none text-[var(--muted)]" />
                      <span className="text-[12.5px] text-[var(--muted)]">
                        Assistants pick a letter:{" "}
                        <span className="font-mono font-semibold text-[var(--text)]">A* · A · B · C · D · E · U</span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[12px_13px]">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">Counts toward salary</div>
                  <div className="text-[11.5px] leading-[1.4] text-[var(--subtle)]">
                    When on, papers checked here are billed by Finance. Turn off for practice work that isn&apos;t paid.
                  </div>
                </div>
                <button
                  onClick={() => setForm((f) => ({ ...f, countsSalary: !f.countsSalary }))}
                  role="switch"
                  aria-checked={form.countsSalary}
                  className="relative h-[22px] w-[38px] flex-none rounded-full transition-colors"
                  style={{ background: form.countsSalary ? "var(--brand)" : "var(--border)" }}
                >
                  <span
                    className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left]"
                    style={{ left: form.countsSalary ? "18px" : "2px" }}
                  />
                </button>
              </div>

              {!editId && (
                <div>
                  <label className="mb-1 block text-[12.5px] font-semibold text-[var(--text)]">
                    Message template
                  </label>
                  <p className="mb-[7px] text-[11.5px] leading-[1.45] text-[var(--subtle)]">
                    Prefilled and editable. Assistants send this on WhatsApp — these auto-fill:
                  </p>
                  <div className="mb-[8px] flex flex-wrap gap-[6px]">
                    {ASSIGNMENT_VARS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, message: f.message + v }))}
                        className="inline-flex items-center gap-[5px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[9px] py-[4px] font-mono text-[11px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)]"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="h-[104px] w-full resize-y rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_12px] text-[13px] leading-[1.5] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
              )}

              <div className="rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[11px_13px]">
                <div className="mb-2 flex items-center gap-2">
                  <Icon name="user-check" size={15} className="flex-none text-[var(--muted)]" />
                  <span className="text-[12.5px] font-semibold text-[var(--text)]">Assign to assistants</span>
                  <button onClick={toggleSelectAll} className="ml-auto bg-none text-[12px] font-semibold text-[var(--brand)]">
                    {form.assistantIds.length === assistantOptions.length ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-[6px]">
                  {assistantOptions.map((c) => {
                    const active = form.assistantIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleAssistantChip(c.id)}
                        className="flex items-center gap-[6px] rounded-full border px-[11px] py-[6px] text-[12px] font-semibold"
                        style={
                          active
                            ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                            : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                        }
                      >
                        {active && <Icon name="check" size={12} />}
                        {c.name}
                      </button>
                    );
                  })}
                  {assistantOptions.length === 0 && (
                    <span className="text-[12.5px] text-[var(--subtle)]">No assistants on this offering yet.</span>
                  )}
                </div>
                <p className="mt-[9px] text-[11.5px] leading-[1.45] text-[var(--subtle)]">
                  Each assistant logs this assignment for their own students. Leave all selected to assign across the
                  whole offering.
                </p>
              </div>
            </div>

            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button
                onClick={() => setModalOpen(false)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!canSave || saving}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:cursor-not-allowed"
                style={{ background: canSave ? "var(--brand)" : "var(--subtle)" }}
              >
                {saving ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                {editId ? "Save changes" : "Create & assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
