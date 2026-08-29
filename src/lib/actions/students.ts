"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";
import { listOfferingAssistants } from "@/lib/actions/head-assignments";
import { getGradeScale, type GradeScaleSetting } from "@/lib/actions/oversight";
import { getOfferingParentWhatsappLink } from "@/lib/actions/assistant-groups";
import { getPaymentStatusForOffering, type PaymentStatusSummary } from "@/lib/actions/payments";
import { listMyOfferings, type OfferingOption } from "@/lib/actions/assignments";
import { getOrgBrandName, getEffectiveTemplates } from "@/lib/actions/templates";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { resolveTemplateFlags } from "@/lib/assignment-template-fallback";

export type ProgressCell = { assignmentTitle: string; status: string | null };

export type StudentRow = {
  enrollmentId: string;
  studentId: string;
  studentCode: string;
  name: string;
  initials: string;
  email: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  assistantId: string | null;
  assistantName: string | null;
  assistantWhatsappLink: string | null;
  enrolledAt: string;
  leftAt: string | null;
  avgGrade: number | null;
  targetGrade: number | null;
  cells: ProgressCell[];
};

export type AssistantOption = { id: string; name: string };

export async function getStudentsForOffering(offeringId: string): Promise<StudentRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  let query = supabase
    .from("enrollments")
    .select(
      "id, student_id, assistant_id, created_at, target_grade, students(id, name, initials, student_code, email, phone, guardian_name, guardian_phone, left_at), profiles(id, full_name, student_whatsapp_link)"
    )
    .eq("offering_id", offeringId);

  if (profile.role === "assistant") {
    query = query.eq("assistant_id", profile.id);
  }

  // enrollments and assignments don't depend on each other — fetching them
  // in parallel instead of one-after-another was needlessly doubling this
  // function's round-trip latency.
  const [{ data: enrollments, error }, { data: assignmentRows }] = await Promise.all([
    query,
    supabase.from("assignments").select("id, title, created_at").eq("offering_id", offeringId).order("created_at", { ascending: true }).limit(5),
  ]);
  if (error || !enrollments) return [];

  const assignments = assignmentRows ?? [];
  const assignmentIds = assignments.map((a) => a.id);

  const studentIds = enrollments.map((e) => e.student_id);
  const { data: logs } = assignmentIds.length && studentIds.length
    ? await supabase
        .from("assignment_logs")
        .select("assignment_id, student_id, status, grade")
        .in("assignment_id", assignmentIds)
        .in("student_id", studentIds)
    : { data: [] as { assignment_id: string; student_id: string; status: string | null; grade: string | null }[] };

  const logsByStudent = new Map<string, { assignment_id: string; status: string | null; grade: string | null }[]>();
  for (const log of logs ?? []) {
    const list = logsByStudent.get(log.student_id) ?? [];
    list.push(log);
    logsByStudent.set(log.student_id, list);
  }

  return enrollments
    .map((e) => {
      const student = Array.isArray(e.students) ? e.students[0] : e.students;
      const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      if (!student) return null;
      const studentLogs = logsByStudent.get(e.student_id) ?? [];
      const cells: ProgressCell[] = assignments.map((a) => {
        const log = studentLogs.find((l) => l.assignment_id === a.id);
        return { assignmentTitle: a.title, status: log?.status ?? null };
      });
      // Number(null) is 0, not NaN — filter out ungraded logs before
      // converting, or a comment-only/checkbox log with no grade entered
      // silently counts as a zero and drags the average down.
      const numericGrades = studentLogs
        .filter((l) => l.grade != null && l.grade.trim() !== "")
        .map((l) => Number(l.grade))
        .filter((n) => !Number.isNaN(n));
      const avgGrade = numericGrades.length ? Math.round(numericGrades.reduce((s, n) => s + n, 0) / numericGrades.length) : null;
      return {
        enrollmentId: e.id,
        studentId: e.student_id,
        studentCode: student.student_code,
        name: student.name,
        initials: student.initials,
        email: student.email,
        phone: student.phone,
        guardianName: student.guardian_name,
        guardianPhone: student.guardian_phone,
        assistantId: e.assistant_id,
        assistantName: assistant?.full_name ?? null,
        assistantWhatsappLink: assistant?.student_whatsapp_link ?? null,
        enrolledAt: e.created_at,
        leftAt: student.left_at,
        avgGrade,
        targetGrade: e.target_grade != null ? Number(e.target_grade) : null,
        cells,
      };
    })
    .filter((x): x is StudentRow => !!x);
}

