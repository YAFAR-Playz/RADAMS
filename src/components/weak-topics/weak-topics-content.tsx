"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import type { Role } from "@/lib/roles";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import {
  getOfferingCourse,
  listTopicCatalog,
  createTopic,
  updateTopic,
  deleteTopic,
  listStudentTopicsForOffering,
  listAllStudentTopicsForOffering,
  submitStudentTopic,
  updateStudentTopicSubmission,
  removeStudentTopicSubmission,
  getAssistantFillingProgress,
  type TopicOption,
  type MaterialInput,
  type AssistantStudentTopics,
  type HeadStudentTopics,
  type AssistantFillingProgress,
} from "@/lib/actions/weak-topics";
import {
  getMyStudentMonthlyComments,
  setStudentMonthlyComment,
  getAllStudentMonthlyComments,
  setStudentMonthlyCommentAsHead,
} from "@/lib/actions/academic-report";
import { pickerOnlyDateProps } from "@/lib/date-input";

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

const PAGE_SIZE = 10;

function PageNav({ page, setPage, pageCount, pageStart, total, label }: { page: number; setPage: (p: number) => void; pageCount: number; pageStart: number; total: number; label: string }) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-[10px] p-[12px_18px]">
      <span className="text-[12px] text-[var(--subtle)]">
        {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, total)} of {total} {label}
      </span>
      <div className="flex flex-wrap gap-[5px]">
        {Array.from({ length: pageCount }, (_, i) => i)
          .filter((i) => i >= page - 2 && i <= page + 2)
          .map((i) => {
            const active = i === page;
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
  );
}

const MATERIAL_KIND_FALLBACK_LABEL: Record<"video" | "notes" | "tricky_question", string> = {
  video: "Video",
  notes: "Notes",
  tricky_question: "Tricky Question",
};

function MaterialLinks({ materials }: { materials: { id: string; kind: "video" | "notes" | "tricky_question"; label: string | null; link: string; duration: string | null }[] }) {
  if (materials.length === 0) return null;
  return (
    <>
      {materials.map((m) => (
        <a key={m.id} href={m.link} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
          {m.label?.trim() || MATERIAL_KIND_FALLBACK_LABEL[m.kind]}
          {m.duration ? ` (${m.duration})` : ""}
        </a>
      ))}
    </>
  );
}

function MaterialsEditor({ materials, onChange }: { materials: MaterialInput[]; onChange: (m: MaterialInput[]) => void }) {
  function update(i: number, patch: Partial<MaterialInput>) {
    onChange(materials.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function add() {
    onChange([...materials, { kind: "video", label: "", link: "", duration: "" }]);
  }
  function remove(i: number) {
    onChange(materials.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-[6px]">
      {materials.map((m, i) => (
        <div key={i} className="flex items-center gap-[6px]">
          <select
            value={m.kind}
            onChange={(e) => update(i, { kind: e.target.value as "video" | "notes" | "tricky_question" })}
            className="h-9 flex-none rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[8px] text-[12.5px] text-[var(--text)] outline-none"
          >
            <option value="video">Video</option>
            <option value="notes">Notes</option>
            <option value="tricky_question">Tricky Question</option>
          </select>
          <input
            value={m.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="Name"
            className="h-9 w-[110px] flex-none rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
          />
          <input
            value={m.link}
            onChange={(e) => update(i, { link: e.target.value })}
            placeholder="Link"
            className="h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
          />
          {m.kind === "video" && (
            <input
              value={m.duration}
              onChange={(e) => update(i, { duration: e.target.value })}
              placeholder="Duration"
              className="h-9 w-[90px] flex-none rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
            />
          )}
          <button onClick={() => remove(i)} className="flex h-9 w-9 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <button onClick={add} className="flex h-8 w-fit items-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)]">
        <Icon name="plus" size={12} />
        Add item
      </button>
    </div>
  );
}

export function WeakTopicsContent({ role }: { role: Role }) {
  const [tab, setTab] = useState<"submit" | "catalog" | "manage" | "progress">(role === "assistant" ? "submit" : "catalog");
  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      if (data.length) setOfferingId(data[0].id);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Weak topics</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Weak / revision topics</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              {role === "head" ? "Manage the topic catalog and every student's monthly tags and comment." : "Tag your students with weak topics each month."}
            </p>
          </div>
          <div className="flex flex-none items-center gap-[8px]">
            {offerings && offerings.length > 0 && (
              <select
                value={offeringId}
                onChange={(e) => setOfferingId(e.target.value)}
                className="h-10 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {tab !== "catalog" && (
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                {...pickerOnlyDateProps}
                className="h-10 cursor-pointer rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
              />
            )}
          </div>
        </div>

        {role === "head" && (
          <div className="mt-4 flex gap-[6px] border-b border-[var(--border)]">
            {(["catalog", "manage", "progress"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-9 border-b-2 px-[4px] text-[13px] font-semibold ${
                  tab === t ? "border-[var(--brand)] text-[var(--text)]" : "border-transparent text-[var(--muted)]"
                }`}
              >
                {t === "catalog" ? "Topic catalog" : t === "manage" ? "Manage submissions" : "Assistant progress"}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-[14px] py-[10px] text-[13px] font-medium text-[var(--danger)]">
          {error}
        </div>
      )}

      {!offerings ? (
        <SkeletonRow className="h-[120px]" />
      ) : offerings.length === 0 ? (
        <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[30px] text-center text-[13px] text-[var(--muted)]">
          No courses yet.
        </div>
      ) : role === "assistant" || tab === "submit" ? (
        <AssistantSubmitPanel offeringId={offeringId} period={period} setError={setError} />
      ) : tab === "catalog" ? (
        <CatalogPanel offeringId={offeringId} setError={setError} />
      ) : tab === "progress" ? (
        <ProgressPanel offeringId={offeringId} period={period} />
      ) : (
        <ManagePanel offeringId={offeringId} period={period} setError={setError} />
      )}
    </div>
  );
}

function CatalogPanel({ offeringId, setError }: { offeringId: string; setError: (e: string | null) => void }) {
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>("");
  const [topics, setTopics] = useState<TopicOption[] | null>(null);
  const [label, setLabel] = useState("");
  const [materials, setMaterials] = useState<MaterialInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function reload() {
    if (!offeringId) return;
    setTopics(null);
    getOfferingCourse(offeringId).then((c) => {
      setCourseId(c?.courseId ?? null);
      setCourseName(c?.courseName ?? "");
      listTopicCatalog(c?.courseId ?? undefined).then(setTopics);
    });
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId]);

  async function onCreate() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await createTopic({ courseId, label, materials });
      setLabel("");
      setMaterials([]);
      reload();
    } catch {
      setError("Couldn't create that topic — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteTopic(id);
      reload();
    } catch {
      setError("Couldn't delete that topic — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[16px_18px] shadow-[var(--shadow)]">
        <div className="mb-3 text-[12.5px] font-semibold text-[var(--muted)]">
          Topics for <span className="text-[var(--text)]">{courseName || "this course"}</span>
        </div>

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Topic label, e.g. Quadratic equations"
          className="mb-[8px] h-9 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
        />
        <MaterialsEditor materials={materials} onChange={setMaterials} />
        <button
          onClick={onCreate}
          disabled={!label.trim() || busy}
          className="mt-[10px] flex h-9 items-center gap-[6px] rounded-[8px] bg-[var(--brand)] px-[14px] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
        >
          {busy ? <Spinner size={13} /> : <Icon name="plus" size={13} />}
          Add topic
        </button>
      </div>

      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {topics === null ? (
          <div className="p-[16px]">
            <SkeletonRow className="h-[40px]" />
          </div>
        ) : topics.length === 0 ? (
          <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No topics yet — add one above.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {topics.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-[10px] p-[14px_18px]">
                {editingId === t.id ? (
                  <EditTopicRow
                    topic={t}
                    onCancel={() => setEditingId(null)}
                    onSave={async (patch) => {
                      setBusy(true);
                      try {
                        await updateTopic(t.id, patch);
                        setEditingId(null);
                        reload();
                      } catch {
                        setError("Couldn't update that topic — try again.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                ) : (
                  <>
                    <div>
                      <div className="text-[13.5px] font-semibold text-[var(--text)]">{t.label}</div>
                      <div className="mt-[2px] flex flex-wrap items-center gap-[10px] text-[12px] text-[var(--muted)]">
                        <MaterialLinks materials={t.materials} />
                      </div>
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <button
                        onClick={() => {
                          setEditingId(t.id);
                        }}
                        className="text-[12.5px] font-semibold text-[var(--muted)] hover:text-[var(--text)]"
                      >
                        Edit
                      </button>
                      <button onClick={() => onDelete(t.id)} disabled={busy} className="text-[12.5px] font-semibold text-[var(--danger)] disabled:opacity-60">
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditTopicRow({
  topic,
  onSave,
  onCancel,
}: {
  topic: TopicOption;
  onSave: (patch: { label: string; materials: MaterialInput[] }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(topic.label);
  const [materials, setMaterials] = useState<MaterialInput[]>(
    topic.materials.map((m) => ({ kind: m.kind, label: m.label ?? "", link: m.link, duration: m.duration ?? "" }))
  );

  return (
    <div className="flex w-full flex-col gap-[8px]">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-9 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
      />
      <MaterialsEditor materials={materials} onChange={setMaterials} />
      <div className="flex items-center gap-[8px]">
        <button onClick={() => onSave({ label, materials })} className="h-9 rounded-[8px] bg-[var(--brand)] px-[12px] text-[12.5px] font-semibold text-[var(--brandfg)]">
          Save
        </button>
        <button onClick={onCancel} className="h-9 rounded-[8px] border border-[var(--border)] px-[12px] text-[12.5px] font-semibold text-[var(--muted)]">
          Cancel
        </button>
      </div>
    </div>
  );
}

function AssistantSubmitPanel({ offeringId, period, setError }: { offeringId: string; period: string; setError: (e: string | null) => void }) {
  const [students, setStudents] = useState<AssistantStudentTopics[] | null>(null);
  const [catalog, setCatalog] = useState<TopicOption[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savedComments, setSavedComments] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  function reload() {
    if (!offeringId) return;
    setStudents(null);
    listStudentTopicsForOffering(offeringId, period).then(setStudents);
    getMyStudentMonthlyComments(offeringId, period).then((c) => {
      setComments(c);
      setSavedComments(c);
    });
    setCatalog(null);
    getOfferingCourse(offeringId).then((c) => listTopicCatalog(c?.courseId ?? undefined).then(setCatalog));
  }

  useEffect(() => {
    (() => {
      setPage(0);
      reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, period]);

  const pageCount = Math.max(1, Math.ceil((students?.length ?? 0) / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = (students ?? []).slice(pageStart, pageStart + PAGE_SIZE);

  async function onSaveComment(studentId: string) {
    setSavingComment(studentId);
    try {
      await setStudentMonthlyComment(studentId, offeringId, period, comments[studentId] ?? "");
      setSavedComments((c) => ({ ...c, [studentId]: comments[studentId] ?? "" }));
    } catch {
      setError("Couldn't save that comment — try again.");
    } finally {
      setSavingComment(null);
    }
  }

  async function onSubmit(studentId: string) {
    const topicId = picks[studentId];
    if (!topicId) return;
    setBusyId(studentId);
    try {
      await submitStudentTopic({ studentId, offeringId, topicId, period });
      setPicks((p) => ({ ...p, [studentId]: "" }));
      reload();
    } catch {
      setError("Couldn't submit that topic — it may already be tagged for this student this month.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRemove(id: string) {
    setBusyId(id);
    try {
      await removeStudentTopicSubmission(id);
      reload();
    } catch {
      setError("Couldn't remove that submission — try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!offeringId) return null;

  return (
    <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
      {students === null || catalog === null ? (
        <div className="p-[16px]">
          <SkeletonRow className="h-[40px]" />
        </div>
      ) : students.length === 0 ? (
        <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No students assigned to you for this offering.</div>
      ) : (
        <>
        <div className="divide-y divide-[var(--border)]">
          {pageRows.map((s) => (
            <div key={s.studentId} className="flex flex-col gap-[8px] p-[14px_18px]">
              <div className="flex flex-wrap items-center justify-between gap-[10px]">
                <div className="text-[13.5px] font-semibold text-[var(--text)]">{s.studentName}</div>
                <div className="flex items-center gap-[8px]">
                  <select
                    value={picks[s.studentId] ?? ""}
                    onChange={(e) => setPicks((p) => ({ ...p, [s.studentId]: e.target.value }))}
                    className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
                  >
                    <option value="">Add a weak topic…</option>
                    {catalog.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onSubmit(s.studentId)}
                    disabled={!picks[s.studentId] || busyId === s.studentId}
                    className="flex h-9 items-center gap-[6px] rounded-[8px] bg-[var(--brand)] px-[12px] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                  >
                    {busyId === s.studentId ? <Spinner size={13} /> : <Icon name="plus" size={13} />}
                    Add
                  </button>
                </div>
              </div>
              {s.submissions.length > 0 && (
                <div className="flex flex-wrap gap-[6px]">
                  {s.submissions.map((sub) => (
                    <span key={sub.id} className="flex items-center gap-[6px] rounded-full bg-[var(--oks)] py-[4px] pl-[10px] pr-[6px] text-[12px] font-semibold text-[var(--ok)]">
                      {sub.topicLabel}
                      <button onClick={() => onRemove(sub.id)} disabled={busyId === sub.id} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-60">
                        <Icon name="x" size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-start gap-[8px]">
                <textarea
                  value={comments[s.studentId] ?? ""}
                  onChange={(e) => setComments((c) => ({ ...c, [s.studentId]: e.target.value }))}
                  placeholder="Overall comment for this student this month — shown in the head's monthly report…"
                  className="h-[54px] flex-1 resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] py-[7px] text-[12px] leading-[1.4] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                />
                <button
                  onClick={() => onSaveComment(s.studentId)}
                  disabled={(comments[s.studentId] ?? "") === (savedComments[s.studentId] ?? "") || savingComment === s.studentId}
                  className="flex h-9 flex-none items-center gap-[6px] self-end rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
                >
                  {savingComment === s.studentId ? <Spinner size={13} /> : <Icon name="check" size={13} />}
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
        <PageNav page={safePage} setPage={setPage} pageCount={pageCount} pageStart={pageStart} total={students.length} label="students" />
        </>
      )}
    </div>
  );
}

function ManagePanel({ offeringId, period, setError }: { offeringId: string; period: string; setError: (e: string | null) => void }) {
  const [students, setStudents] = useState<HeadStudentTopics[] | null>(null);
  const [catalog, setCatalog] = useState<TopicOption[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [savedComments, setSavedComments] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  function reload() {
    if (!offeringId) return;
    setStudents(null);
    listAllStudentTopicsForOffering(offeringId, period).then(setStudents);
    getAllStudentMonthlyComments(offeringId, period).then((c) => {
      setComments(c);
      setSavedComments(c);
    });
    setCatalog(null);
    getOfferingCourse(offeringId).then((c) => listTopicCatalog(c?.courseId ?? undefined).then(setCatalog));
  }

  useEffect(() => {
    (() => {
      setPage(0);
      reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, period]);

  const pageCount = Math.max(1, Math.ceil((students?.length ?? 0) / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = (students ?? []).slice(pageStart, pageStart + PAGE_SIZE);

  async function onSaveComment(studentId: string) {
    setSavingComment(studentId);
    try {
      await setStudentMonthlyCommentAsHead(studentId, offeringId, period, comments[studentId] ?? "");
      setSavedComments((c) => ({ ...c, [studentId]: comments[studentId] ?? "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that comment — try again.");
    } finally {
      setSavingComment(null);
    }
  }

  async function onAdd(studentId: string) {
    const topicId = picks[studentId];
    if (!topicId) return;
    setBusyId(studentId);
    try {
      await submitStudentTopic({ studentId, offeringId, topicId, period });
      setPicks((p) => ({ ...p, [studentId]: "" }));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that topic — it may already be tagged for this student this month.");
    } finally {
      setBusyId(null);
    }
  }

  async function onChangeTopic(submissionId: string, topicId: string) {
    if (!topicId) return;
    setBusyId(submissionId);
    try {
      await updateStudentTopicSubmission(submissionId, topicId);
      reload();
    } catch {
      setError("Couldn't change that topic — try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function onRemove(id: string) {
    setBusyId(id);
    try {
      await removeStudentTopicSubmission(id);
      reload();
    } catch {
      setError("Couldn't remove that submission — try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!offeringId) return null;

  return (
    <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
      {students === null || catalog === null ? (
        <div className="p-[16px]">
          <SkeletonRow className="h-[40px]" />
        </div>
      ) : students.length === 0 ? (
        <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No students enrolled in this course yet.</div>
      ) : (
        <>
        <div className="divide-y divide-[var(--border)]">
          {pageRows.map((s) => (
            <div key={s.studentId} className="flex flex-col gap-[8px] p-[14px_18px]">
              <div className="flex flex-wrap items-center justify-between gap-[10px]">
                <div>
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{s.studentName}</div>
                  <div className="text-[11.5px] text-[var(--subtle)]">{s.assistantName ?? "Unassigned"}</div>
                </div>
                <div className="flex items-center gap-[8px]">
                  <select
                    value={picks[s.studentId] ?? ""}
                    onChange={(e) => setPicks((p) => ({ ...p, [s.studentId]: e.target.value }))}
                    className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
                  >
                    <option value="">Add a weak topic…</option>
                    {catalog.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onAdd(s.studentId)}
                    disabled={!picks[s.studentId] || busyId === s.studentId}
                    className="flex h-9 items-center gap-[6px] rounded-[8px] bg-[var(--brand)] px-[12px] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                  >
                    {busyId === s.studentId ? <Spinner size={13} /> : <Icon name="plus" size={13} />}
                    Add
                  </button>
                </div>
              </div>
              {s.submissions.length > 0 && (
                <div className="flex flex-wrap gap-[8px]">
                  {s.submissions.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-[6px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[4px_4px_4px_10px]">
                      <select
                        value={sub.topicId}
                        onChange={(e) => onChangeTopic(sub.id, e.target.value)}
                        disabled={busyId === sub.id}
                        className="h-7 rounded-[6px] border-none bg-transparent text-[12px] font-semibold text-[var(--text)] outline-none disabled:opacity-60"
                      >
                        {catalog.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onRemove(sub.id)}
                        disabled={busyId === sub.id}
                        className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[var(--muted)] hover:bg-black/10 hover:text-[var(--danger)] disabled:opacity-60"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-start gap-[8px]">
                <textarea
                  value={comments[s.studentId] ?? ""}
                  onChange={(e) => setComments((c) => ({ ...c, [s.studentId]: e.target.value }))}
                  placeholder="Overall comment for this student this month — shown in the monthly report…"
                  className="h-[54px] flex-1 resize-none rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] py-[7px] text-[12px] leading-[1.4] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                />
                <button
                  onClick={() => onSaveComment(s.studentId)}
                  disabled={(comments[s.studentId] ?? "") === (savedComments[s.studentId] ?? "") || savingComment === s.studentId}
                  className="flex h-9 flex-none items-center gap-[6px] self-end rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
                >
                  {savingComment === s.studentId ? <Spinner size={13} /> : <Icon name="check" size={13} />}
                  Save
                </button>
              </div>
            </div>
          ))}
        </div>
        <PageNav page={safePage} setPage={setPage} pageCount={pageCount} pageStart={pageStart} total={students.length} label="students" />
        </>
      )}
    </div>
  );
}

function ProgressPanel({ offeringId, period }: { offeringId: string; period: string }) {
  const [rows, setRows] = useState<AssistantFillingProgress[] | null>(null);

  useEffect(() => {
    (() => {
      if (!offeringId) return;
      setRows(null);
      getAssistantFillingProgress(offeringId, period).then(setRows);
    })();
  }, [offeringId, period]);

  if (!offeringId) return null;

  const totals = (rows ?? []).reduce(
    (acc, r) => ({ students: acc.students + r.totalStudents, filled: acc.filled + r.filled, pending: acc.pending + r.pending }),
    { students: 0, filled: 0, pending: 0 }
  );

  return (
    <div className="flex flex-col gap-3">
      {rows !== null && rows.length > 0 && (
        <div className="flex flex-wrap gap-[10px]">
          <div className="min-w-[130px] flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] p-[13px_15px] shadow-[var(--shadow)]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Students</div>
            <div className="mt-[3px] text-[19px] font-bold text-[var(--text)]">{totals.students}</div>
          </div>
          <div className="min-w-[130px] flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] p-[13px_15px] shadow-[var(--shadow)]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Filled this month</div>
            <div className="mt-[3px] text-[19px] font-bold text-[var(--ok)]">{totals.filled}</div>
          </div>
          <div className="min-w-[130px] flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] p-[13px_15px] shadow-[var(--shadow)]">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Still pending</div>
            <div className="mt-[3px] text-[19px] font-bold text-[var(--warn)]">{totals.pending}</div>
          </div>
        </div>
      )}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {rows === null ? (
          <div className="p-[16px]">
            <SkeletonRow className="h-[40px]" />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No assistants assigned to this course yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {rows.map((r) => {
              const pct = r.totalStudents ? Math.round((r.filled / r.totalStudents) * 100) : 0;
              return (
                <div key={r.assistantId} className="flex flex-col gap-[7px] p-[14px_18px]">
                  <div className="flex flex-wrap items-center justify-between gap-[8px]">
                    <div className="text-[13.5px] font-semibold text-[var(--text)]">{r.assistantName}</div>
                    <div className="flex items-center gap-[8px] text-[12px] font-semibold">
                      <span className="text-[var(--ok)]">{r.filled} filled</span>
                      {r.pending > 0 && <span className="text-[var(--warn)]">{r.pending} pending</span>}
                    </div>
                  </div>
                  <div className="h-[7px] w-full overflow-hidden rounded-full bg-[var(--surface2)]">
                    <div className="h-full rounded-full bg-[var(--ok)]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[11.5px] text-[var(--subtle)]">
                    {r.filled} of {r.totalStudents} students tagged this month
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
