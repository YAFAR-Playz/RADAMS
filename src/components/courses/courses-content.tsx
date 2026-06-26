"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import {
  listCourses,
  listHeadsForOrg,
  saveCourse,
  toggleCourseActive,
  updateCourseDates,
  getEnrolledStudents,
  getInstallmentSchedule,
  type CourseOffering,
  type HeadOption,
  type EnrolledStudent,
  type CourseInput,
} from "@/lib/actions/courses";
import { applyOfferingFeeChangeToPlans } from "@/lib/actions/payments";

type ScheduleDraftRow = { seq: number; amount: string; dueDate: string };

function defaultScheduleRows(count: number, total: string, startDate: string): ScheduleDraftRow[] {
  const totalNum = Number(total) || 0;
  const per = count > 0 ? Math.round((totalNum / count) * 100) / 100 : 0;
  const base = startDate ? new Date(startDate) : new Date();
  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1;
    const amount = isLast ? Math.round((totalNum - per * (count - 1)) * 100) / 100 : per;
    const due = new Date(base);
    due.setMonth(due.getMonth() + i);
    return { seq: i + 1, amount: String(amount), dueDate: due.toISOString().slice(0, 10) };
  });
}

const PAGE_SIZE = 8;
const STUDENT_PAGE_SIZE = 12;

function fmt(n: number | null) {
  return n != null ? `£${n.toLocaleString("en-US")}` : "—";
}

const emptyForm: CourseInput = {
  courseName: "",
  session: "",
  unit: "",
  start: "",
  end: "",
  feeFull: "",
  feeInstallmentTotal: "",
  installmentCount: 1,
  headIds: [],
};