export type StudentsTabForOffering = {
  rows: StudentRow[];
  assistants: Awaited<ReturnType<typeof listOfferingAssistants>>;
  gradeScale: GradeScaleSetting;
  parentWhatsappLink: string | null;
};

// Bundles every independent query the Students tab needs for a given
// offering into one round trip. This Next.js version dispatches and awaits
// Server Functions invoked from the client one at a time, so four separate
// client-side calls (roster, assistants, grade scale, WhatsApp link) — even
// wrapped in Promise.all or fired from separate effects in the same tick —
// were still four sequential round trips. The Promise.all here is real
// parallelism because it never crosses the client/server boundary.
export async function getStudentsTabForOffering(offeringId: string): Promise<StudentsTabForOffering> {
  const [rows, assistants, gradeScale, parentWhatsappLink] = await Promise.all([
    getStudentsForOffering(offeringId),
    listOfferingAssistants(offeringId),
    getGradeScale(offeringId),
    getOfferingParentWhatsappLink(offeringId),
  ]);
  return { rows, assistants, gradeScale, parentWhatsappLink };
}

export type StudentsRegistrationExtras = {
  payments: Record<string, PaymentStatusSummary>;
  labels: CourseLabelsByStudent;
};

export async function getStudentsRegistrationExtras(offeringId: string, studentIds: string[]): Promise<StudentsRegistrationExtras> {
  const [payments, labels] = await Promise.all([getPaymentStatusForOffering(offeringId), getCourseLabelsForStudents(studentIds)]);
  return { payments, labels };
}

export type StudentsTabBootstrap = {
  offerings: OfferingOption[];
  orgName: string;
  currency: string | null;
  welcomeTemplateStudent: string;
  welcomeTemplateParent: string;
  tierTemplates: {
    critical_alert_student: string;
    critical_alert_parent: string;
    caution_flag_student: string;
    caution_flag_parent: string;
  };
};

// Everything the Students tab needs before an offering is even picked —
// same one-round-trip-instead-of-many reasoning as getStudentsTabForOffering.
export async function getStudentsTabBootstrap(): Promise<StudentsTabBootstrap> {
  const [offerings, orgName, payrollSettings, templates] = await Promise.all([
    listMyOfferings(),
    getOrgBrandName(),
    getPayrollSettings(),
    getEffectiveTemplates([
      "welcome_student",
      "welcome_parent",
      "critical_alert_student",
      "critical_alert_parent",
      "caution_flag_student",
      "caution_flag_parent",
    ] as const),
  ]);
  return {
    offerings,
    orgName,
    currency: payrollSettings?.currency ?? null,
    welcomeTemplateStudent: templates.welcome_student,
    welcomeTemplateParent: templates.welcome_parent,
    tierTemplates: {
      critical_alert_student: templates.critical_alert_student,
      critical_alert_parent: templates.critical_alert_parent,
      caution_flag_student: templates.caution_flag_student,
      caution_flag_parent: templates.caution_flag_parent,
    },
  };
}

export async function getEnrollmentCounts(studentIds: string[]): Promise<Record<string, number>> {
  if (!studentIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("enrollments").select("student_id").in("student_id", studentIds);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.student_id] = (counts[row.student_id] ?? 0) + 1;
  }
  return counts;
}

