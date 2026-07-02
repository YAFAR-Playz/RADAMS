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
  initials: string;
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
    .select("student_id, assistant_id, students(id, name, initials, guardian_phone)")
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
        initials: student.initials,
        guardianPhone: student.guardian_phone,
        status: statusByStudent.get(e.student_id) ?? "present",
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
      .insert(enrollments.map((e) => ({ session_id: session.id, student_id: e.student_id, status: "present" as const })));
    if (recError) throw new Error(recError.message);
  }

  await logActivity("attendance", `Created session "${input.title || "New session"}" on ${input.date}`);

  return { id: session.id };
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
