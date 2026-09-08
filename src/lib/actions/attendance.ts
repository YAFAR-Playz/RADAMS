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
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("attendance_sessions")
    .select("id, title, session_date, session_time")
    .eq("offering_id", offeringId)
    .order("session_date", { ascending: false });
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);
  // "Total" reflects who's CURRENTLY enrolled and hasn't left THIS course
  // (scoped the same way getSessionRoster is, so the sidebar and the open
  // roster always agree) — not however many attendance_record rows happen
  // to exist for a session, which undercounts once a student enrolls after
  // the session was first created and taken (they show up in the live
  // roster with no record yet, correctly defaulted to absent, but were
  // invisible here).
  let enrollmentCountQuery = supabase
    .from("enrollments")
    .select("student_id", { count: "exact", head: true })
    .eq("offering_id", offeringId)
    .is("left_at", null);
  if (profile?.role === "assistant") enrollmentCountQuery = enrollmentCountQuery.eq("assistant_id", profile.id);

  // Fetched separately (rather than joining) so excluding left students'
  // present records below doesn't need a per-record join — this is only
  // ever the (typically small) set of people who've left, not the whole
  // roster, regardless of course size.
  const leftStudentsQuery = supabase.from("enrollments").select("student_id").eq("offering_id", offeringId).not("left_at", "is", null);

  // Filtering to present/late at the DB level (rather than fetching every
  // record, including "absent" ones, and filtering in JS) keeps this well
  // under Postgrest's default 1000-row cap for the common case — a course
  // with several thousand-student sessions was pulling all of their rows
  // combined, silently truncating and undercounting whichever session's
  // rows happened to sort past the cutoff. Still paginated as a backstop
  // for a course with a genuinely huge number of people marked present.
  const presentRecords: { session_id: string; student_id: string }[] = [];
  const PRESENT_PAGE_SIZE = 1000;
  const [, { count: total }, { data: leftStudentRows }] = await Promise.all([
    (async () => {
      for (let from = 0; ; from += PRESENT_PAGE_SIZE) {
        const { data: page } = await supabase
          .from("attendance_records")
          .select("session_id, student_id")
          .in("session_id", sessionIds)
          .in("status", ["present", "late"])
          .range(from, from + PRESENT_PAGE_SIZE - 1);
        if (!page || page.length === 0) break;
        presentRecords.push(...page);
        if (page.length < PRESENT_PAGE_SIZE) break;
      }
    })(),
    enrollmentCountQuery,
    leftStudentsQuery,
  ]);
  const leftStudentIds = new Set((leftStudentRows ?? []).map((r) => r.student_id));

  const presentBySession = new Map<string, number>();
  for (const r of presentRecords) {
    if (leftStudentIds.has(r.student_id)) continue;
    presentBySession.set(r.session_id, (presentBySession.get(r.session_id) ?? 0) + 1);
  }

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    date: s.session_date,
    time: s.session_time,
    present: presentBySession.get(s.id) ?? 0,
    total: total ?? 0,
  }));
}