export type CourseLabelsByStudent = Record<string, string[]>;

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function getCourseLabelsForStudents(studentIds: string[]): Promise<CourseLabelsByStudent> {
  if (!studentIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("student_id, course_offerings(session, unit, courses(name))")
    .in("student_id", studentIds);
  const result: CourseLabelsByStudent = {};
  for (const row of data ?? []) {
    const offering = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
    const list = result[row.student_id] ?? [];
    list.push(offeringLabel(offering));
    result[row.student_id] = list;
  }
  return result;
}

export type EnrollmentDetail = { enrollmentId: string; offeringId: string; label: string };

export async function getStudentEnrollments(studentId: string): Promise<EnrollmentDetail[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("id, offering_id, course_offerings(session, unit, courses(name))")
    .eq("student_id", studentId);
  return (data ?? []).map((r) => {
    const offering = Array.isArray(r.course_offerings) ? r.course_offerings[0] : r.course_offerings;
    return { enrollmentId: r.id, offeringId: r.offering_id, label: offeringLabel(offering) };
  });
}

export type OfferingChoice = { id: string; label: string };

// Only active offerings — a deactivated course shouldn't be selectable for
// new enrollments or staffing requests, even though existing enrollments
// tied to it keep working fine.
export async function listAllOfferingsForOrg(): Promise<OfferingChoice[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_offerings")
    .select("id, session, unit, courses(name)")
    .eq("org_id", orgId)
    .eq("active", true);
  return (data ?? []).map((o) => ({ id: o.id, label: offeringLabel(o) }));
}

export async function addStudentEnrollment(studentId: string, offeringId: string): Promise<{ enrollmentId: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enrollments")
    .insert({ student_id: studentId, offering_id: offeringId })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to enroll student");

  const [{ data: student }, { data: offering }] = await Promise.all([
    supabase.from("students").select("name").eq("id", studentId).maybeSingle(),
    supabase.from("course_offerings").select("session, unit, courses(name)").eq("id", offeringId).maybeSingle(),
  ]);
  await logActivity("students", `Enrolled ${student?.name ?? "a student"} into ${offeringLabel(offering ?? null)}`);

  return { enrollmentId: data.id };
}

export type StudentDuplicateMatch = {
  id: string;
  name: string;
  studentCode: string;
  guardianName: string | null;
  guardianPhone: string | null;
};

// Phone-only match, scoped to the org — deliberately simple (no fuzzy name
// matching) so a Head gets a clear, unambiguous "is this them?" rather than
// a list of maybe-matches to sift through.
export async function findStudentByPhone(phone: string): Promise<StudentDuplicateMatch | null> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId || !phone.trim()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("students")
    .select("id, name, student_code, guardian_name, guardian_phone")
    .eq("org_id", orgId)
    .eq("phone", phone.trim())
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, studentCode: data.student_code, guardianName: data.guardian_name, guardianPhone: data.guardian_phone };
}

export type HeadAddStudentInput = {
  name: string;
  phone: string;
  email?: string;
  guardianName?: string;
  guardianPhone?: string;
  offeringId: string;
  // Set once the Head has confirmed a phone match found by findStudentByPhone
  // really is the same person — skips creating a new student row entirely
  // and just enrolls the existing one, so the org doesn't accumulate a
  // second disconnected record for someone already in the system.
  existingStudentId?: string;
};

