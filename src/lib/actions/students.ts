"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";

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

export type StudentAssignmentDetailRow = {
  studentCode: string;
  studentName: string;
  email: string | null;
  phone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  assistantName: string | null;
  enrolledAt: string;
  leftAt: string | null;
  assignmentTitle: string;
  dueDate: string | null;
  maxMarks: number;
  status: string;
  grade: string;
  comment: string;
  loggedBy: string | null;
  sentAt: string | null;
  updatedAt: string | null;
};

// One row per (student, assignment) for the offering — every assignment
// detail and comment a student has, not just a summary — so heads/admins can
// audit exactly what was logged rather than a single rolled-up average.
export async function getStudentDetailedExport(offeringId: string): Promise<StudentAssignmentDetailRow[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role === "assistant") return [];
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, created_at, students(name, initials, student_code, email, phone, guardian_name, guardian_phone, left_at), profiles(full_name)")
    .eq("offering_id", offeringId);
  if (!enrollments || enrollments.length === 0) return [];

  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id, title, due_date, max_marks")
    .eq("offering_id", offeringId)
    .order("created_at", { ascending: true });
  const assignments = assignmentRows ?? [];

  type LogRow = {
    assignment_id: string;
    student_id: string;
    status: string | null;
    grade: string | null;
    comment: string | null;
    sent_at: string | null;
    updated_at: string;
    profiles: { full_name: string } | { full_name: string }[] | null;
  };

  const studentIds = enrollments.map((e) => e.student_id);
  const assignmentIds = assignments.map((a) => a.id);
  const logs: LogRow[] =
    assignmentIds.length && studentIds.length
      ? ((
          await supabase
            .from("assignment_logs")
            .select("assignment_id, student_id, status, grade, comment, sent_at, updated_at, profiles(full_name)")
            .in("assignment_id", assignmentIds)
            .in("student_id", studentIds)
        ).data ?? [])
      : [];

  const logKey = (assignmentId: string, studentId: string) => `${assignmentId}::${studentId}`;
  const logByKey = new Map<string, LogRow>();
  for (const l of logs) logByKey.set(logKey(l.assignment_id, l.student_id), l);

  const rows: StudentAssignmentDetailRow[] = [];
  for (const e of enrollments) {
    const student = Array.isArray(e.students) ? e.students[0] : e.students;
    const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    if (!student) continue;

    if (assignments.length === 0) {
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
        assignmentTitle: "",
        dueDate: null,
        maxMarks: 0,
        status: "",
        grade: "",
        comment: "",
        loggedBy: null,
        sentAt: null,
        updatedAt: null,
      });
      continue;
    }

    for (const a of assignments) {
      const log = logByKey.get(logKey(a.id, e.student_id));
      const loggedBy = log ? (Array.isArray(log.profiles) ? log.profiles[0] : log.profiles) : null;
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
        assignmentTitle: a.title,
        dueDate: a.due_date,
        maxMarks: a.max_marks,
        status: log?.status ?? "not logged",
        grade: log?.grade ?? "",
        comment: log?.comment ?? "",
        loggedBy: loggedBy?.full_name ?? null,
        sentAt: log?.sent_at ?? null,
        updatedAt: log?.updated_at ?? null,
      });
    }
  }

  return rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
}
