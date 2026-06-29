"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { toneColors } from "@/lib/tone";
import type { Role } from "@/lib/roles";
import { statusDef, STATUS_DEFS } from "@/lib/assignments-data";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import { listOfferingAssistants, type AssistantOption } from "@/lib/actions/head-assignments";
import {
  getStudentsForOffering,
  getCourseLabelsForStudents,
  reassignStudentAssistant,
  updateStudent,
  getStudentEnrollments,
  listAllOfferingsForOrg,
  addStudentEnrollment,
  removeStudentEnrollment,
  type StudentRow,
  type EnrollmentDetail,
  type OfferingChoice,
} from "@/lib/actions/students";
import { getEffectiveTemplate, getOrgBrandName } from "@/lib/actions/templates";
import { getParentWhatsappLink } from "@/lib/actions/branding";
import { applyTemplateVars } from "@/lib/message-vars";
import { autoAssignUnassigned } from "@/lib/actions/assistant-groups";
import { getPaymentStatusForOffering, type PaymentStatusSummary } from "@/lib/actions/payments";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { currencySymbol } from "@/lib/currency";

const PAGE_SIZE = 20;

type EditDraft = {
  studentId: string;
  initials: string;
  name: string;
  email: string;
  phone: string;
  guardianName: string;
  guardianPhone: string;
  left: boolean;
};