// Gated by the org's heads_can_add_students feature flag (off by default)
// and re-checked here server-side, not just hidden in the UI when off.
// Doesn't create a payment_plan — that's Registration/Finance's call to
// make with actual fee data a Head has no visibility into; enrollment and
// billing are handled as two separate steps here, same as they already are
// everywhere else a student can be enrolled without registration.
export async function headAddStudent(input: HeadAddStudentInput): Promise<{ studentId: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  if (profile.role !== "head") throw new Error("Not authorized");
  const supabase = await createClient();

  const { data: org } = await supabase.from("organizations").select("heads_can_add_students").eq("id", profile.org.id).single();
  if (!org?.heads_can_add_students) throw new Error("Not enabled for your organization");

  const { data: headLink } = await supabase
    .from("offering_heads")
    .select("head_id")
    .eq("head_id", profile.id)
    .eq("offering_id", input.offeringId)
    .maybeSingle();
  if (!headLink) throw new Error("You're not assigned to this course");

  if (input.existingStudentId) {
    await addStudentEnrollment(input.existingStudentId, input.offeringId);
    return { studentId: input.existingStudentId };
  }

  if (!input.name.trim()) throw new Error("Name is required");
  const initials = input.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      org_id: profile.org.id,
      name: input.name.trim(),
      initials,
      phone: input.phone || null,
      email: input.email || null,
      guardian_name: input.guardianName || null,
      guardian_phone: input.guardianPhone || null,
    })
    .select("id")
    .single();
  if (error || !student) throw new Error(error?.message ?? "Failed to add student");

  const { error: enrollError } = await supabase.from("enrollments").insert({ student_id: student.id, offering_id: input.offeringId });
  if (enrollError) throw new Error(enrollError.message);

  await logActivity("students", `Registered ${input.name.trim()} (added by Head)`);
  return { studentId: student.id };
}

// Enrollments have no soft-delete/history of their own — once this row is
// gone, nothing else records that this student was ever on this course, or
// who took them off it. Logging it here is the only trace that survives.
export async function removeStudentEnrollment(enrollmentId: string) {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("enrollments")
    .select("students(name), course_offerings(session, unit, courses(name))")
    .eq("id", enrollmentId)
    .maybeSingle();

  const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
  if (error) throw new Error(error.message);

  const student = before ? (Array.isArray(before.students) ? before.students[0] : before.students) : null;
  const offering = before ? (Array.isArray(before.course_offerings) ? before.course_offerings[0] : before.course_offerings) : null;
  await logActivity("students", `Removed ${student?.name ?? "a student"} from ${offeringLabel(offering ?? null)}`);
}

