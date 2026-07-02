"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import type { Role } from "@/lib/roles";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import {
  listCoursesForOrg,
  listTopicCatalog,
  createTopic,
  updateTopic,
  deleteTopic,
  listStudentTopicsForOffering,
  submitStudentTopic,
  removeStudentTopicSubmission,
  listPendingTopicApprovals,
  reviewTopicSubmission,
  type TopicOption,
  type AssistantStudentTopics,
  type StudentTopicSubmission,
} from "@/lib/actions/weak-topics";

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

const STATUS_TONE: Record<string, string> = {
  pending: "bg-[var(--warns)] text-[var(--warn)]",
  approved: "bg-[var(--oks)] text-[var(--ok)]",
  rejected: "bg-[var(--dangers)] text-[var(--danger)]",
};

export function WeakTopicsContent({ role }: { role: Role }) {
  const [tab, setTab] = useState<"submit" | "catalog" | "approvals">(role === "assistant" ? "submit" : "catalog");
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
              {role === "head" ? "Manage the topic catalog and review monthly submissions." : "Tag your students with weak topics each month."}
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
                className="h-10 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none"
              />
            )}
          </div>
        </div>

        {role === "head" && (
          <div className="mt-4 flex gap-[6px] border-b border-[var(--border)]">
            {(["catalog", "approvals"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`h-9 border-b-2 px-[4px] text-[13px] font-semibold ${
                  tab === t ? "border-[var(--brand)] text-[var(--text)]" : "border-transparent text-[var(--muted)]"
                }`}
              >
                {t === "catalog" ? "Topic catalog" : "Review submissions"}
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
        <CatalogPanel setError={setError} />
      ) : (
        <ApprovalsPanel offeringId={offeringId} period={period} setError={setError} />
      )}
    </div>
  );
}

function CatalogPanel({ setError }: { setError: (e: string | null) => void }) {
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [courseFilter, setCourseFilter] = useState("");
  const [topics, setTopics] = useState<TopicOption[] | null>(null);
  const [label, setLabel] = useState("");
  const [courseId, setCourseId] = useState("");
  const [videoLink, setVideoLink] = useState("");
  const [driveLink, setDriveLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    listCoursesForOrg().then(setCourses);
  }, []);

  function reload() {
    setTopics(null);
    listTopicCatalog(courseFilter || undefined).then(setTopics);
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseFilter]);

  async function onCreate() {
    if (!label.trim()) return;
    setBusy(true);
    try {
      await createTopic({ courseId: courseId || null, label, videoLink, driveLink });
      setLabel("");
      setVideoLink("");
      setDriveLink("");
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
        <div className="mb-3 flex flex-wrap items-center gap-[8px]">
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Topic label, e.g. Quadratic equations"
            className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] lg:col-span-2"
          />
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
          >
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={videoLink}
            onChange={(e) => setVideoLink(e.target.value)}
            placeholder="Video link (optional)"
            className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
          />
          <input
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="Drive link (optional)"
            className="h-9 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
          />
        </div>
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
                        {t.courseName && <span>{t.courseName}</span>}
                        {t.videoLink && (
                          <a href={t.videoLink} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                            Video
                          </a>
                        )}
                        {t.driveLink && (
                          <a href={t.driveLink} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                            Drive
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <button onClick={() => setEditingId(t.id)} className="text-[12.5px] font-semibold text-[var(--muted)] hover:text-[var(--text)]">
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
  onSave: (patch: { label: string; videoLink: string; driveLink: string }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(topic.label);
  const [videoLink, setVideoLink] = useState(topic.videoLink ?? "");
  const [driveLink, setDriveLink] = useState(topic.driveLink ?? "");

  return (
    <div className="flex w-full flex-wrap items-center gap-[8px]">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-9 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
      />
      <input
        value={videoLink}
        onChange={(e) => setVideoLink(e.target.value)}
        placeholder="Video link"
        className="h-9 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
      />
      <input
        value={driveLink}
        onChange={(e) => setDriveLink(e.target.value)}
        placeholder="Drive link"
        className="h-9 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none"
      />
      <button onClick={() => onSave({ label, videoLink, driveLink })} className="h-9 rounded-[8px] bg-[var(--brand)] px-[12px] text-[12.5px] font-semibold text-[var(--brandfg)]">
        Save
      </button>
      <button onClick={onCancel} className="h-9 rounded-[8px] border border-[var(--border)] px-[12px] text-[12.5px] font-semibold text-[var(--muted)]">
        Cancel
      </button>
    </div>
  );
}

function AssistantSubmitPanel({ offeringId, period, setError }: { offeringId: string; period: string; setError: (e: string | null) => void }) {
  const [students, setStudents] = useState<AssistantStudentTopics[] | null>(null);
  const [catalog, setCatalog] = useState<TopicOption[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    if (!offeringId) return;
    setStudents(null);
    listStudentTopicsForOffering(offeringId, period).then(setStudents);
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, period]);

  useEffect(() => {
    listTopicCatalog().then(setCatalog);
  }, []);

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
        <div className="divide-y divide-[var(--border)]">
          {students.map((s) => (
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
                    <span key={sub.id} className={`flex items-center gap-[6px] rounded-full py-[4px] pl-[10px] pr-[6px] text-[12px] font-semibold ${STATUS_TONE[sub.status]}`}>
                      {sub.topicLabel}
                      <span className="text-[10.5px] font-medium opacity-70">{sub.status}</span>
                      {sub.status === "pending" && (
                        <button onClick={() => onRemove(sub.id)} disabled={busyId === sub.id} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10 disabled:opacity-60">
                          <Icon name="x" size={11} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalsPanel({ offeringId, period, setError }: { offeringId: string; period: string; setError: (e: string | null) => void }) {
  const [items, setItems] = useState<StudentTopicSubmission[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    if (!offeringId) return;
    setItems(null);
    listPendingTopicApprovals(offeringId, period).then(setItems);
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offeringId, period]);

  async function onReview(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    try {
      await reviewTopicSubmission(id, status);
      reload();
    } catch {
      setError("Couldn't update that submission — try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!offeringId) return null;

  return (
    <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
      {items === null ? (
        <div className="p-[16px]">
          <SkeletonRow className="h-[40px]" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-[30px] text-center text-[13px] text-[var(--muted)]">No submissions for this month yet.</div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {items.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center justify-between gap-[10px] p-[14px_18px]">
              <div>
                <div className="text-[13.5px] font-semibold text-[var(--text)]">
                  {it.studentName} <span className="font-normal text-[var(--muted)]">— {it.topicLabel}</span>
                </div>
                <div className="mt-[2px] text-[12px] text-[var(--muted)]">Submitted by {it.assistantName ?? "—"}</div>
              </div>
              <div className="flex items-center gap-[8px]">
                <span className={`rounded-full px-[10px] py-[4px] text-[12px] font-semibold ${STATUS_TONE[it.status]}`}>{it.status}</span>
                {it.status === "pending" && (
                  <>
                    <button
                      onClick={() => onReview(it.id, "approved")}
                      disabled={busyId === it.id}
                      className="h-8 rounded-[8px] bg-[var(--brand)] px-[10px] text-[12px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReview(it.id, "rejected")}
                      disabled={busyId === it.id}
                      className="h-8 rounded-[8px] border border-[var(--border)] px-[10px] text-[12px] font-semibold text-[var(--muted)] disabled:opacity-60"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
