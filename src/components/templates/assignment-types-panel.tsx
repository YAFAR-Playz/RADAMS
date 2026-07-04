"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  listAssignmentTemplates,
  createAssignmentTemplate,
  updateAssignmentTemplate,
  deleteAssignmentTemplate,
  type AssignmentTemplate,
} from "@/lib/actions/assignment-templates";

type Draft = { label: string; hasGrade: boolean; hasComment: boolean };

function describe(t: { hasGrade: boolean; hasComment: boolean }) {
  if (t.hasGrade && t.hasComment) return "Status, grade, and a comment";
  if (t.hasGrade) return "Status and a grade — no comment";
  if (t.hasComment) return "Status and a comment — no grade";
  return "Status only";
}

export function AssignmentTypesPanel() {
  const [templates, setTemplates] = useState<AssignmentTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>({ label: "", hasGrade: true, hasComment: true });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function reload() {
    listAssignmentTemplates().then(setTemplates);
  }

  useEffect(() => {
    reload();
  }, []);

  function openNew() {
    setDraft({ label: "", hasGrade: true, hasComment: true });
    setEditingId("new");
  }

  function openEdit(t: AssignmentTemplate) {
    setDraft({ label: t.label, hasGrade: t.hasGrade, hasComment: t.hasComment });
    setEditingId(t.id);
  }

  async function onSave() {
    if (!draft.label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId === "new") {
        await createAssignmentTemplate(draft);
      } else if (editingId) {
        await updateAssignmentTemplate(editingId, draft);
      }
      setEditingId(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this assignment type — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    setDeleting(true);
    setError(null);
    try {
      await deleteAssignmentTemplate(id);
      setConfirmDeleteId(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete this assignment type — try again.");
    } finally {
      setDeleting(false);
    }
  }

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Admin · Assignment types</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Assignment logging types</h1>
            <p className="m-0 mt-[3px] max-w-[600px] text-[13px] leading-[1.5] text-[var(--muted)]">
              Control which columns an assistant fills in when logging an assignment. Heads pick one of these when creating an assignment.
            </p>
          </div>
          <button
            onClick={openNew}
            className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
          >
            <Icon name="plus" size={16} />
            New type
          </button>
        </div>
      </div>

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {templates === null ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 3 }, (_, i) => (
              <SkeletonRow key={i} className="h-[56px]" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No assignment types yet — add one to get started.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {templates.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-[10px] p-[14px_18px]">
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{t.label}</div>
                  <div className="mt-[2px] flex flex-wrap gap-[6px] text-[11.5px]">
                    <span
                      className="rounded-full px-[8px] py-[2px] font-semibold"
                      style={t.hasGrade ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--surface2)", color: "var(--subtle)" }}
                    >
                      {t.hasGrade ? "Grade" : "No grade"}
                    </span>
                    <span
                      className="rounded-full px-[8px] py-[2px] font-semibold"
                      style={t.hasComment ? { background: "var(--infos)", color: "var(--info)" } : { background: "var(--surface2)", color: "var(--subtle)" }}
                    >
                      {t.hasComment ? "Comment" : "No comment"}
                    </span>
                    <span className="text-[var(--subtle)]">{describe(t)}</span>
                  </div>
                </div>
                {confirmDeleteId === t.id ? (
                  <div className="flex items-center gap-[8px]">
                    <span className="text-[12px] font-medium text-[var(--danger)]">Delete this type?</span>
                    <button
                      onClick={() => onDelete(t.id)}
                      disabled={deleting}
                      className="flex h-8 items-center gap-[5px] rounded-[7px] bg-[var(--danger)] px-[10px] text-[12px] font-semibold text-white disabled:opacity-60"
                    >
                      {deleting ? <Spinner size={12} /> : <Icon name="trash" size={12} />}
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex h-8 items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-[8px]">
                    <button
                      onClick={() => openEdit(t)}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                    >
                      <Icon name="settings" size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(t.id)}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)]"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editingId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[420px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">{editingId === "new" ? "New assignment type" : "Edit assignment type"}</h3>
              </div>
              <button onClick={() => setEditingId(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[14px] p-[18px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Name</label>
                <input
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                  placeholder="e.g. Mock quiz"
                  className="h-11 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div className="flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[12px_13px]">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">Grade column</div>
                  <div className="text-[11.5px] leading-[1.4] text-[var(--subtle)]">Assistants enter a mark out of the assignment&apos;s max marks.</div>
                </div>
                <button
                  onClick={() => setDraft((d) => ({ ...d, hasGrade: !d.hasGrade }))}
                  role="switch"
                  aria-checked={draft.hasGrade}
                  className="relative h-[22px] w-[38px] flex-none rounded-full transition-colors"
                  style={{ background: draft.hasGrade ? "var(--brand)" : "var(--border)" }}
                >
                  <span
                    className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left]"
                    style={{ left: draft.hasGrade ? "18px" : "2px" }}
                  />
                </button>
              </div>
              <div className="flex items-center gap-[11px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[12px_13px]">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">Comment column</div>
                  <div className="text-[11.5px] leading-[1.4] text-[var(--subtle)]">Assistants can leave a free-text note.</div>
                </div>
                <button
                  onClick={() => setDraft((d) => ({ ...d, hasComment: !d.hasComment }))}
                  role="switch"
                  aria-checked={draft.hasComment}
                  className="relative h-[22px] w-[38px] flex-none rounded-full transition-colors"
                  style={{ background: draft.hasComment ? "var(--brand)" : "var(--border)" }}
                >
                  <span
                    className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left]"
                    style={{ left: draft.hasComment ? "18px" : "2px" }}
                  />
                </button>
              </div>
              <p className="m-0 text-[11.5px] leading-[1.5] text-[var(--subtle)]">
                Status (logged / not logged) always applies — these two toggles control what else shows up next to it.
              </p>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button
                onClick={() => setEditingId(null)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving || !draft.label.trim()}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {saving ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