export async function reassignStudentAssistant(enrollmentId: string, assistantId: string | null) {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("enrollments")
    .select("assistant_id, students(name), course_offerings(session, unit, courses(name))")
    .eq("id", enrollmentId)
    .maybeSingle();

  const { error } = await supabase.from("enrollments").update({ assistant_id: assistantId }).eq("id", enrollmentId);
  if (error) throw new Error(error.message);

  const student = before ? (Array.isArray(before.students) ? before.students[0] : before.students) : null;
  const offering = before ? (Array.isArray(before.course_offerings) ? before.course_offerings[0] : before.course_offerings) : null;
  const [{ data: oldAssistant }, { data: newAssistant }] = await Promise.all([
    before?.assistant_id ? supabase.from("profiles").select("full_name").eq("id", before.assistant_id).maybeSingle() : Promise.resolve({ data: null }),
    assistantId ? supabase.from("profiles").select("full_name").eq("id", assistantId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  await logActivity(
    "students",
    `Reassigned ${student?.name ?? "a student"} in ${offeringLabel(offering ?? null)} — ${oldAssistant?.full_name ?? "Unassigned"} → ${newAssistant?.full_name ?? "Unassigned"}`
  );
}

function fieldChange(label: string, before: string | null, after: string): string | null {
  const b = before ?? "";
  const a = after || "";
  if (b === a) return null;
  if (!b) return `${label} set to "${a}"`;
  if (!a) return `${label} cleared`;
  return `${label} "${b}" → "${a}"`;
}

export async function updateStudent(
  studentId: string,
  patch: {
    name: string;
    email: string;
    phone: string;
    guardianName: string;
    guardianPhone: string;
    left: boolean;
  }
) {
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("students")
    .select("name, email, phone, guardian_name, guardian_phone, left_at")
    .eq("id", studentId)
    .maybeSingle();

  const { error } = await supabase
    .from("students")
    .update({
      name: patch.name,
      email: patch.email || null,
      phone: patch.phone || null,
      guardian_name: patch.guardianName || null,
      guardian_phone: patch.guardianPhone || null,
      left_at: patch.left ? new Date().toISOString() : null,
    })
    .eq("id", studentId);
  if (error) throw new Error(error.message);

  const changes = before
    ? [
        before.name !== patch.name ? `name "${before.name}" → "${patch.name}"` : null,
        fieldChange("email", before.email, patch.email),
        fieldChange("phone", before.phone, patch.phone),
        fieldChange("guardian name", before.guardian_name, patch.guardianName),
        fieldChange("guardian phone", before.guardian_phone, patch.guardianPhone),
        !!before.left_at !== patch.left ? (patch.left ? "marked as left" : "restored (no longer marked as left)") : null,
      ].filter((x): x is string => !!x)
    : [];
  await logActivity("students", `Updated ${patch.name}${changes.length ? ` — ${changes.join(", ")}` : ""}`);
}

export type StudentDetailAssignment = {
  title: string;
  dueDate: string | null;
  status: string | null;
  grade: string | null;
};

export type StudentDetailPanel = {
  avgGrade: number | null;
  assignments: StudentDetailAssignment[];
};

// A focused summary for the "View more" panel — the full grade average
// across every assignment the student has ever been logged for, plus every
// assignment itself (newest first) so the panel can show a quick glance at
// the most recent few while still letting a head/assistant expand to the
// complete history instead of being capped at whatever fit in the initial
// view.
export async function getStudentDetailPanel(studentId: string, offeringId: string): Promise<StudentDetailPanel> {
  const supabase = await createClient();

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title, due_date, created_at")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: false });
  const assignments = assignmentRows ?? [];
  const assignmentIds = assignments.map((a) => a.id);

  const { data: logs } = assignmentIds.length
    ? await supabase
        .from("assignment_logs")
        .select("assignment_id, status, grade")
        .in("assignment_id", assignmentIds)
        .eq("student_id", studentId)
    : { data: [] as { assignment_id: string; status: string | null; grade: string | null }[] };
  const logByAssignment = new Map((logs ?? []).map((l) => [l.assignment_id, l]));

  const numericGrades = (logs ?? [])
    .filter((l) => l.grade != null && l.grade.trim() !== "")
    .map((l) => Number(l.grade))
    .filter((n) => !Number.isNaN(n));
  const avgGrade = numericGrades.length ? Math.round(numericGrades.reduce((s, n) => s + n, 0) / numericGrades.length) : null;

  const allAssignments: StudentDetailAssignment[] = assignments.map((a) => {
    const log = logByAssignment.get(a.id);
    return { title: a.title, dueDate: a.due_date, status: log?.status ?? null, grade: log?.grade ?? null };
  });

  return { avgGrade, assignments: allAssignments };
}

// Drive folder link for a student's reports — set/sent by whichever
// assistant needs to hand it to the student/parent, independent of report
// generation, so it can be shared at any time rather than only after a
// monthly report run.
export async function getStudentDriveFolderLink(studentId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("drive_folder_link").eq("id", studentId).maybeSingle();
  return data?.drive_folder_link ?? null;
}

export async function setStudentDriveFolderLink(studentId: string, link: string) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "assistant" && profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ drive_folder_link: link.trim() || null }).eq("id", studentId);
  if (error) throw new Error(error.message);
}

// One column per assignment per (status/grade/comment) field it actually
// has — a status-only assignment contributes one column, a graded+commented
// one contributes three. Every student's row uses this exact same column
// set (in the same order), so the header only needs to be computed once.
export type StudentDetailedExportColumn = { assignmentTitle: string; hasGrade: boolean; hasComment: boolean };

export type StudentDetailedExportRow = {
  studentCode: string;
  studentName: string;
  email: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  assistantName: string | null;
  enrolledAt: string;
  leftAt: string | null;
  // Flattened cell values, in the same order/shape as `columns` — each
  // assignment contributes [status] or [status, grade] or [status, comment]
  // or [status, grade, comment] depending on that assignment's own flags.
  cells: string[];
};

