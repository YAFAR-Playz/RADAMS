"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  getStudentDetailedExport,
  getStudentDetailPanel,
  getStudentDriveFolderLink,
  setStudentDriveFolderLink,
  type StudentRow,
  type EnrollmentDetail,
  type OfferingChoice,
  type StudentDetailPanel,
} from "@/lib/actions/students";
import { getGradeScale, type GradeScaleSetting } from "@/lib/actions/oversight";
import { getTrafficLightForOffering, setStudentTargetGrade, type StudentTrafficLight } from "@/lib/actions/traffic-light";
import { getStudentAttendance, type StudentAttendanceSummary } from "@/lib/actions/attendance";
import { downloadCsv } from "@/lib/csv-export";
import { getEffectiveTemplate, getOrgBrandName } from "@/lib/actions/templates";
import { getOfferingParentWhatsappLink } from "@/lib/actions/assistant-groups";
import { applyTemplateVars } from "@/lib/message-vars";
import { consumeSearchHandoff } from "@/lib/search-handoff";
import { AutoAssignModal } from "@/components/shared/auto-assign-modal";
import { getPaymentStatusForOffering, type PaymentStatusSummary } from "@/lib/actions/payments";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { currencySymbol } from "@/lib/currency";
import { matchesStudentQuery } from "@/lib/student-search";

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
  const [welcomeRecipient, setWelcomeRecipient] = useState<"student" | "parent">("parent");
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [welcomeTemplateStudent, setWelcomeTemplateStudent] = useState<string | null>(null);
  const [welcomeTemplateParent, setWelcomeTemplateParent] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("ZAD-AMS");
  const [parentWhatsappLink, setParentWhatsappLink] = useState<string | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);
  const [paymentByStudent, setPaymentByStudent] = useState<Record<string, PaymentStatusSummary>>({});
  const [courseLabelsByStudent, setCourseLabelsByStudent] = useState<Record<string, string[]>>({});
  const [editEnrollments, setEditEnrollments] = useState<EnrollmentDetail[] | null>(null);
  const [allOfferings, setAllOfferings] = useState<OfferingChoice[] | null>(null);
  const [addOfferingId, setAddOfferingId] = useState("");
  const [studentAttendance, setStudentAttendance] = useState<StudentAttendanceSummary | null>(null);
  const [enrollmentBusy, setEnrollmentBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const isRegistration = role === "registration";
  const canEditCourses = role === "admin" || role === "registration";
  const canViewMore = role === "head" || role === "assistant";
  const [sym, setSym] = useState("£");
  const [viewMoreStudent, setViewMoreStudent] = useState<StudentRow | null>(null);
  const [viewMoreAttendance, setViewMoreAttendance] = useState<StudentAttendanceSummary | null>(null);
  const [viewMoreDetail, setViewMoreDetail] = useState<StudentDetailPanel | null>(null);
  const [folderLink, setFolderLink] = useState<string | null>(null);
  const [folderLinkDraft, setFolderLinkDraft] = useState("");
  const [savingFolderLink, setSavingFolderLink] = useState(false);
  const [trafficLight, setTrafficLight] = useState<Record<string, StudentTrafficLight>>({});
  const [targetGradeDraft, setTargetGradeDraft] = useState("");
  const [savingTargetGrade, setSavingTargetGrade] = useState(false);
  const [tierTemplates, setTierTemplates] = useState<Record<string, string>>({});

  // Traffic light (and, for registration, payment/course-label) data loads
  // in the background after the roster itself renders. If the offering
  // changes again while that background fetch is still in flight, this lets
  // it recognize it's stale and avoid overwriting the new offering's data.
  const offeringIdRef = useRef(offeringId);
  useEffect(() => {
    offeringIdRef.current = offeringId;
  }, [offeringId]);

  useEffect(() => {
    (() => {
      const handoff = consumeSearchHandoff();
      if (handoff) setSearch(handoff);
    })();
    listMyOfferings().then((data) => {
      setOfferings(data);
      setOfferingId(data[0]?.id ?? null);
    });
    Promise.all([getEffectiveTemplate("welcome_student"), getEffectiveTemplate("welcome_parent"), getOrgBrandName()]).then(([tplS, tplP, org]) => {
      setWelcomeTemplateStudent(tplS);
      setWelcomeTemplateParent(tplP);
      setOrgName(org);
    });
    Promise.all([
      getEffectiveTemplate("critical_alert_student"),
      getEffectiveTemplate("critical_alert_parent"),
      getEffectiveTemplate("caution_flag_student"),
      getEffectiveTemplate("caution_flag_parent"),
    ]).then(([redStudent, redParent, yellowStudent, yellowParent]) => {
      setTierTemplates({
        critical_alert_student: redStudent,
        critical_alert_parent: redParent,
        caution_flag_student: yellowStudent,
        caution_flag_parent: yellowParent,
      });
    });
    getPayrollSettings().then((settings) => setSym(currencySymbol(settings?.currency)));
  }, []);

  useEffect(() => {
    (() => {
      if (!offeringId) {
        setParentWhatsappLink(null);
        return;
      }
      getOfferingParentWhatsappLink(offeringId).then(setParentWhatsappLink);
    })();
  }, [offeringId]);

  async function reload(id: string) {
    setLoading(true);
    setTrafficLight({});
    try {
      // Students+assistants are what the table actually needs to render —
      // traffic light and (for registration) payment/course-label data are
      // per-row enrichment that used to block the whole page behind its own
      // slower queries. Loading them in the background after the roster
      // itself paints means switching offerings feels instant even before
      // every badge has resolved.
      const [rows, ast] = await Promise.all([getStudentsForOffering(id), listOfferingAssistants(id)]);
      if (offeringIdRef.current !== id) return;
      setStudents(rows);
      setAssistants(ast);
      setLoading(false);

      getTrafficLightForOffering(id).then((tl) => {
        if (offeringIdRef.current === id) setTrafficLight(tl);
      });

      if (isRegistration) {
        Promise.all([getPaymentStatusForOffering(id), getCourseLabelsForStudents(rows.map((r) => r.studentId))]).then(([payments, labels]) => {
          if (offeringIdRef.current !== id) return;
          setPaymentByStudent(payments);
          setCourseLabelsByStudent(labels);
        });
      }
    } catch {
      setError("Couldn't load students for this course.");
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

  const [gradeScale, setGradeScaleState] = useState<GradeScaleSetting>({ scale: "percentage", bands: [] });
  useEffect(() => {
    if (!offeringId) return;
    getGradeScale(offeringId).then(setGradeScaleState);
  }, [offeringId]);

  function formatGrade(avgGrade: number | null): string {
    if (avgGrade == null) return "—";
    if (gradeScale.scale !== "percentage" && gradeScale.bands.length) {
      const band = gradeScale.bands.find((b) => avgGrade >= b.min);
      if (band) return band.label;
    }
    return `${avgGrade}%`;
  }

  const offeringsLoading = offerings === null;
  const current = offerings?.find((o) => o.id === offeringId) ?? null;

  const filtered = useMemo(() => {
    if (!students) return [];
    const rows = students.filter((s) => {
      if (!matchesStudentQuery(search, s.name, s.studentCode)) return false;
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

  async function onExport() {
    if (!offeringId) return;
    setExporting(true);
    try {
      const rows = await getStudentDetailedExport(offeringId);
      downloadCsv(
        `students-detailed-${current?.label ?? "all"}`,
        [
          "Student ID",
          "Name",
          "Email",
          "Phone",
          "Guardian name",
          "Guardian phone",
          "Assistant",
          "Enrolled",
          "Left",
          "Assignment",
          "Due date",
          "Max marks",
          "Status",
          "Grade",
          "Comment",
          "Logged by",
          "Sent to parent",
          "Last updated",
        ],
        rows.map((r) => [
          r.studentCode,
          r.studentName,
          r.email ?? "",
          r.phone ?? "",
          r.guardianName ?? "",
          r.guardianPhone ?? "",
          r.assistantName ?? "",
          r.enrolledAt,
          r.leftAt ?? "",
          r.assignmentTitle,
          r.dueDate ?? "",
          r.maxMarks || "",
          r.status,
          r.grade,
          r.comment,
          r.loggedBy ?? "",
          r.sentAt ?? "",
          r.updatedAt ?? "",
        ])
      );
    } finally {
      setExporting(false);
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
    setStudentAttendance(null);
    getStudentAttendance(s.studentId).then(setStudentAttendance);
  }

  function openViewMore(s: StudentRow) {
    setViewMoreStudent(s);
    setViewMoreAttendance(null);
    setViewMoreDetail(null);
    setFolderLink(null);
    setTargetGradeDraft(s.targetGrade != null ? String(s.targetGrade) : "");
    getStudentAttendance(s.studentId).then(setViewMoreAttendance);
    if (offeringId) getStudentDetailPanel(s.studentId, offeringId).then(setViewMoreDetail);
    getStudentDriveFolderLink(s.studentId).then((link) => {
      setFolderLink(link);
      setFolderLinkDraft(link ?? "");
    });
  }

  async function onSaveTargetGrade() {
    if (!viewMoreStudent) return;
    setSavingTargetGrade(true);
    try {
      const value = targetGradeDraft.trim() === "" ? null : Number(targetGradeDraft);
      await setStudentTargetGrade(viewMoreStudent.enrollmentId, value);
      setStudents((prev) => (prev ? prev.map((s) => (s.enrollmentId === viewMoreStudent.enrollmentId ? { ...s, targetGrade: value } : s)) : prev));
      setViewMoreStudent((prev) => (prev ? { ...prev, targetGrade: value } : prev));
      if (offeringId) getTrafficLightForOffering(offeringId).then(setTrafficLight);
    } catch {
      setError("Couldn't save the target grade — try again.");
    } finally {
      setSavingTargetGrade(false);
    }
  }

  async function onSaveFolderLink() {
    if (!viewMoreStudent) return;
    setSavingFolderLink(true);
    try {
      await setStudentDriveFolderLink(viewMoreStudent.studentId, folderLinkDraft);
      setFolderLink(folderLinkDraft.trim() || null);
    } catch {
      setError("Couldn't save that folder link — try again.");
    } finally {
      setSavingFolderLink(false);
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
  const welcomeActiveTemplate = welcomeRecipient === "student" ? welcomeTemplateStudent : welcomeTemplateParent;
  const welcomeMessage =
    welcomeStudent && welcomeActiveTemplate
      ? applyTemplateVars(welcomeActiveTemplate, {
          org: orgName,
          student: welcomeStudent.name,
          id: welcomeStudent.studentCode,
          course: current?.label ?? "this course",
          assistant_name: welcomeStudent.assistantName ?? "your assistant",
          student_group_link: welcomeStudent.assistantWhatsappLink ?? "(not set yet — ask your head)",
          parent_group_link: parentWhatsappLink ?? "(not set yet — ask your admin)",
        })
      : "";
  const welcomePhone = welcomeRecipient === "student" ? welcomeStudent?.phone : welcomeStudent?.guardianPhone;
  const welcomeDigits = welcomePhone ? welcomePhone.replace(/[^\d]/g, "") : "";
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
              onClick={() => setAutoOpen(true)}
              disabled={unassignedCount === 0 || !offeringId}
              title={unassignedCount === 0 ? "No unassigned students on this course" : "Auto-assign unassigned students"}
              className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--brand)] bg-[var(--surface)] px-[14px] py-[10px] text-[13px] font-semibold text-[var(--brand)] hover:bg-[var(--brands)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--subtle)] disabled:hover:bg-[var(--surface)]"
            >
              <Icon name="users" size={16} />
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
          {!isAssistant && (
            <button
              onClick={onExport}
              disabled={filtered.length === 0 || exporting}
              className="flex flex-none items-center gap-[7px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface)] px-[14px] py-[10px] text-[13px] font-semibold text-[var(--muted)] hover:bg-[var(--surface2)] disabled:opacity-60"
            >
              {exporting ? <Spinner size={15} /> : <Icon name="file-up" size={16} />}
              Export CSV
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
            placeholder="Search students by name or ID…"
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
                        <span className="ml-[6px] rounded-[4px] bg-[var(--surface2)] px-[5px] py-[1px] font-mono text-[10.5px] font-semibold text-[var(--subtle)]">
                          #{st.studentCode}
                        </span>
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
                      {!st.leftAt &&
                        (() => {
                          const tl = trafficLight[st.studentId];
                          // Traffic light loads in the background after the roster itself
                          // renders — a pulsing placeholder here (rather than a blank gap)
                          // makes it clear more is still coming in, not that this student
                          // has no status at all.
                          if (!tl) {
                            return (
                              <span className="flex w-[14px] flex-none items-center justify-center">
                                <span className="block h-[10px] w-[10px] animate-pulse rounded-full bg-[var(--surface2)]" />
                              </span>
                            );
                          }
                          const tone = tl.tier === "green" ? "ok" : tl.tier === "yellow" ? "warn" : "danger";
                          const { fg } = toneColors(tone);
                          const title =
                            tl.reasons.length > 0
                              ? `${tl.tier === "green" ? "On track" : tl.tier === "yellow" ? "Caution" : "Critical"}: ${tl.reasons.join("; ")}`
                              : "On track";
                          return (
                            <span title={title} className="flex w-[14px] flex-none items-center justify-center">
                              <span className="block h-[10px] w-[10px] rounded-full" style={{ background: fg }} />
                            </span>
                          );
                        })()}
                      <span className="w-[54px] flex-none text-right font-mono text-[13px] font-bold text-[var(--text)]">
                        {st.leftAt ? "—" : formatGrade(st.avgGrade)}
                      </span>
                    </>
                  )}
                  <div className="flex w-[74px] flex-none justify-end gap-[6px]">
                    {canViewMore && (
                      <button
                        onClick={() => openViewMore(st)}
                        title="View more"
                        className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                      >
                        <Icon name="eye" size={16} />
                      </button>
                    )}
                    {isAssistant && (
                      <button
                        onClick={() => {
                          setWelcomeRecipient("parent");
                          setWelcomeId(st.studentId);
                        }}
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
                  {welcomeRecipient === "student" ? (
                    <>
                      To {welcomeStudent.name} · {welcomePhone ?? "no phone on file"}
                    </>
                  ) : (
                    <>
                      To {welcomeStudent.name}&apos;s guardian · {welcomePhone ?? "no phone on file"}
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => setWelcomeId(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="p-[18px]">
              <div className="mb-[11px] flex gap-[6px] rounded-[9px] border border-[var(--border)] bg-[var(--surface2)] p-[3px]">
                {(["student", "parent"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setWelcomeRecipient(r)}
                    className="flex-1 rounded-[7px] py-[7px] text-[12.5px] font-semibold"
                    style={{
                      background: welcomeRecipient === r ? "var(--surface)" : "transparent",
                      color: welcomeRecipient === r ? "var(--text)" : "var(--muted)",
                      boxShadow: welcomeRecipient === r ? "var(--shadow)" : "none",
                    }}
                  >
                    {r === "student" ? "To student" : "To parent"}
                  </button>
                ))}
              </div>
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
                href={welcomeMessage ? welcomeWaUrl : undefined}
                target="_blank"
                rel="noopener"
                aria-disabled={!welcomeMessage}
                title={welcomeMessage ? undefined : "Message still loading…"}
                onClick={(e) => {
                  if (!welcomeMessage) {
                    e.preventDefault();
                    return;
                  }
                  setWelcomeId(null);
                }}
                className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-[var(--rad-sm)] bg-[#25D366] text-[13.5px] font-semibold text-white aria-disabled:pointer-events-none aria-disabled:opacity-60"
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
              <div>
                <label className="mb-[7px] block text-[12.5px] font-semibold text-[var(--text)]">Attendance</label>
                {studentAttendance === null ? (
                  <SkeletonRow className="h-[40px]" />
                ) : studentAttendance.records.length === 0 ? (
                  <div className="text-[12.5px] text-[var(--subtle)]">No attendance recorded yet.</div>
                ) : (
                  <div className="flex flex-col gap-[8px]">
                    <div className="flex items-center gap-[10px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[10px_12px]">
                      <span
                        className="font-mono text-[16px] font-bold"
                        style={{ color: studentAttendance.presentPct >= 80 ? "var(--ok)" : studentAttendance.presentPct >= 60 ? "var(--warn)" : "var(--danger)" }}
                      >
                        {studentAttendance.presentPct}%
                      </span>
                      <span className="text-[12px] text-[var(--muted)]">
                        present across {studentAttendance.records.length} session{studentAttendance.records.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex max-h-[160px] flex-col gap-[4px] overflow-y-auto">
                      {studentAttendance.records.map((r) => {
                        const tone = r.status === "present" ? "var(--ok)" : r.status === "late" ? "var(--warn)" : "var(--danger)";
                        return (
                          <div key={r.sessionId} className="flex items-center justify-between rounded-[7px] bg-[var(--surface2)] px-[10px] py-[6px] text-[12px]">
                            <span className="text-[var(--text)]">
                              {r.title} <span className="text-[var(--subtle)]">· {new Date(r.date).toLocaleDateString()}</span>
                            </span>
                            <span className="font-semibold capitalize" style={{ color: tone }}>
                              {r.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
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

      {/* AUTO-ASSIGN MODAL */}
      {autoOpen && offeringId && (
        <AutoAssignModal
          offeringId={offeringId}
          unassignedCount={unassignedCount}
          onClose={() => setAutoOpen(false)}
          onDone={async () => {
            setAutoOpen(false);
            await reload(offeringId);
          }}
        />
      )}

      {/* VIEW MORE MODAL */}
      {viewMoreStudent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(8,12,22,0.5)] p-5">
          <div className="flex max-h-[88vh] w-full max-w-[440px] flex-col overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(8,12,22,.34)]">
            <div className="flex items-center gap-[11px] border-b border-[var(--border2)] p-[16px_18px]">
              <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[13px] font-bold text-[var(--brand)]">
                {viewMoreStudent.initials}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-[15px] font-semibold text-[var(--text)]">{viewMoreStudent.name}</h3>
                <div className="text-[11.5px] text-[var(--subtle)]">#{viewMoreStudent.studentCode}</div>
              </div>
              <button
                onClick={() => setViewMoreStudent(null)}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] text-[var(--muted)] hover:bg-[var(--surface2)]"
              >
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-col gap-[16px] overflow-y-auto p-[16px_18px]">
              {(() => {
                const tl = trafficLight[viewMoreStudent.studentId];
                const tier = tl?.tier ?? "green";
                const tone = tier === "green" ? "ok" : tier === "yellow" ? "warn" : "danger";
                const { bg, fg } = toneColors(tone);
                const tierLabel = tier === "green" ? "On track" : tier === "yellow" ? "Caution" : "Critical";
                const actions =
                  tier === "yellow"
                    ? [
                        "Parental Communication Flag: send an extra structured notification directly to the parent/guardian.",
                        "Deviation Briefing: explain the observed drop from this student's expected baseline.",
                      ]
                    : tier === "red"
                      ? [
                          "Parent Warning Message: contact the parent immediately with a warning detailing the drop and active rectifications.",
                          "Obligatory Office Hours: place the student on a compulsory attendance roster for live support sessions.",
                          "Mistake Diary Enforcement: audit that all missed marks are populated and full-mark rewrites are completed.",
                          "Target Follow-Up Recap Plan: build a structured plan to recap previous weak topics before advancing.",
                        ]
                      : [];
                return (
                  <div>
                    <div className="mb-[7px] flex items-center justify-between text-[12.5px] font-semibold text-[var(--text)]">
                      Traffic light status
                    </div>
                    <div className="flex flex-col gap-[8px] rounded-[8px] border border-[var(--border)] p-[10px_12px]" style={{ background: bg }}>
                      <div className="flex items-center gap-[8px]">
                        <span className="block h-[10px] w-[10px] flex-none rounded-full" style={{ background: fg }} />
                        <span className="text-[13px] font-bold" style={{ color: fg }}>
                          {tierLabel}
                        </span>
                      </div>
                      {tl && tl.reasons.length > 0 && (
                        <ul className="m-0 flex list-none flex-col gap-[3px] pl-0 text-[12px] leading-[1.4]" style={{ color: fg }}>
                          {tl.reasons.map((r, i) => (
                            <li key={i}>• {r}</li>
                          ))}
                        </ul>
                      )}
                      {actions.length > 0 && (
                        <div className="mt-[4px] flex flex-col gap-[5px] border-t border-dashed pt-[8px]" style={{ borderColor: fg }}>
                          <div className="text-[10.5px] font-bold uppercase tracking-[0.04em]" style={{ color: fg }}>
                            Required actions
                          </div>
                          {actions.map((a, i) => (
                            <label key={i} className="flex items-start gap-[7px] text-[12px] leading-[1.4]" style={{ color: fg }}>
                              <input type="checkbox" className="mt-[2px] flex-none" />
                              <span>{a}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {(tier === "yellow" || tier === "red") &&
                        (() => {
                          const category = tier === "red" ? "critical_alert" : "caution_flag";
                          const vars = {
                            student: viewMoreStudent.name,
                            org: orgName,
                            course: current?.label ?? "this course",
                            month: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
                          };
                          const recipients: { key: "student" | "parent"; label: string; phone: string | null }[] = [
                            { key: "student", label: "Message student", phone: viewMoreStudent.phone },
                            { key: "parent", label: "Message parent", phone: viewMoreStudent.guardianPhone },
                          ];
                          return (
                            <div className="mt-[4px] flex flex-wrap gap-[8px] border-t border-dashed pt-[8px]" style={{ borderColor: fg }}>
                              {recipients.map((r) => {
                                const template = tierTemplates[`${category}_${r.key}`] ?? "";
                                const message = applyTemplateVars(template, vars);
                                const digits = (r.phone ?? "").replace(/[^\d]/g, "");
                                // Template text loads async after mount — sending before it
                                // resolves would open WhatsApp with an empty message.
                                const ready = digits && message;
                                return (
                                  <a
                                    key={r.key}
                                    href={ready ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : undefined}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-disabled={!ready}
                                    title={!digits ? "No phone number on file" : !message ? "Message still loading…" : undefined}
                                    className="flex h-8 items-center gap-[6px] rounded-[7px] border border-[#25D366] bg-[var(--surface)] px-[10px] text-[11.5px] font-semibold text-[#1ea952] hover:bg-[rgba(37,211,102,0.1)] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                                  >
                                    <Icon name="send" size={12} />
                                    {r.label}
                                  </a>
                                );
                              })}
                            </div>
                          );
                        })()}
                    </div>
                    {!isRegistration && (
                      <div className="mt-[9px] flex items-center gap-[8px]">
                        <span className="text-[11.5px] font-semibold text-[var(--muted)]">Target grade</span>
                        <div className="flex h-8 w-[80px] flex-none items-center rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[9px]">
                          <input
                            value={targetGradeDraft}
                            onChange={(e) => setTargetGradeDraft(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="—"
                            inputMode="numeric"
                            className="w-full border-none bg-transparent font-mono text-[12.5px] font-bold text-[var(--text)] outline-none"
                          />
                          <span className="text-[11px] font-semibold text-[var(--subtle)]">%</span>
                        </div>
                        <button
                          onClick={onSaveTargetGrade}
                          disabled={savingTargetGrade}
                          className="flex h-8 items-center justify-center gap-[6px] rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-[10px] text-[11.5px] font-semibold text-[var(--text)] hover:bg-[var(--surface2)] disabled:opacity-60"
                        >
                          {savingTargetGrade ? <Spinner size={12} /> : <Icon name="check" size={12} />}
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <div className="mb-[7px] flex items-center justify-between text-[12.5px] font-semibold text-[var(--text)]">
                  Attendance
                </div>
                {viewMoreAttendance === null ? (
                  <SkeletonRow className="h-[40px]" />
                ) : viewMoreAttendance.records.length === 0 ? (
                  <div className="text-[12.5px] text-[var(--subtle)]">No attendance recorded yet.</div>
                ) : (
                  <div className="flex flex-col gap-[8px]">
                    <div className="flex items-center gap-[10px] rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] p-[10px_12px]">
                      <span
                        className="font-mono text-[16px] font-bold"
                        style={{ color: viewMoreAttendance.presentPct >= 80 ? "var(--ok)" : viewMoreAttendance.presentPct >= 60 ? "var(--warn)" : "var(--danger)" }}
                      >
                        {viewMoreAttendance.presentPct}%
                      </span>
                      <span className="text-[12px] text-[var(--muted)]">
                        present across {viewMoreAttendance.records.length} session{viewMoreAttendance.records.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-[4px]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Last 3 sessions</div>
                      {viewMoreAttendance.records.slice(0, 3).map((r) => {
                        const tone = r.status === "present" ? "var(--ok)" : r.status === "late" ? "var(--warn)" : "var(--danger)";
                        return (
                          <div key={r.sessionId} className="flex items-center justify-between rounded-[7px] bg-[var(--surface2)] px-[10px] py-[6px] text-[12px]">
                            <span className="text-[var(--text)]">
                              {r.title} <span className="text-[var(--subtle)]">· {new Date(r.date).toLocaleDateString()}</span>
                            </span>
                            <span className="font-semibold capitalize" style={{ color: tone }}>
                              {r.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-[7px] flex items-center justify-between text-[12.5px] font-semibold text-[var(--text)]">
                  Assignments
                  {viewMoreDetail && (
                    <span className="font-mono text-[13px] font-bold text-[var(--text)]">
                      Avg {formatGrade(viewMoreDetail.avgGrade)}
                    </span>
                  )}
                </div>
                {viewMoreDetail === null ? (
                  <SkeletonRow className="h-[40px]" />
                ) : viewMoreDetail.recentAssignments.length === 0 ? (
                  <div className="text-[12.5px] text-[var(--subtle)]">No assignments logged yet.</div>
                ) : (
                  <div className="flex flex-col gap-[4px]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Latest 5</div>
                    {viewMoreDetail.recentAssignments.map((a, i) => {
                      const def = a.status ? statusDef(a.status as never) : null;
                      const { bg, fg } = def ? toneColors(def.tone) : { bg: "var(--surface2)", fg: "var(--subtle)" };
                      return (
                        <div key={i} className="flex items-center justify-between gap-[8px] rounded-[7px] bg-[var(--surface2)] px-[10px] py-[6px] text-[12px]">
                          <span className="min-w-0 flex-1 truncate text-[var(--text)]">{a.title}</span>
                          <span className="flex-none font-mono font-semibold text-[var(--text)]">{a.grade || "—"}</span>
                          <span
                            className="flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[5px]"
                            style={{ background: bg, color: fg }}
                          >
                            <Icon name={def?.icon ?? "clock"} size={11} />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-[7px] text-[12.5px] font-semibold text-[var(--text)]">Report folder link</div>
                <p className="m-0 mb-[8px] text-[11.5px] text-[var(--subtle)]">
                  Paste the Google Drive folder link for this student&apos;s reports, then send it to their guardian on WhatsApp anytime.
                </p>
                <div className="flex items-center gap-[7px]">
                  <input
                    value={folderLinkDraft}
                    onChange={(e) => setFolderLinkDraft(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="h-9 min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] text-[12.5px] text-[var(--text)] outline-none focus:border-[var(--brand)]"
                  />
                  <button
                    onClick={onSaveFolderLink}
                    disabled={folderLinkDraft === (folderLink ?? "") || savingFolderLink}
                    className="flex h-9 flex-none items-center gap-[5px] rounded-[8px] bg-[var(--brand)] px-[11px] text-[12px] font-semibold text-[var(--brandfg)] disabled:opacity-60"
                  >
                    {savingFolderLink ? <Spinner size={12} /> : <Icon name="check" size={12} />}
                    Save
                  </button>
                </div>
                {folderLink && (
                  <a
                    href={`https://wa.me/${(viewMoreStudent.guardianPhone ?? "").replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                      `Hi! Here's the link to ${viewMoreStudent.name}'s reports folder: ${folderLink}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-[8px] flex h-9 w-fit items-center gap-[6px] rounded-[8px] border border-[#25D366] bg-[var(--surface)] px-[12px] text-[12px] font-semibold text-[#1ea952] hover:bg-[rgba(37,211,102,0.1)]"
                  >
                    <Icon name="send" size={13} />
                    Send to guardian
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