export function StudentsContent({ role }: { role: Role }) {
  const isAdmin = role === "admin";
  const isAssistant = role === "assistant";
  const useDropdown = role === "admin" || role === "registration";
  const canEdit = !isAssistant;

  const [offerings, setOfferings] = useState<OfferingOption[] | null>(null);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<AssistantOption[] | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"enroll" | "name">("enroll");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "pending" | "installments">("all");
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [welcomeId, setWelcomeId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [welcomeTemplate, setWelcomeTemplate] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("RadAMS");
  const [parentWhatsappLink, setParentWhatsappLink] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [paymentByStudent, setPaymentByStudent] = useState<Record<string, PaymentStatusSummary>>({});
  const [courseLabelsByStudent, setCourseLabelsByStudent] = useState<Record<string, string[]>>({});
  const [editEnrollments, setEditEnrollments] = useState<EnrollmentDetail[] | null>(null);
  const [allOfferings, setAllOfferings] = useState<OfferingChoice[] | null>(null);
  const [addOfferingId, setAddOfferingId] = useState("");
  const [enrollmentBusy, setEnrollmentBusy] = useState(false);
  const isRegistration = role === "registration";
  const canEditCourses = role === "admin" || role === "registration";
  const [sym, setSym] = useState("£");

  useEffect(() => {
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
    Promise.all([getEffectiveTemplate("welcome"), getOrgBrandName(), getParentWhatsappLink()]).then(([tpl, org, link]) => {
      setWelcomeTemplate(tpl);
      setOrgName(org);
      setParentWhatsappLink(link);
    });
    getPayrollSettings().then((settings) => setSym(currencySymbol(settings?.currency)));
  }, []);

  async function reload(id: string) {
    setLoading(true);
    try {
      const [rows, ast] = await Promise.all([getStudentsForOffering(id), listOfferingAssistants(id)]);
      setStudents(rows);
      setAssistants(ast);
      if (isRegistration) {
        const [payments, labels] = await Promise.all([
          getPaymentStatusForOffering(id),
          getCourseLabelsForStudents(rows.map((r) => r.studentId)),
        ]);
        setPaymentByStudent(payments);
        setCourseLabelsByStudent(labels);
      }
    } catch {
      setError("Couldn't load students for this course.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      if (!offeringId) {
        setStudents([]);
        setAssistants([]);
        return;
      }
      setPage(0);
      await reload(offeringId);
    })();
  }, [offeringId]);

  const offeringsLoading = offerings === null;
  const current = offerings?.find((o) => o.id === offeringId) ?? null;

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = search.trim().toLowerCase();
    const rows = students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (isRegistration && paymentFilter !== "all") {
        const payment = paymentByStudent[s.studentId];
        if (paymentFilter === "paid" && payment?.status !== "paid") return false;
        if (paymentFilter === "pending" && (!payment || payment.status === "paid")) return false;
        if (paymentFilter === "installments" && payment?.planType !== "installments") return false;
      }
      return true;
    });
    return rows.slice().sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime();
    });
  }, [students, search, sortBy, isRegistration, paymentFilter, paymentByStudent]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  async function onReassign(enrollmentId: string, studentId: string, assistantId: string) {
    if (!offeringId) return;
    setSavingId(studentId);
    setStudents((prev) =>
      prev
        ? prev.map((s) =>
            s.enrollmentId === enrollmentId
              ? { ...s, assistantId, assistantName: assistants?.find((a) => a.id === assistantId)?.name ?? null }
              : s
          )
        : prev
    );
    try {
      await reassignStudentAssistant(enrollmentId, assistantId || null);
    } catch {
      setError("Couldn't reassign this student — try again.");
    } finally {
      setSavingId(null);
    }
  }

  const canReassignAssistants = role === "admin" || role === "head";
  const unassignedCount = students?.filter((s) => !s.assistantId).length ?? 0;

  async function onAutoAssign() {
    if (!offeringId) return;
    setAutoAssigning(true);
    try {
      await autoAssignUnassigned(offeringId, "equal");
      await reload(offeringId);
    } catch {
      setError("Couldn't auto-assign students — try again.");
    } finally {
      setAutoAssigning(false);
    }
  }

  function openEdit(s: StudentRow) {
    setEditDraft({
      studentId: s.studentId,
      initials: s.initials,
      name: s.name,
      email: s.email ?? "",
      phone: s.phone ?? "",
      guardianName: s.guardianName ?? "",
      guardianPhone: s.guardianPhone ?? "",
      left: !!s.leftAt,
    });
    if (canEditCourses) {
      setEditEnrollments(null);
      getStudentEnrollments(s.studentId).then(setEditEnrollments);
      if (!allOfferings) listAllOfferingsForOrg().then(setAllOfferings);
    }
  }

  async function onAddEnrollment(studentId: string) {
    if (!addOfferingId) return;
    setEnrollmentBusy(true);
    try {
      const { enrollmentId } = await addStudentEnrollment(studentId, addOfferingId);
      const label = allOfferings?.find((o) => o.id === addOfferingId)?.label ?? "—";
      setEditEnrollments((prev) => (prev ? [...prev, { enrollmentId, offeringId: addOfferingId, label }] : prev));
      setAddOfferingId("");
      if (offeringId) await reload(offeringId);
    } catch {
      setError("Couldn't enroll this student — try again.");
    } finally {
      setEnrollmentBusy(false);
    }
  }

  async function onRemoveEnrollment(enrollmentId: string) {
    setEnrollmentBusy(true);
    try {
      await removeStudentEnrollment(enrollmentId);
      setEditEnrollments((prev) => (prev ? prev.filter((e) => e.enrollmentId !== enrollmentId) : prev));
      if (offeringId) await reload(offeringId);
    } catch {
      setError("Couldn't remove this enrollment — try again.");
    } finally {
      setEnrollmentBusy(false);
    }
  }

  async function onSaveEdit() {
    if (!editDraft || !offeringId) return;
    setSavingEdit(true);
    try {
      await updateStudent(editDraft.studentId, {
        name: editDraft.name,
        email: editDraft.email,
        phone: editDraft.phone,
        guardianName: editDraft.guardianName,
        guardianPhone: editDraft.guardianPhone,
        left: editDraft.left,
      });
      setEditDraft(null);
      await reload(offeringId);
    } catch {
      setError("Couldn't save changes — try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  const welcomeStudent = welcomeId ? students?.find((s) => s.studentId === welcomeId) ?? null : null;
  const welcomeMessage =
    welcomeStudent && welcomeTemplate
      ? applyTemplateVars(welcomeTemplate, {
          org: orgName,
          student: welcomeStudent.name,
          course: current?.label ?? "this course",
          assistant_name: welcomeStudent.assistantName ?? "your assistant",
          student_group_link: welcomeStudent.assistantWhatsappLink ?? "(not set yet — ask your head)",
          parent_group_link: parentWhatsappLink ?? "(not set yet — ask your admin)",
        })
      : "";
  const welcomeDigits = welcomeStudent?.guardianPhone ? welcomeStudent.guardianPhone.replace(/[^\d]/g, "") : "";
  const welcomeWaUrl = `https://wa.me/${welcomeDigits}?text=${encodeURIComponent(welcomeMessage)}`;

  const pageNumbers = useMemo(() => {
    const lo = Math.max(0, safePage - 2);
    const hi = Math.min(pageCount - 1, safePage + 2);
    const out: number[] = [];
    for (let i = lo; i <= hi; i++) out.push(i);
    return out;
  }, [safePage, pageCount]);

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
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">
              {isAdmin ? "Admin · Students" : role === "registration" ? "Registration · Students" : isAssistant ? "My students" : "Students"}
            </div>
            <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              {role === "registration" ? "Enrollment & payments" : "Student progress"}
            </h1>
            <p className="m-0 mt-[3px] text-[13px] text-[var(--muted)]">
              {role === "registration"
                ? "Every student org-wide — enrollment, contact details, and payment status."
                : isAssistant
                  ? "Your assigned students — performance to date and contact details."
                  : "Every student's status across recent assignments. Reassign or edit as needed."}
            </p>
          </div>
          {canReassignAssistants && (
            <button
              onClick={onAutoAssign}
              disabled={unassignedCount === 0 || autoAssigning || !offeringId}
              title={unassignedCount === 0 ? "No unassigned students on this course" : "Auto-assign unassigned students"}
              className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--brand)] bg-[var(--surface)] px-[14px] py-[10px] text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--subtle)] disabled:hover:bg-[var(--surface)]"
            >
              {autoAssigning ? <Spinner size={15} /> : <Icon name="users" size={16} />}
              Auto-assign
              <span
                className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[11px] font-bold"
                style={
                  unassignedCount === 0
                    ? { background: "var(--surface2)", color: "var(--subtle)" }
                    : { background: "var(--brand)", color: "var(--brandfg)" }
                }
              >
                {unassignedCount}
              </span>
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
            useDropdown ? (
              <select
                value={offeringId ?? ""}
                onChange={(e) => setOfferingId(e.target.value)}
                className="h-[38px] min-w-[230px] cursor-pointer appearance-none rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] font-semibold text-[var(--text)] outline-none"
              >
                {offerings.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
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
        {isRegistration ? (
          <div className="flex flex-wrap items-center gap-[6px]">
            {(
              [
                ["all", "All"],
                ["paid", "Fully paid"],
                ["pending", "Pending"],
                ["installments", "Installments"],
              ] as const
            ).map(([value, label]) => {
              const active = paymentFilter === value;
              return (
                <button
                  key={value}
                  onClick={() => setPaymentFilter(value)}
                  className="rounded-full border px-3 py-[7px] text-[12.5px] font-semibold"
                  style={
                    active
                      ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                      : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_DEFS.filter((s) => s.key !== "excused").map((s) => {
              const { bg, fg } = toneColors(s.tone);
              return (
                <span key={s.key} className="inline-flex items-center gap-[5px] text-[12px] font-medium text-[var(--muted)]">
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px]" style={{ background: bg, color: fg }}>
                    <Icon name={s.icon} size={12} />
                  </span>
                  {s.label}
                </span>
              );
            })}
          </div>
        )}
        <div className="ml-auto flex items-center gap-[6px]">
          <span className="text-[11.5px] font-semibold text-[var(--subtle)]">Sort</span>
          <div className="flex gap-[2px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[2px]">
            <button
              onClick={() => setSortBy("enroll")}
              className="rounded-[6px] px-[10px] py-[5px] text-[11.5px] font-semibold"
              style={sortBy === "enroll" ? { background: "var(--brand)", color: "var(--brandfg)" } : { color: "var(--muted)" }}
            >
              Enrollment
            </button>
            <button
              onClick={() => setSortBy("name")}
              className="rounded-[6px] px-[10px] py-[5px] text-[11.5px] font-semibold"
              style={sortBy === "name" ? { background: "var(--brand)", color: "var(--brandfg)" } : { color: "var(--muted)" }}
            >
              Name
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {loading && !students ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} className="h-[56px]" />
            ))}
          </div>
        ) : (
          <div>
            <div className="hidden flex-wrap items-center gap-[10px_14px] border-b border-[var(--border2)] px-[18px] py-[11px] text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--subtle)] sm:flex">
              <span className="min-w-0 flex-[2_1_190px]">Student</span>
              {isRegistration ? (
                <>
                  <span className="min-w-0 flex-[1_1_130px]">Payment status</span>
                  <span className="min-w-0 flex-[1_1_130px]">Courses enrolled</span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-[2_1_130px]">Progress</span>
                  {!isAssistant && <span className="min-w-0 flex-[1_1_130px]">Assistant</span>}
                  <span className="w-[54px] flex-none text-right">Avg</span>
                </>
              )}
              <span className="w-[74px] flex-none" />
            </div>
            {pageRows.length === 0 ? (
              <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No students match these filters.</div>
            ) : (
              pageRows.map((st) => (
                <div
                  key={st.studentId}
                  className="flex flex-wrap items-center gap-[10px_14px] border-b border-[var(--border2)] px-[18px] py-[12px] hover:bg-[var(--surface2)]"
                  style={{ opacity: st.leftAt ? 0.55 : 1 }}
                >
                  <div className="flex min-w-0 flex-[2_1_190px] items-center gap-[10px]">
                    <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                      {st.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[var(--text)]">
                        {st.name}
                        {savingId === st.studentId && <Spinner size={12} className="ml-2 inline text-[var(--subtle)]" />}
                      </div>
                      {st.email && (
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--subtle)]">{st.email}</div>
                      )}
                      <div className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] text-[var(--subtle)]">
                        {st.phone ?? "—"} · G {st.guardianPhone ?? "—"}
                        {st.leftAt && <span className="ml-1 font-semibold text-[var(--danger)]"> · Left</span>}
                      </div>
                    </div>
                  </div>
                  {isRegistration ? (
                    <>
                      <div className="min-w-0 flex-[1_1_130px]">
                        {(() => {
                          const payment = paymentByStudent[st.studentId];
                          if (!payment) {
                            return <span className="text-[12px] text-[var(--subtle)]">No plan</span>;
                          }
                          const tone =
                            payment.status === "paid" ? "ok" : payment.status === "partial" ? "warn" : "danger";
                          const { bg, fg } = toneColors(tone);
                          const label =
                            payment.status === "paid" ? "Paid" : payment.status === "partial" ? "Partial" : "Pending";
                          return (
                            <div className="flex flex-col gap-[3px]">
                              <span
                                className="inline-flex w-fit items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold"
                                style={{ background: bg, color: fg }}
                              >
                                {label}
                              </span>
                              <span className="text-[11px] text-[var(--subtle)]">
                                {sym}{payment.paidAmount.toLocaleString()} / {sym}{payment.totalAmount.toLocaleString()}
                                {payment.planType === "installments" ? " · installments" : payment.planType === "full" ? " · full" : ""}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="min-w-0 flex-[1_1_130px]">
                        {(() => {
                          const labels = courseLabelsByStudent[st.studentId] ?? [];
                          if (labels.length === 0) return <span className="text-[12px] text-[var(--subtle)]">No courses</span>;
                          return (
                            <div className="flex flex-wrap gap-[4px]">
                              {labels.map((label, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center rounded-full bg-[var(--surface2)] px-[8px] py-[2px] text-[11.5px] font-semibold text-[var(--text)]"
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex min-w-0 flex-[2_1_130px] flex-wrap items-center gap-[4px]">
                        {st.cells.length === 0 ? (
                          <span className="text-[12px] text-[var(--subtle)]">No assignments yet</span>
                        ) : (
                          st.cells.map((c, i) => {
                            const def = statusDef(c.status as never);
                            const { bg, fg } = def ? toneColors(def.tone) : { bg: "var(--surface2)", fg: "var(--subtle)" };
                            return (
                              <span
                                key={i}
                                title={`${c.assignmentTitle}: ${def?.label ?? "Not logged"}`}
                                className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px]"
                                style={{ background: bg, color: fg }}
                              >
                                <Icon name={def?.icon ?? "clock"} size={12} />
                              </span>
                            );
                          })
                        )}
                      </div>
                      {!isAssistant && (
                        <div className="min-w-0 flex-[1_1_130px]">
                          <div className="flex h-[34px] items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
                            <select
                              value={st.assistantId ?? ""}
                              onChange={(e) => onReassign(st.enrollmentId, st.studentId, e.target.value)}
                              className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                            >
                              <option value="">Unassigned</option>
                              {(assistants ?? []).map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                      <span className="w-[54px] flex-none text-right font-mono text-[13px] font-bold text-[var(--text)]">
                        {st.leftAt ? "—" : st.avgGrade != null ? `${st.avgGrade}%` : "—"}
                      </span>
                    </>
                  )}
                  <div className="flex w-[74px] flex-none justify-end gap-[6px]">
                    {isAssistant && (
                      <button
                        onClick={() => setWelcomeId(st.studentId)}
                        title="Send welcome message"
                        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[#25D366] bg-[var(--surface)] text-[#1ea952] hover:bg-[rgba(37,211,102,0.1)]"
                      >
                        <Icon name="send" size={16} />
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => openEdit(st)}
                        title="Edit student"
                        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                      >
                        <Icon name="settings" size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            {pageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[var(--border2)] p-[11px_16px]">
                <span className="text-[12px] text-[var(--subtle)]">
                  {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of {filtered.length} students
                </span>
                <div className="flex gap-[5px]">
                  {pageNumbers.map((i) => {
                    const active = i === safePage;
                    return (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className="h-[30px] min-w-[30px] rounded-[7px] border px-2 text-[12px] font-semibold"
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

      {/* WELCOME MESSAGE MODAL */}
      {welcomeStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-[rgba(37,211,102,0.14)] text-[#1ea952]">
                <Icon name="send" size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Welcome message</h3>
                <div className="text-[12px] text-[var(--muted)]">
                  To {welcomeStudent.name}&apos;s guardian · {welcomeStudent.guardianPhone ?? "no phone on file"}
                </div>
              </div>
              <button onClick={() => setWelcomeId(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="p-[18px]">
              <div className="mb-[7px] text-[12px] font-semibold text-[var(--muted)]">Message preview</div>
              <div className="whitespace-pre-wrap rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] p-[13px] text-[13px] leading-[1.55] text-[var(--text)]">
                {welcomeMessage}
              </div>
            </div>
            <div className="flex gap-[10px] p-[0_18px_16px]">
              <button
                onClick={() => setWelcomeId(null)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
              <a
                href={welcomeWaUrl}
                target="_blank"
                rel="noopener"
                onClick={() => setWelcomeId(null)}
                className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[#25D366] text-[13.5px] font-semibold text-white"
              >
                <Icon name="send" size={16} />
                Open WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {editDraft && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                {editDraft.initials}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">Edit student</h3>
              </div>
              <button
                onClick={() => setEditDraft(null)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto p-[16px_18px]">
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Full name</label>
                <input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((d) => d && { ...d, name: e.target.value })}
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Email</label>
                <input
                  type="email"
                  value={editDraft.email}
                  onChange={(e) => setEditDraft((d) => d && { ...d, email: e.target.value })}
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-[12px]">
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Phone</label>
                  <input
                    value={editDraft.phone}
                    onChange={(e) => setEditDraft((d) => d && { ...d, phone: e.target.value })}
                    className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">
                    Guardian phone <span className="text-[var(--danger)]">*</span>
                  </label>
                  <input
                    value={editDraft.guardianPhone}
                    onChange={(e) => setEditDraft((d) => d && { ...d, guardianPhone: e.target.value })}
                    className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                  />
                </div>
              </div>
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Guardian name</label>
                <input
                  value={editDraft.guardianName}
                  onChange={(e) => setEditDraft((d) => d && { ...d, guardianName: e.target.value })}
                  className="h-[42px] w-full rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-[13px] text-[13.5px] text-[var(--text)] outline-none focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brands)]"
                />
              </div>
              {canEditCourses && (
                <div>
                  <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Courses enrolled</label>
                  {editEnrollments === null ? (
                    <SkeletonRow className="h-[60px]" />
                  ) : (
                    <div className="flex flex-col gap-[6px]">
                      {editEnrollments.length === 0 && <div className="text-[12.5px] text-[var(--subtle)]">Not enrolled in any course.</div>}
                      {editEnrollments.map((e) => (
                        <div key={e.enrollmentId} className="flex items-center gap-[8px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[8px_10px]">
                          <span className="flex-1 text-[12.5px] font-semibold text-[var(--text)]">{e.label}</span>
                          <button
                            onClick={() => onRemoveEnrollment(e.enrollmentId)}
                            disabled={enrollmentBusy}
                            className="flex h-7 w-7 flex-none items-center justify-center rounded-[7px] border border-[var(--border)] bg-[var(--surface)] text-[var(--subtle)] hover:border-[var(--danger)] hover:bg-[var(--dangers)] hover:text-[var(--danger)] disabled:opacity-60"
                          >
                            <Icon name="x" size={13} />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center gap-[8px]">
                        <div className="flex h-9 flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                          <select
                            value={addOfferingId}
                            onChange={(e) => setAddOfferingId(e.target.value)}
                            className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
                          >
                            <option value="">Add a course…</option>
                            {(allOfferings ?? [])
                              .filter((o) => !editEnrollments.some((e) => e.offeringId === o.id))
                              .map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                          </select>
                        </div>
                        <button
                          onClick={() => onAddEnrollment(editDraft.studentId)}
                          disabled={!addOfferingId || enrollmentBusy}
                          className="flex h-9 flex-none items-center gap-[6px] rounded-[8px] bg-[var(--brand)] px-[12px] text-[12.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                        >
                          {enrollmentBusy ? <Spinner size={13} /> : <Icon name="plus" size={13} />}
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div
                className="flex items-center gap-[11px] rounded-[var(--rad-sm)] border p-[12px_13px]"
                style={{ background: editDraft.left ? "var(--dangers)" : "var(--surface2)", borderColor: editDraft.left ? "var(--danger)" : "var(--border)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">Mark as left</div>
                  <div className="text-[11.5px] leading-[1.4] text-[var(--subtle)]">
                    Stops new assignments and removes them from active rosters. History is kept.
                  </div>
                </div>
                <button
                  onClick={() => setEditDraft((d) => d && { ...d, left: !d.left })}
                  role="switch"
                  aria-checked={editDraft.left}
                  className="relative h-6 w-[42px] flex-none rounded-full transition-colors"
                  style={{ background: editDraft.left ? "var(--danger)" : "var(--border)" }}
                >
                  <span
                    className="absolute top-[2px] h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left]"
                    style={{ left: editDraft.left ? "20px" : "2px" }}
                  />
                </button>
              </div>
            </div>
            <div className="flex gap-[10px] border-t border-[var(--border2)] p-[14px_18px]">
              <button
                onClick={() => setEditDraft(null)}
                className="h-11 flex-1 rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] text-[13.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
              <button
                onClick={onSaveEdit}
                disabled={savingEdit || !editDraft.name.trim()}
                className="flex h-11 flex-[1.3] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[var(--brand)] text-[13.5px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
              >
                {savingEdit ? <Spinner size={15} /> : <Icon name="check" size={15} />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