export type StudentDetailedExport = {
  columns: StudentDetailedExportColumn[];
  rows: StudentDetailedExportRow[];
};

// One row per student for the offering (never one row per assignment) —
// every assignment's status/grade/comment becomes its own column instead,
// so heads/admins can audit everything for a student without duplicate rows.
export async function getStudentDetailedExport(offeringId: string): Promise<StudentDetailedExport> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "assistant") return { columns: [], rows: [] };
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, created_at, students(name, initials, student_code, email, phone, guardian_name, guardian_phone, left_at), profiles(full_name)")
    .eq("offering_id", offeringId);
  if (!enrollments || enrollments.length === 0) return { columns: [], rows: [] };

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title, template, assignment_templates(has_grade, has_comment)")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: true });
  const assignments = (assignmentRows ?? []).map((a) => {
    const joined = Array.isArray(a.assignment_templates) ? a.assignment_templates[0] : a.assignment_templates;
    const { hasGrade, hasComment } = resolveTemplateFlags(a.template, joined);
    return { id: a.id, title: a.title, hasGrade, hasComment };
  });

  const columns: StudentDetailedExportColumn[] = assignments.map((a) => ({
    assignmentTitle: a.title,
    hasGrade: a.hasGrade,
    hasComment: a.hasComment,
  }));

  // A course with a full roster and several assignments easily produces
  // students × assignments log rows — well past PostgREST's default
  // 1000-row cap on a single unbounded select (one offering here alone has
  // 325 students × 10 assignments = 2,484 rows). An un-paginated fetch
  // silently truncated the result, so whichever assignments' logs happened
  // to sort past the cutoff read as "not logged" despite being genuinely
  // logged — paginate through with .range() until exhausted instead.
  const studentIds = enrollments.map((e) => e.student_id);
  const assignmentIds = assignments.map((a) => a.id);
  const logs: { assignment_id: string; student_id: string; status: string | null; grade: string | null; comment: string | null }[] = [];
  if (assignmentIds.length && studentIds.length) {
    const LOGS_PAGE_SIZE = 1000;
    for (let from = 0; ; from += LOGS_PAGE_SIZE) {
      const { data: page } = await supabase
        .from("assignment_logs")
        .select("assignment_id, student_id, status, grade, comment")
        .in("assignment_id", assignmentIds)
        .in("student_id", studentIds)
        .range(from, from + LOGS_PAGE_SIZE - 1);
      if (!page || page.length === 0) break;
      logs.push(...page);
      if (page.length < LOGS_PAGE_SIZE) break;
    }
  }

  const logKey = (assignmentId: string, studentId: string) => `${assignmentId}::${studentId}`;
  const logByKey = new Map(logs.map((l) => [logKey(l.assignment_id, l.student_id), l]));

  const rows: StudentDetailedExportRow[] = [];
  for (const e of enrollments) {
    const student = Array.isArray(e.students) ? e.students[0] : e.students;
    const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    if (!student) continue;

    const cells: string[] = [];
    for (const a of assignments) {
      const log = logByKey.get(logKey(a.id, e.student_id));
      cells.push(log?.status ?? "not logged");
      if (a.hasGrade) cells.push(log?.grade ?? "");
      if (a.hasComment) cells.push(log?.comment ?? "");
    }

    rows.push({
      studentCode: student.student_code,
      studentName: student.name,
      email: student.email,
      phone: student.phone,
      guardianName: student.guardian_name,
      guardianPhone: student.guardian_phone,
      assistantName: assistant?.full_name ?? null,
      enrolledAt: e.created_at,
      leftAt: student.left_at,
      cells,
    });
  }

  return { columns, rows: rows.sort((a, b) => a.studentName.localeCompare(b.studentName)) };
}
