"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { createPaymentPlan, type PlanType } from "@/lib/actions/payments";
import { logActivity } from "@/lib/actions/activity-log";
import { addStudentEnrollment } from "@/lib/actions/students";

export type RegistrationFields = {
  name: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
  planType: PlanType;
  // Only ever shown in the UI when the org's "Attendance ID matching"
  // toggle is on (see getAttendanceIdMatchingEnabled) — stored regardless
  // if present, same as the bulk import path.
  attendanceId?: string;
};

export type RegistrationRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  studentCode: string;
  initials: string;
  phone: string | null;
  guardianPhone: string | null;
  offering: string;
  enrolledAt: string;
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "-";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

// `existingStudentId` is set once the caller has confirmed a match found by
// `findDuplicateStudent` really is the same person — skips creating
// a new student row and just enrolls the existing one instead, so re-running
// this form for someone already in the system doesn't leave a duplicate
// record behind (mirrors `headAddStudent`'s pattern in students.ts).
export async function registerStudent(offeringId: string, fields: RegistrationFields, existingStudentId?: string): Promise<{ studentId: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  if (!fields.name.trim()) throw new Error("Name is required");
  if (!fields.phone.trim()) throw new Error("Phone number is required");
  if (!fields.guardianPhone.trim()) throw new Error("Guardian phone number is required");
  const supabase = await createClient();

  const attendanceId = fields.attendanceId?.trim() || null;

  if (existingStudentId) {
    // Same dedupe rule as the bulk import path: the id is never used to
    // decide the match (that already happened — the caller confirmed this
    // is the same person) and only ever backfilled onto an existing
    // student who doesn't already have one, never overwriting a real value.
    // Done BEFORE the enrollment/payment-plan writes below, and never
    // thrown on failure — this is enrichment on an already-confirmed
    // registration, not a precondition for it. Throwing after those writes
    // already committed would report total failure for a registration that
    // actually succeeded, and a retry would then hit createPaymentPlan a
    // second time (payment_plans has a unique (student_id, offering_id)).
    if (attendanceId) {
      const { data: existing } = await supabase.from("students").select("attendance_id").eq("id", existingStudentId).maybeSingle();
      if (existing && !existing.attendance_id) {
        await supabase.from("students").update({ attendance_id: attendanceId }).eq("id", existingStudentId);
      }
    }
    await addStudentEnrollment(existingStudentId, offeringId);
    await createPaymentPlan({ studentId: existingStudentId, offeringId, planType: fields.planType });
    return { studentId: existingStudentId };
  }

  const initials = fields.name
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
      name: fields.name.trim(),
      initials,
      phone: fields.phone || null,
      email: fields.email || null,
      guardian_name: fields.guardianName || null,
      guardian_phone: fields.guardianPhone || null,
      attendance_id: attendanceId,
    })
    .select("id")
    .single();
  if (attendanceId && error?.code === "23505") throw new Error("That attendance ID is already used by another student in this org.");
  if (error || !student) throw new Error(error?.message ?? "Failed to register student");

  const { error: enrollError } = await supabase.from("enrollments").insert({ student_id: student.id, offering_id: offeringId });
  if (enrollError) throw new Error(enrollError.message);

  await createPaymentPlan({ studentId: student.id, offeringId, planType: fields.planType });
  await logActivity("students", `Registered ${fields.name.trim()}`);

  return { studentId: student.id };
}

export async function listRegistrations(): Promise<RegistrationRow[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: offeringRows } = await supabase.from("course_offerings").select("id").eq("org_id", orgId);
  const offeringIds = (offeringRows ?? []).map((o) => o.id);
  if (!offeringIds.length) return [];

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id, created_at, students(id, name, student_code, initials, phone, guardian_phone), course_offerings(session, unit, courses(name))")
    .in("offering_id", offeringIds)
    .order("created_at", { ascending: false })
    .limit(200);

  return (enrollments ?? [])
    .map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      const o = Array.isArray(e.course_offerings) ? e.course_offerings[0] : e.course_offerings;
      if (!s) return null;
      return {
        enrollmentId: e.id,
        studentId: s.id,
        name: s.name,
        studentCode: s.student_code,
        initials: s.initials,
        phone: s.phone,
        guardianPhone: s.guardian_phone,
        offering: offeringLabel(o),
        enrolledAt: e.created_at,
      };
    })
    .filter((x): x is RegistrationRow => !!x);
}
