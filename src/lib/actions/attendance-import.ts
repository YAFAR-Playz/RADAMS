"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";
import type { AttendanceStatus } from "@/lib/actions/attendance";

export type AttendanceIdRosterEntry = { studentId: string; name: string; attendanceId: string | null };

// The offering's currently-enrolled roster with each student's stored
// attendance_id, for matching against a Zoom export client-side. Scoped to
// the offering (not org-wide) for the same reason student-import matching
// is offering-scoped: two different students across different courses could
// otherwise collide on an id that's only actually unique per class.
export async function getOfferingAttendanceIdRoster(offeringId: string): Promise<AttendanceIdRosterEntry[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "registration") return [];
  const supabase = await createClient();

  const rows: AttendanceIdRosterEntry[] = [];
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page } = await supabase
      .from("enrollments")
      .select("students(id, name, attendance_id)")
      .eq("offering_id", offeringId)
      .is("left_at", null)
      .range(from, from + PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    for (const row of page) {
      const student = Array.isArray(row.students) ? row.students[0] : row.students;
      if (student) rows.push({ studentId: student.id, name: student.name, attendanceId: student.attendance_id });
    }
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export type AttendanceImportEntry = { studentId: string; status: AttendanceStatus };

export async function commitAttendanceImport(sessionId: string, entries: AttendanceImportEntry[]): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "registration") throw new Error("Not authorized");
  if (!entries.length) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance_records")
    .upsert(
      entries.map((e) => ({ session_id: sessionId, student_id: e.studentId, status: e.status, updated_at: new Date().toISOString() })),
      { onConflict: "session_id,student_id" }
    );
  if (error) throw new Error(error.message);
  await logActivity("attendance", `Imported attendance for ${entries.length} student${entries.length === 1 ? "" : "s"} from a CSV`);
}
