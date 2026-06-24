"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type RegistrationFields = {
  name: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
};

export type RegistrationRow = {
  enrollmentId: string;
  studentId: string;
  name: string;
  initials: string;
  phone: string | null;
  guardianPhone: string | null;
  offering: string;
  enrolledAt: string;
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function registerStudent(offeringId: string, fields: RegistrationFields): Promise<{ studentId: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  if (!fields.name.trim()) throw new Error("Name is required");
  const supabase = await createClient();

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
    })
    .select("id")
    .single();
  if (error || !student) throw new Error(error?.message ?? "Failed to register student");

  const { error: enrollError } = await supabase.from("enrollments").insert({ student_id: student.id, offering_id: offeringId });
  if (enrollError) throw new Error(enrollError.message);

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
    .select("id, student_id, created_at, students(id, name, initials, phone, guardian_phone), course_offerings(session, unit, courses(name))")
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
        initials: s.initials,
        phone: s.phone,
        guardianPhone: s.guardian_phone,
        offering: offeringLabel(o),
        enrolledAt: e.created_at,
      };
    })
    .filter((x): x is RegistrationRow => !!x);
}