export function CoursesContent() {
  const [courses, setCourses] = useState<CourseOffering[] | null>(null);
  const [heads, setHeads] = useState<HeadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(0);

  const [viewId, setViewId] = useState<string | null>(null);
  const [viewStudents, setViewStudents] = useState<EnrolledStudent[] | null>(null);
  const [viewPage, setViewPage] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseInput>(emptyForm);
  const [scheduleOverrides, setScheduleOverrides] = useState<Record<number, { amount?: string; dueDate?: string }>>({});
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [savingDatesId, setSavingDatesId] = useState<string | null>(null);
  const [editingStudentCount, setEditingStudentCount] = useState(0);
  const [originalFees, setOriginalFees] = useState<{ feeFull: string; feeInstallmentTotal: string; installmentCount: number } | null>(null);
  const [feeChangeConfirmOpen, setFeeChangeConfirmOpen] = useState(false);
  const [applyingFeeChange, setApplyingFeeChange] = useState(false);

  // The number of rows shown always equals form.installmentCount — row count
  // can never desync from the selected count, only the amount/date per row
  // can be overridden.
  const schedule: ScheduleDraftRow[] = useMemo(() => {
    if (form.installmentCount <= 1) return [];
    const defaults = defaultScheduleRows(form.installmentCount, form.feeInstallmentTotal, form.start);
    return defaults.map((row) => {
      const override = scheduleOverrides[row.seq];
      return override ? { ...row, ...override } : row;
    });
  }, [form.installmentCount, form.feeInstallmentTotal, form.start, scheduleOverrides]);

  function updateScheduleRow(seq: number, patch: { amount?: string; dueDate?: string }) {
    setScheduleOverrides((prev) => ({ ...prev, [seq]: { ...prev[seq], ...patch } }));
  }

  async function reload() {
    setLoading(true);
    try {
      const [c, h] = await Promise.all([listCourses(), listHeadsForOrg()]);
      setCourses(c);
      setHeads(h);
    } catch {
      setError("Couldn't load courses — try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!courses) return [];
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !c.heads.some((h) => h.toLowerCase().includes(q))) return false;
      if (filter === "active" && !c.active) return false;
      if (filter === "inactive" && c.active) return false;
      return true;
    });
  }, [courses, search, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const stats = courses
    ? [
        { value: String(courses.filter((c) => c.active).length), label: "Active offerings", color: "var(--ok)" },
        { value: String(courses.filter((c) => !c.active).length), label: "Inactive", color: "var(--muted)" },
        { value: String(courses.reduce((s, c) => s + c.students, 0)), label: "Enrolled students", color: "var(--brand)" },
      ]
    : [];

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setScheduleOverrides({});
    setEditingStudentCount(0);
    setOriginalFees(null);
    setModalOpen(true);
  }

  async function openEdit(c: CourseOffering) {
    const parts = c.name.split(" · ");
    setEditId(c.id);
    setForm({
      id: c.id,
      courseName: parts[0] ?? "",
      session: parts[1] ?? "",
      unit: parts[2] ?? "",
      start: c.start ?? "",
      end: c.end ?? "",
      feeFull: c.feeFull != null ? String(c.feeFull) : "",
      feeInstallmentTotal: c.feeInstallmentTotal != null ? String(c.feeInstallmentTotal) : "",
      installmentCount: c.installmentCount,
      headIds: heads.filter((h) => c.heads.includes(h.name)).map((h) => h.id),
    });
    setScheduleOverrides({});
    setEditingStudentCount(c.students);
    setOriginalFees({
      feeFull: c.feeFull != null ? String(c.feeFull) : "",
      feeInstallmentTotal: c.feeInstallmentTotal != null ? String(c.feeInstallmentTotal) : "",
      installmentCount: c.installmentCount,
    });
    setModalOpen(true);
    if (c.installmentCount > 1) {
      setScheduleLoading(true);
      try {
        const existing = await getInstallmentSchedule(c.id);
        const overrides: Record<number, { amount?: string; dueDate?: string }> = {};
        for (const r of existing) {
          overrides[r.seq] = { amount: String(r.amount), dueDate: r.dueDate ?? "" };
        }
        setScheduleOverrides(overrides);
      } catch {
        // Fall back to the computed defaults already shown.
      } finally {
        setScheduleLoading(false);
      }
    }
  }

  const canSave = form.courseName.trim().length > 0 && form.session.trim().length > 0;

  const feesChanged =
    !!originalFees &&
    (originalFees.feeFull !== form.feeFull ||
      originalFees.feeInstallmentTotal !== form.feeInstallmentTotal ||
      originalFees.installmentCount !== form.installmentCount);

  async function onSave() {
    if (!canSave) return;
    if (editId && editingStudentCount > 0 && feesChanged) {
      setFeeChangeConfirmOpen(true);
      return;
    }
    await doSave();
  }

  async function doSave(applyToExisting?: boolean) {
    setSaving(true);
    try {
      const { id } = await saveCourse({
        ...form,
        id: editId ?? undefined,
        schedule: form.installmentCount > 1 ? schedule.map((r) => ({ seq: r.seq, amount: Number(r.amount) || 0, dueDate: r.dueDate })) : undefined,
      });
      if (applyToExisting) {
        setApplyingFeeChange(true);
        await applyOfferingFeeChangeToPlans(id);
        setApplyingFeeChange(false);
      }
      setFeeChangeConfirmOpen(false);
      setModalOpen(false);
      await reload();
    } catch {
      setError("Couldn't save this course — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleActive(c: CourseOffering) {
    setTogglingId(c.id);
    setCourses((prev) => (prev ? prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)) : prev));
    try {
      await toggleCourseActive(c.id, !c.active);
    } catch {
      setError("Couldn't update this course — try again.");
    } finally {
      setTogglingId(null);
    }
  }

  async function onDateChange(c: CourseOffering, field: "start" | "end", value: string) {
    const nextStart = field === "start" ? value : c.start ?? "";
    const nextEnd = field === "end" ? value : c.end ?? "";
    setCourses((prev) => (prev ? prev.map((x) => (x.id === c.id ? { ...x, [field === "start" ? "start" : "end"]: value } : x)) : prev));
    setSavingDatesId(c.id);
    try {
      await updateCourseDates(c.id, nextStart, nextEnd);
    } catch {
      setError("Couldn't save dates — try again.");
    } finally {
      setSavingDatesId(null);
    }
  }

  async function onToggleView(c: CourseOffering) {
    if (viewId === c.id) {
      setViewId(null);
      return;
    }
    setViewId(c.id);
    setViewPage(0);
    setViewStudents(null);
    try {
      setViewStudents(await getEnrolledStudents(c.id));
    } catch {
      setError("Couldn't load enrolled students.");
    }
  }

  const viewPageCount = Math.max(1, Math.ceil((viewStudents?.length ?? 0) / STUDENT_PAGE_SIZE));
  const safeViewPage = Math.min(viewPage, viewPageCount - 1);
  const viewPageStart = safeViewPage * STUDENT_PAGE_SIZE;
  const viewPageRows = (viewStudents ?? []).slice(viewPageStart, viewPageStart + STUDENT_PAGE_SIZE);

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
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Admin</div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Courses &amp; sessions</h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              Monitor active course offerings, set start &amp; end dates, and activate or deactivate any course-unit-session.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] bg-[var(--brand)] px-[15px] py-[10px] text-[13px] font-semibold text-[var(--brandfg)]"
          >
            <Icon name="plus" size={16} />
            New course offering
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {loading || !courses
            ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[58px]" />)
            : stats.map((s) => (
                <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[12px_14px]">
                  <div className="text-[21px] font-bold leading-[1.1] tracking-[-0.02em]" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="mt-[2px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
                </div>
              ))}
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-[10px]">
        <div className="flex h-10 min-w-[200px] max-w-[300px] flex-1 items-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-3">
          <Icon name="search" size={16} className="text-[var(--subtle)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search courses…"
            className="h-full w-full border-none bg-transparent text-[13.5px] text-[var(--text)] outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-[6px]">
          {(["all", "active", "inactive"] as const).map((v) => {
            const active = filter === v;
            return (
              <button
                key={v}
                onClick={() => {
                  setFilter(v);
                  setPage(0);
                }}
                className="rounded-full border px-3 py-[7px] text-[12.5px] font-semibold"
                style={
                  active
                    ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                    : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                }
              >
                {v === "all" ? "All" : v === "active" ? "Active" : "Inactive"}
              </button>
            );
          })}
        </div>
      </div>

      {/* COURSE CARDS */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {loading && !courses
          ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} className="h-[220px]" />)
          : pageRows.map((c) => {
              const expanded = viewId === c.id;
              return (
                <div key={c.id} className="flex flex-col gap-3 rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[14px_15px] shadow-[var(--shadow)]">
                  <div className="flex items-center gap-[11px]">
                    <div
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px]"
                      style={{ background: c.active ? "var(--brands)" : "var(--surface2)", color: c.active ? "var(--brand)" : "var(--subtle)" }}
                    >
                      <Icon name="book" size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-[var(--text)]">{c.name}</div>
                      <div className="text-[11.5px] text-[var(--subtle)]">
                        {c.heads.length ? c.heads.join(", ") : "Unassigned"} · {c.students} students
                      </div>
                    </div>
                    <span
                      className="inline-flex flex-none items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold"
                      style={c.active ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--surface2)", color: "var(--muted)" }}
                    >
                      <span className="h-[6px] w-[6px] rounded-full" style={{ background: "currentColor" }} />
                      {c.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-[8px] text-[12px]">
                    <div className="min-w-[130px] flex-1 rounded-[8px] border border-[var(--border2)] bg-[var(--surface2)] p-[8px_10px]">
                      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Full payment</div>
                      <div className="mt-[2px] font-mono text-[14px] font-bold text-[var(--text)]">{fmt(c.feeFull)}</div>
                    </div>
                    <div className="min-w-[130px] flex-1 rounded-[8px] border border-[var(--border2)] bg-[var(--surface2)] p-[8px_10px]">
                      <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">Installments ({c.installmentCount})</div>
                      <div className="mt-[2px] font-mono text-[14px] font-bold text-[var(--text)]">{fmt(c.feeInstallmentTotal)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-[7px]">
                    <input
                      type="date"
                      defaultValue={c.start ?? ""}
                      onBlur={(e) => onDateChange(c, "start", e.target.value)}
                      className="h-[34px] min-w-0 flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-2 text-[11.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                    />
                    <span className="text-[11px] text-[var(--subtle)]">→</span>
                    <input
                      type="date"
                      defaultValue={c.end ?? ""}
                      onBlur={(e) => onDateChange(c, "end", e.target.value)}
                      className="h-[34px] min-w-0 flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-2 text-[11.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                    />
                    {savingDatesId === c.id && <Spinner size={13} className="flex-none text-[var(--subtle)]" />}
                  </div>
                  <div className="flex flex-wrap gap-[7px]">
                    <button
                      onClick={() => onToggleView(c)}
                      className="flex flex-1 items-center justify-center gap-[5px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-[10px] py-2 text-[12px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                    >
                      <Icon name="users" size={14} />
                      Students
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      title="Edit course"
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                    >
                      <Icon name="settings" size={15} />
                    </button>
                    <button
                      onClick={() => onToggleActive(c)}
                      disabled={togglingId === c.id}
                      className="flex flex-1 items-center justify-center gap-[6px] rounded-[8px] border bg-[var(--surface)] px-[11px] py-2 text-[12px] font-semibold hover:bg-[var(--surface2)] disabled:opacity-60"
                      style={{ borderColor: c.active ? "var(--border)" : "var(--ok)", color: c.active ? "var(--danger)" : "var(--ok)" }}
                    >
                      {togglingId === c.id ? <Spinner size={13} /> : c.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                  {expanded && (
                    <div className="border-t border-[var(--border2)] pt-[10px]">
                      <div className="mb-2 flex items-center justify-between gap-[10px]">
                        <span className="text-[12px] font-bold text-[var(--text)]">Enrolled students</span>
                        <span className="text-[11.5px] text-[var(--subtle)]">
                          {viewStudents
                            ? `${viewStudents.length ? viewPageStart + 1 : 0}–${Math.min(viewPageStart + STUDENT_PAGE_SIZE, viewStudents.length)} of ${viewStudents.length}`
                            : ""}
                        </span>
                      </div>
                      {viewStudents === null ? (
                        <div className="flex flex-col gap-1">
                          {Array.from({ length: 3 }, (_, i) => (
                            <SkeletonRow key={i} className="h-[36px]" />
                          ))}
                        </div>
                      ) : viewPageRows.length === 0 ? (
                        <div className="p-2 text-[12.5px] text-[var(--subtle)]">No students enrolled yet.</div>
                      ) : (
                        <div className="flex flex-col gap-[2px]">
                          {viewPageRows.map((st, i) => (
                            <div key={i} className="flex items-center gap-[10px] rounded-[9px] p-[7px_9px] hover:bg-[var(--surface2)]">
                              <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[var(--surface2)] text-[11px] font-bold text-[var(--muted)]">
                                {st.initials}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[12.5px] font-semibold text-[var(--text)]">{st.name}</div>
                                <div className="text-[11px] text-[var(--subtle)]">Assistant: {st.assistant ?? "Unassigned"}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {viewPageCount > 1 && (
                        <div className="mt-[9px] flex flex-wrap items-center gap-[5px]">
                          {Array.from({ length: viewPageCount }, (_, i) => i)
                            .filter((i) => i >= safeViewPage - 2 && i <= safeViewPage + 2)
                            .map((i) => {
                              const active = i === safeViewPage;
                              return (
                                <button
                                  key={i}
                                  onClick={() => setViewPage(i)}
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
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        {!loading && courses && pageRows.length === 0 && (
          <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)] lg:col-span-2">
            No courses match these filters.
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[11px_16px] shadow-[var(--shadow)]">
          <span className="text-[12.5px] text-[var(--subtle)]">
            {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length}
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

      {/* NEW / EDIT COURSE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="book" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">{editId ? "Edit course offering" : "New course offering"}</h3>
                <div className="text-[12px] text-[var(--muted)]">Course + session, with an optional unit</div>
              </div>
              <button onClick={() => setModalOpen(false)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-[13px] overflow-y-auto p-[16px_18px]">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-[10px]">
                <div>
                  <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">Course</label>
                  <input
                    value={form.courseName}
                    onChange={(e) => setForm((f) => ({ ...f, courseName: e.target.value }))}
                    placeholder="e.g. Physics"
                    className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">Session</label>
                  <input
                    value={form.session}
                    onChange={(e) => setForm((f) => ({ ...f, session: e.target.value }))}
                    placeholder="e.g. June 2026"
                    className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">
                    Unit <span className="text-[var(--subtle)]">(optional)</span>
                  </label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="e.g. Unit 1"
                    className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[10px]">
                <div>
                  <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">Start date</label>
                  <input
                    type="date"
                    value={form.start}
                    onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                    className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">End date</label>
                  <input
                    type="date"
                    value={form.end}
                    onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                    className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[10px]">
                <div>
                  <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">Full-payment price (£)</label>
                  <input
                    value={form.feeFull}
                    onChange={(e) => setForm((f) => ({ ...f, feeFull: e.target.value.replace(/[^0-9]/g, "") }))}
                    placeholder="600"
                    className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px] font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">Installments total (£)</label>
                  <input
                    value={form.feeInstallmentTotal}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, "");
                      setForm((f) => ({ ...f, feeInstallmentTotal: v }));
                    }}
                    placeholder="660"
                    className="h-10 w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px] font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">Number of installments</label>
                <div className="flex h-10 items-center rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[11px]">
                  <select
                    value={form.installmentCount}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setForm((f) => ({ ...f, installmentCount: n }));
                    }}
                    className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[13px] font-semibold text-[var(--text)] outline-none"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {form.installmentCount > 1 && (
                <div key={form.installmentCount} className="overflow-hidden rounded-[var(--rad-sm)] border border-[var(--border)]">
                  <div className="border-b border-[var(--border2)] bg-[var(--surface2)] p-[8px_12px] text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)]">
                    Installment schedule
                  </div>
                  {scheduleLoading ? (
                    <div className="flex flex-col gap-2 p-3">
                      {Array.from({ length: form.installmentCount }, (_, i) => (
                        <SkeletonRow key={i} className="h-[34px]" />
                      ))}
                    </div>
                  ) : (
                    schedule.map((row) => (
                      <div key={row.seq} className="flex flex-wrap items-center gap-2 border-b border-[var(--border2)] p-[9px_12px] last:border-b-0">
                        <span className="w-[80px] flex-none text-[12.5px] font-semibold text-[var(--text)]">Payment {row.seq}</span>
                        <div className="flex h-[34px] min-w-[90px] flex-1 items-center gap-[2px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[9px]">
                          <span className="text-[12px] font-semibold text-[var(--subtle)]">£</span>
                          <input
                            value={row.amount}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9.]/g, "");
                              updateScheduleRow(row.seq, { amount: v });
                            }}
                            className="w-full border-none bg-transparent text-right font-mono text-[12.5px] font-bold text-[var(--ok)] outline-none"
                          />
                        </div>
                        <input
                          type="date"
                          value={row.dueDate}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateScheduleRow(row.seq, { dueDate: v });
                          }}
                          className="h-[34px] min-w-[120px] flex-1 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[9px] text-[12px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
              <div>
                <label className="mb-[6px] block text-[12px] font-semibold text-[var(--text)]">
                  Course head(s) <span className="text-[var(--subtle)]">(assign one or more)</span>
                </label>
                <div className="flex flex-wrap gap-[6px]">
                  {heads.map((h) => {
                    const sel = form.headIds.includes(h.id);
                    return (
                      <button
                        key={h.id}
                        onClick={() => setForm((f) => ({ ...f, headIds: sel ? f.headIds.filter((x) => x !== h.id) : [...f.headIds, h.id] }))}
                        className="inline-flex items-center gap-[5px] rounded-full border px-[11px] py-[5px] text-[12px] font-semibold"
                        style={
                          sel
                            ? { borderColor: "var(--brand)", background: "var(--brands)", color: "var(--brand)" }
                            : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                        }
                      >
                        {sel && <Icon name="check" size={12} />}
                        {h.name}
                      </button>
                    );
                  })}
                  {heads.length === 0 && <span className="text-[12.5px] text-[var(--subtle)]">No heads in your org yet.</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button onClick={() => setModalOpen(false)} className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]">
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={!canSave || saving}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {saving ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                {editId ? "Save changes" : "Create offering"}
              </button>
            </div>
          </div>
        </div>
      )}

      {feeChangeConfirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[var(--warns)] text-[var(--warn)]">
                <Icon name="alert" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">This course has {editingStudentCount} enrolled student{editingStudentCount === 1 ? "" : "s"}</h3>
                <div className="text-[12px] text-[var(--muted)]">You changed the price or installment plan — what should happen to students already enrolled?</div>
              </div>
            </div>
            <div className="flex flex-col gap-[10px] p-[16px_18px]">
              <button
                onClick={() => doSave(false)}
                disabled={saving || applyingFeeChange}
                className="flex flex-col items-start gap-[3px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[12px_14px] text-left hover:border-[var(--brand)] disabled:opacity-60"
              >
                <span className="text-[13.5px] font-semibold text-[var(--text)]">Keep their current price</span>
                <span className="text-[12px] text-[var(--muted)]">Existing students&apos; payment plans stay as-is. The new price only applies to students who enroll from now on.</span>
              </button>
              <button
                onClick={() => doSave(true)}
                disabled={saving || applyingFeeChange}
                className="flex flex-col items-start gap-[3px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[12px_14px] text-left hover:border-[var(--brand)] disabled:opacity-60"
              >
                <span className="text-[13.5px] font-semibold text-[var(--text)]">Update everyone to the new price</span>
                <span className="text-[12px] text-[var(--muted)]">
                  Recalculates every enrolled student&apos;s plan against the new fee. Anything already marked paid is preserved; only the remaining unpaid installments are rescaled.
                </span>
              </button>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button
                onClick={() => setFeeChangeConfirmOpen(false)}
                disabled={saving || applyingFeeChange}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)] disabled:opacity-60"
              >
                {(saving || applyingFeeChange) && <Spinner size={15} />}
                {applyingFeeChange ? "Updating student plans…" : saving ? "Saving…" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
