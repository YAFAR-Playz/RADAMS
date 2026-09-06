"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type CourseOffering = {
  id: string;
  name: string;
  heads: string[];
  students: number;
  start: string | null;
  end: string | null;
  active: boolean;
  feeFull: number | null;
  feeInstallmentTotal: number | null;
  installmentCount: number;
};

export type HeadOption = { id: string; name: string };

export type EnrolledStudent = { name: string; initials: string; assistant: string | null };

export type CourseInput = {
  id?: string;
  courseName: string;
  session: string;
  unit: string;
  start: string;
  end: string;
  feeFull: string;
  feeInstallmentTotal: string;
  installmentCount: number;
  headIds: string[];
  schedule?: { seq: number; amount: number; dueDate: string }[];
};

export type ScheduleRow = { seq: number; amount: number; dueDate: string | null };

export async function listHeadsForOrg(): Promise<HeadOption[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("org_id", orgId).eq("role", "head").is("left_at", null);
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name }));
}

export type CoursesOverview = { offerings: CourseOffering[]; totalEnrolledStudents: number };

export async function listCourses(): Promise<CoursesOverview> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return { offerings: [], totalEnrolledStudents: 0 };
  const supabase = await createClient();

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select(
      "id, session, unit, start_date, end_date, active, fee_full, fee_installment_total, installment_count, courses(name)"
    )
    .eq("org_id", orgId);
  if (!offerings || offerings.length === 0) return { offerings: [], totalEnrolledStudents: 0 };

  const offeringIds = offerings.map((o) => o.id);
  const { data: headLinks } = await supabase
    .from("offering_heads")
    .select("offering_id, profiles(full_name)")
    .in("offering_id", offeringIds);
  // A student who left this specific course still keeps their enrollment
  // row, and one enrolled in several offerings shows up once per offering —
  // neither should count toward "currently enrolled" totals.
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("offering_id, student_id, left_at")
    .in("offering_id", offeringIds);
  const activeEnrollments = (enrollments ?? []).filter((e) => !e.left_at);

  const headsByOffering = new Map<string, string[]>();
  for (const row of headLinks ?? []) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!p) continue;
    const list = headsByOffering.get(row.offering_id) ?? [];
    list.push(p.full_name);
    headsByOffering.set(row.offering_id, list);
  }
  const studentsByOffering = new Map<string, number>();
  for (const e of activeEnrollments) {
    studentsByOffering.set(e.offering_id, (studentsByOffering.get(e.offering_id) ?? 0) + 1);
  }
  const totalEnrolledStudents = new Set(activeEnrollments.map((e) => e.student_id)).size;

  const offeringRows = offerings.map((o) => {
    const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
    return {
      id: o.id,
      name: [course?.name, o.session, o.unit].filter(Boolean).join(" · "),
      heads: headsByOffering.get(o.id) ?? [],
      students: studentsByOffering.get(o.id) ?? 0,
      start: o.start_date,
      end: o.end_date,
      active: o.active,
      feeFull: o.fee_full,
      feeInstallmentTotal: o.fee_installment_total,
      installmentCount: o.installment_count,
    };
  });

  return { offerings: offeringRows, totalEnrolledStudents };
}

export async function saveCourse(input: CourseInput): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const orgId = profile.org.id;

  let courseId: string;
  const { data: existingCourse } = await supabase
    .from("courses")
    .select("id")
    .eq("org_id", orgId)
    .ilike("name", input.courseName.trim())
    .maybeSingle();
  if (existingCourse) {
    courseId = existingCourse.id;
  } else {
    const { data: newCourse, error } = await supabase.from("courses").insert({ org_id: orgId, name: input.courseName.trim() }).select("id").single();
    if (error || !newCourse) throw new Error(error?.message ?? "Failed to create course");
    courseId = newCourse.id;
  }

  const payload = {
    org_id: orgId,
    course_id: courseId,
    session: input.session.trim(),
    unit: input.unit.trim() || null,
    start_date: input.start || null,
    end_date: input.end || null,
    fee_full: input.feeFull ? Number(input.feeFull) : null,
    fee_installment_total: input.feeInstallmentTotal ? Number(input.feeInstallmentTotal) : null,
    installment_count: input.installmentCount,
  };

  let offeringId: string;
  if (input.id) {
    const { error } = await supabase.from("course_offerings").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    offeringId = input.id;
    await supabase.from("offering_heads").delete().eq("offering_id", offeringId);
  } else {
    const { data, error } = await supabase.from("course_offerings").insert(payload).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create course offering");
    offeringId = data.id;
  }

  if (input.headIds.length) {
    const { error } = await supabase
      .from("offering_heads")
      .insert(input.headIds.map((headId) => ({ offering_id: offeringId, head_id: headId })));
    if (error) throw new Error(error.message);
  }

  await supabase.from("course_installment_schedule").delete().eq("offering_id", offeringId);
  if (input.installmentCount > 1 && input.schedule?.length) {
    const { error } = await supabase.from("course_installment_schedule").insert(
      input.schedule.map((row) => ({
        offering_id: offeringId,
        seq: row.seq,
        amount: row.amount,
        due_date: row.dueDate || null,
      }))
    );
    if (error) throw new Error(error.message);
  }

  return { id: offeringId };
}

export async function getInstallmentSchedule(offeringId: string): Promise<ScheduleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("course_installment_schedule")
    .select("seq, amount, due_date")
    .eq("offering_id", offeringId)
    .order("seq", { ascending: true });
  return (data ?? []).map((r) => ({ seq: r.seq, amount: Number(r.amount), dueDate: r.due_date }));
}

export async function toggleCourseActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("course_offerings").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateCourseDates(id: string, start: string, end: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("course_offerings")
    .update({ start_date: start || null, end_date: end || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getEnrolledStudents(offeringId: string): Promise<EnrolledStudent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("enrollments")
    .select("students(name, initials), profiles(full_name)")
    .eq("offering_id", offeringId);
  return (data ?? [])
    .map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      const a = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      if (!s) return null;
      return { name: s.name, initials: s.initials, assistant: a?.full_name ?? null };
    })
    .filter((x): x is EnrolledStudent => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}
