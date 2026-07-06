"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";

export type AttendanceStatus = "present" | "late" | "absent";

export type SessionSummary = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  present: number;
  total: number;
};

export type AttendanceRosterRow = {
  studentId: string;
  name: string;
  studentCode: string;
  initials: string;
  phone: string | null;
  guardianPhone: string | null;
  status: AttendanceStatus;
};

export async function listSessions(offeringId: string): Promise<SessionSummary[]> {
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id, title, session_date, session_time")
    .eq("offering_id", offeringId)
    .order("session_date", { ascending: false });
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  const { data: records } = await supabase
    .from("attendance_records")
    .select("session_id, status")
    .in("session_id", sessionIds);

  const presentBySession = new Map<string, number>();
  const totalBySession = new Map<string, number>();
  for (const r of records ?? []) {
    totalBySession.set(r.session_id, (totalBySession.get(r.session_id) ?? 0) + 1);
    if (r.status === "present" || r.status === "late") {
      presentBySession.set(r.session_id, (presentBySession.get(r.session_id) ?? 0) + 1);
    }
  }

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    date: s.session_date,
    time: s.session_time,
    present: presentBySession.get(s.id) ?? 0,
    total: totalBySession.get(s.id) ?? 0,
  }));
}

export async function getSessionRoster(sessionId: string): Promise<AttendanceRosterRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  const { data: session } = await supabase.from("attendance_sessions").select("offering_id").eq("id", sessionId).single();
  if (!session) return [];

  let enrollmentQuery = supabase
    .from("enrollments")
    .select("student_id, assistant_id, students(id, name, student_code, initials, phone, guardian_phone)")
    .eq("offering_id", session.offering_id);
  if (profile.role === "assistant") {
    enrollmentQuery = enrollmentQuery.eq("assistant_id", profile.id);
  }
  const { data: enrollments } = await enrollmentQuery;
  if (!enrollments) return [];

  const studentIds = enrollments.map((e) => e.student_id);
  const { data: records } = studentIds.length
    ? await supabase.from("attendance_records").select("student_id, status").eq("session_id", sessionId).in("student_id", studentIds)
    : { data: [] as { student_id: string; status: AttendanceStatus }[] };
  const statusByStudent = new Map((records ?? []).map((r) => [r.student_id, r.status]));

  return enrollments
    .map((e) => {
      const student = Array.isArray(e.students) ? e.students[0] : e.students;
      if (!student) return null;
      return {
        studentId: e.student_id,
        name: student.name,
        studentCode: student.student_code,
        initials: student.initials,
        phone: student.phone,
        guardianPhone: student.guardian_phone,
        // A student with no record for this session was never marked for it
        // — most often because they enrolled after the session was created
        // and attendance already taken, so they genuinely weren't there.
        // Defaulting to absent (not present) reflects that correctly.
        status: statusByStudent.get(e.student_id) ?? "absent",
      };
    })
    .filter((x): x is AttendanceRosterRow => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type StudentAttendanceRow = { sessionId: string; title: string; date: string; status: AttendanceStatus };
export type StudentAttendanceSummary = { records: StudentAttendanceRow[]; presentPct: number };

export async function getStudentAttendance(studentId: string): Promise<StudentAttendanceSummary> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attendance_records")
    .select("session_id, status, attendance_sessions(title, session_date)")
    .eq("student_id", studentId);

  const records: StudentAttendanceRow[] = (data ?? [])
    .map((r) => {
      const session = Array.isArray(r.attendance_sessions) ? r.attendance_sessions[0] : r.attendance_sessions;
      if (!session) return null;
      return { sessionId: r.session_id, title: session.title, date: session.session_date, status: r.status as AttendanceStatus };
    })
    .filter((x): x is StudentAttendanceRow => !!x)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const presentCount = records.filter((r) => r.status === "present" || r.status === "late").length;
  const presentPct = records.length ? Math.round((presentCount / records.length) * 100) : 0;

  return { records, presentPct };
}