export async function getSessionRoster(sessionId: string): Promise<AttendanceRosterRow[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  const { data: session } = await supabase.from("attendance_sessions").select("offering_id").eq("id", sessionId).single();
  if (!session) return [];

  // A student who left THIS course shouldn't show up to take attendance
  // against — same rule as the Students tab and everywhere else "left" is
  // checked. "Left" is tracked per enrollment (setEnrollmentLeftStatus in
  // students.ts), so this filters directly on the enrollment row.
  let enrollmentQuery = supabase
    .from("enrollments")
    .select("student_id, assistant_id, students(id, name, student_code, initials, phone, guardian_phone)")
    .eq("offering_id", session.offering_id)
    .is("left_at", null);
  if (profile.role === "assistant") {
    enrollmentQuery = enrollmentQuery.eq("assistant_id", profile.id);
  }
  const { data: enrollments } = await enrollmentQuery;
  if (!enrollments) return [];

  // Scoping to session_id alone is already exact — the .map() below only
  // ever looks up students present in `enrollments`, so records for anyone
  // else are simply never read. Adding `.in("student_id", studentIds)` on
  // top used to build a URL filter with one UUID per enrolled student —
  // for a large course (900+ students here) that's tens of thousands of
  // characters, well past what a GET request's URL can carry, so the
  // query silently failed and came back empty. Every student then fell
  // through to the "absent" default below, making a session that already
  // had real attendance recorded look completely reset. Paginated in
  // batches since a single unbounded select silently truncates at
  // PostgREST's default 1000-row cap once a course passes that size.
  const records: { student_id: string; status: AttendanceStatus }[] = [];
  const ATTENDANCE_PAGE_SIZE = 1000;
  for (let from = 0; ; from += ATTENDANCE_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("attendance_records")
      .select("student_id, status")
      .eq("session_id", sessionId)
      .range(from, from + ATTENDANCE_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    records.push(...page);
    if (page.length < ATTENDANCE_PAGE_SIZE) break;
  }
  const statusByStudent = new Map(records.map((r) => [r.student_id, r.status]));

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

  // A student who already left this course shouldn't get a fresh record
  // seeded for a brand-new session — same rule as the roster and export.
  // Paginated: an unbounded select here silently truncated at Postgrest's
  // default 1000-row cap for a 1,000+ student course, seeding records for
  // only the first 1000 enrolled students and silently skipping the rest
  // (harmless for the roster/export today, since both fall back to
  // enrollments directly and default a missing record to absent — but the
  // gap is still real and worth not having).
  const enrollments: { student_id: string }[] = [];
  const ENROLLMENT_PAGE_SIZE = 1000;
  for (let from = 0; ; from += ENROLLMENT_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("offering_id", input.offeringId)
      .is("left_at", null)
      .range(from, from + ENROLLMENT_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    enrollments.push(...page);
    if (page.length < ENROLLMENT_PAGE_SIZE) break;
  }
  if (enrollments.length) {
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
  const { data: before } = await supabase.from("attendance_sessions").select("title, session_date, session_time").eq("id", id).maybeSingle();

  const newTitle = input.title || "New session";
  const { error } = await supabase
    .from("attendance_sessions")
    .update({ title: newTitle, session_date: input.date, session_time: input.time })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const changes = before
    ? [
        before.title !== newTitle ? `title "${before.title}" → "${newTitle}"` : null,
        before.session_date !== input.date ? `date ${before.session_date} → ${input.date}` : null,
        before.session_time !== input.time ? `time ${before.session_time} → ${input.time}` : null,
      ].filter((x): x is string => !!x)
    : [];
  await logActivity("attendance", `Updated session "${newTitle}"${changes.length ? ` — ${changes.join(", ")}` : ""}`);
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

  // A student who left THIS course is excluded — same rule as the live
  // roster (getSessionRoster) and everywhere else "left" is checked.
  let enrollmentQuery = supabase
    .from("enrollments")
    .select("student_id, assistant_id, students(id, name, guardian_phone)")
    .eq("offering_id", offeringId)
    .is("left_at", null);
  if (profile.role === "assistant") enrollmentQuery = enrollmentQuery.eq("assistant_id", profile.id);
  const { data: enrollments } = await enrollmentQuery;
  if (!enrollments || !enrollments.length) return [];

  const { data: sessionsData } = await supabase
    .from("attendance_sessions")
    .select("id, title, session_date")
    .eq("offering_id", offeringId)
    .order("session_date", { ascending: true });
  if (!sessionsData || !sessionsData.length) return [];

  const sessionIds = sessionsData.map((s) => s.id);
  // Scoping to session_id alone is already exact — the loop below only
  // ever reads students present in `enrollments`, so records for anyone
  // else are simply never used. Adding .in("student_id", studentIds) on
  // top (as this used to) builds a URL filter with one UUID per enrolled
  // student — for a large course that's tens of thousands of characters,
  // past what a GET request's URL can carry, silently failing the whole
  // query (see the identical fix in getSessionRoster). Paginated in
  // batches since a large course's full session history can also clear
  // Postgrest's default 1000-row cap on its own.
  const records: { session_id: string; student_id: string; status: AttendanceStatus }[] = [];
  const EXPORT_PAGE_SIZE = 1000;
  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("attendance_records")
      .select("session_id, student_id, status")
      .in("session_id", sessionIds)
      .range(from, from + EXPORT_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    records.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) break;
  }
  const statusByKey = new Map(records.map((r) => [`${r.session_id}::${r.student_id}`, r.status]));

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