export async function createSession(input: { offeringId: string; title: string; date: string; time: string }): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("attendance_sessions")
    .insert({
      offering_id: input.offeringId,
      title: input.title || "New session",
      session_date: input.date,
      session_time: input.time,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !session) throw new Error(error?.message ?? "Failed to create session");

  const { data: enrollments } = await supabase.from("enrollments").select("student_id").eq("offering_id", input.offeringId);
  if (enrollments && enrollments.length) {
    const { error: recError } = await supabase
      .from("attendance_records")
      .insert(enrollments.map((e) => ({ session_id: session.id, student_id: e.student_id, status: "absent" as const })));
    if (recError) throw new Error(recError.message);
  }

  await logActivity("attendance", `Created session "${input.title || "New session"}" on ${input.date}`);

  return { id: session.id };
}

export async function updateSession(id: string, input: { title: string; date: string; time: string }) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ title: input.title || "New session", session_date: input.date, session_time: input.time })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("attendance", `Updated session "${input.title || "New session"}"`);
}

export async function deleteSession(id: string) {
  const supabase = await createClient();
  const { data: session } = await supabase.from("attendance_sessions").select("title").eq("id", id).maybeSingle();
  const { error } = await supabase.from("attendance_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("attendance", `Deleted session "${session?.title ?? "Untitled"}" and its attendance records`);
}

export async function markAttendance(sessionId: string, studentId: string, status: AttendanceStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_records")
    .upsert({ session_id: sessionId, student_id: studentId, status, updated_at: new Date().toISOString() }, { onConflict: "session_id,student_id" });
  if (error) throw new Error(error.message);
}

export async function markAllPresent(sessionId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_records")
    .update({ status: "present", updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
  if (error) throw new Error(error.message);
}

export type AttendanceExportRow = {
  studentName: string;
  guardianPhone: string | null;
  sessionTitle: string;
  sessionDate: string;
  status: AttendanceStatus;
};

// Every session × every student for the offering, in one shot — scoped to
// whatever the caller can already see (an assistant's own students only;
// head/registration get the full course they picked), rather than the
// single currently-open session.
export async function getFullAttendanceExport(offeringId: string): Promise<AttendanceExportRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  let enrollmentQuery = supabase.from("enrollments").select("student_id, assistant_id, students(id, name, guardian_phone)").eq("offering_id", offeringId);
  if (profile.role === "assistant") enrollmentQuery = enrollmentQuery.eq("assistant_id", profile.id);
  const { data: enrollments } = await enrollmentQuery;
  if (!enrollments || !enrollments.length) return [];

  const { data: sessionsData } = await supabase
    .from("attendance_sessions")
    .select("id, title, session_date")
    .eq("offering_id", offeringId)
    .order("session_date", { ascending: true });
  if (!sessionsData || !sessionsData.length) return [];

  const studentIds = enrollments.map((e) => e.student_id);
  const sessionIds = sessionsData.map((s) => s.id);
  const { data: records } = await supabase
    .from("attendance_records")
    .select("session_id, student_id, status")
    .in("session_id", sessionIds)
    .in("student_id", studentIds);
  const statusByKey = new Map((records ?? []).map((r) => [`${r.session_id}::${r.student_id}`, r.status]));

  const rows: AttendanceExportRow[] = [];
  for (const s of sessionsData) {
    for (const e of enrollments) {
      const student = Array.isArray(e.students) ? e.students[0] : e.students;
      if (!student) continue;
      rows.push({
        studentName: student.name,
        guardianPhone: student.guardian_phone,
        sessionTitle: s.title,
        sessionDate: s.session_date,
        // Same rule as getSessionRoster — no record means they weren't
        // enrolled (or weren't marked) for that session, so default absent.
        status: statusByKey.get(`${s.id}::${e.student_id}`) ?? "absent",
      });
    }
  }
  return rows;
}
