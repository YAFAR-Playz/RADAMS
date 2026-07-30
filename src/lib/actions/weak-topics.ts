"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type TopicMaterial = { id: string; kind: "video" | "drive"; label: string | null; link: string; duration: string | null };

export type TopicOption = {
  id: string;
  label: string;
  courseId: string | null;
  courseName: string | null;
  materials: TopicMaterial[];
};

async function requireHeadOrAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  return profile;
}

// The catalog is scoped to a course, but the head only ever picks an
// offering (which already carries course + session + unit) — deriving the
// course from that offering avoids a second, redundant course picker, and
// means the catalog can never show a course the head isn't actually
// assigned to (listMyOfferings already scopes offerings correctly).
export async function getOfferingCourse(offeringId: string): Promise<{ courseId: string; courseName: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("course_offerings").select("course_id, courses(name)").eq("id", offeringId).maybeSingle();
  if (!data) return null;
  const course = Array.isArray(data.courses) ? data.courses[0] : data.courses;
  return { courseId: data.course_id, courseName: course?.name ?? "" };
}

export async function listTopicCatalog(courseId?: string): Promise<TopicOption[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();
  let query = supabase
    .from("topic_catalog")
    .select("id, label, course_id, courses(name), topic_materials(id, kind, label, link, duration, sort_order)")
    .eq("org_id", profile.org.id)
    .order("label");
  if (courseId) query = query.eq("course_id", courseId);
  const { data } = await query;
  return (data ?? []).map((r) => {
    const course = Array.isArray(r.courses) ? r.courses[0] : r.courses;
    const materials = (Array.isArray(r.topic_materials) ? r.topic_materials : []).sort((a, b) => a.sort_order - b.sort_order);
    return {
      id: r.id,
      label: r.label,
      courseId: r.course_id,
      courseName: course?.name ?? null,
      materials: materials.map((m) => ({ id: m.id, kind: m.kind as "video" | "drive", label: m.label, link: m.link, duration: m.duration })),
    };
  });
}

export type MaterialInput = { kind: "video" | "drive"; label: string; link: string; duration: string };

async function replaceMaterials(topicId: string, materials: MaterialInput[]) {
  const supabase = await createClient();
  await supabase.from("topic_materials").delete().eq("topic_id", topicId);
  const rows = materials
    .filter((m) => m.link.trim())
    .map((m, i) => ({
      topic_id: topicId,
      kind: m.kind,
      label: m.label.trim() || null,
      link: m.link.trim(),
      duration: m.kind === "video" ? m.duration.trim() || null : null,
      sort_order: i,
    }));
  if (rows.length) {
    const { error } = await supabase.from("topic_materials").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function createTopic(input: { courseId: string | null; label: string; materials: MaterialInput[] }) {
  const profile = await requireHeadOrAdmin();
  if (!input.label.trim()) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_catalog")
    .insert({ org_id: profile.org!.id, course_id: input.courseId, label: input.label.trim(), created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create topic");
  await replaceMaterials(data.id, input.materials);
}

export async function updateTopic(id: string, input: { label: string; materials: MaterialInput[] }) {
  await requireHeadOrAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("topic_catalog").update({ label: input.label.trim() }).eq("id", id);
  if (error) throw new Error(error.message);
  await replaceMaterials(id, input.materials);
}

export async function deleteTopic(id: string) {
  await requireHeadOrAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("topic_catalog").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type AssistantStudentTopics = {
  studentId: string;
  studentName: string;
  submissions: { id: string; topicId: string; topicLabel: string }[];
};

export async function listStudentTopicsForOffering(offeringId: string, period: string): Promise<AssistantStudentTopics[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(id, name)")
    .eq("offering_id", offeringId)
    .eq("assistant_id", profile.id);

  const { data: submissions } = await supabase
    .from("student_topic_submissions")
    .select("id, student_id, topic_id, topic_catalog(label)")
    .eq("offering_id", offeringId)
    .eq("assistant_id", profile.id)
    .eq("period", period);

  return (enrollments ?? [])
    .map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      if (!s) return null;
      const subs = (submissions ?? [])
        .filter((sub) => sub.student_id === s.id)
        .map((sub) => {
          const topic = Array.isArray(sub.topic_catalog) ? sub.topic_catalog[0] : sub.topic_catalog;
          return { id: sub.id, topicId: sub.topic_id, topicLabel: topic?.label ?? "" };
        });
      return { studentId: s.id, studentName: s.name, submissions: subs };
    })
    .filter((x): x is AssistantStudentTopics => !!x)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export type AssistantFillingProgress = { assistantId: string; assistantName: string; totalStudents: number; filled: number; pending: number };

// "Filled" means the assistant has tagged at least one weak topic for that
// student this period — this tracks whether the assistant did their monthly
// tagging, distinct from "pending" review (there's no review step anymore;
// every submission counts immediately).
export async function getAssistantFillingProgress(offeringId: string, period: string): Promise<AssistantFillingProgress[]> {
  await requireHeadOrAdmin();
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, assistant_id, profiles(full_name)")
    .eq("offering_id", offeringId);

  const { data: submissions } = await supabase
    .from("student_topic_submissions")
    .select("student_id, assistant_id")
    .eq("offering_id", offeringId)
    .eq("period", period);

  const filledStudentIds = new Set((submissions ?? []).map((s) => s.student_id));

  const byAssistant = new Map<string, { assistantName: string; totalStudents: number; filled: number }>();
  for (const e of enrollments ?? []) {
    if (!e.assistant_id) continue;
    const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    const entry = byAssistant.get(e.assistant_id) ?? { assistantName: assistant?.full_name ?? "Unassigned", totalStudents: 0, filled: 0 };
    entry.totalStudents += 1;
    if (filledStudentIds.has(e.student_id)) entry.filled += 1;
    byAssistant.set(e.assistant_id, entry);
  }

  return Array.from(byAssistant.entries())
    .map(([assistantId, v]) => ({ assistantId, assistantName: v.assistantName, totalStudents: v.totalStudents, filled: v.filled, pending: v.totalStudents - v.filled }))
    .sort((a, b) => a.assistantName.localeCompare(b.assistantName));
}

// Submissions count immediately — there's no head-approval queue to sit in.
// A head/admin can also add one directly on a student's behalf; in that
// case it's attributed to the student's actual assigned assistant (not the
// head who clicked Add), so the assistant's own view and the monthly report
// stay consistent regardless of who submitted it.
export async function submitStudentTopic(input: { studentId: string; offeringId: string; topicId: string; period: string }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  let assistantId = profile.id;
  if (profile.role === "head" || profile.role === "admin") {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("assistant_id")
      .eq("student_id", input.studentId)
      .eq("offering_id", input.offeringId)
      .maybeSingle();
    if (!enrollment?.assistant_id) throw new Error("This student has no assistant assigned yet.");
    assistantId = enrollment.assistant_id;
  }

  const { error } = await supabase.from("student_topic_submissions").insert({
    org_id: profile.org.id,
    student_id: input.studentId,
    offering_id: input.offeringId,
    topic_id: input.topicId,
    assistant_id: assistantId,
    period: input.period,
    status: "approved",
  });
  if (error) throw new Error(error.message);
}

// Lets a head change which topic a submission is tagged with, without
// having to delete and re-add it.
export async function updateStudentTopicSubmission(id: string, topicId: string) {
  await requireHeadOrAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("student_topic_submissions").update({ topic_id: topicId }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeStudentTopicSubmission(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("student_topic_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type HeadStudentTopics = {
  studentId: string;
  studentName: string;
  assistantName: string | null;
  submissions: { id: string; topicId: string; topicLabel: string }[];
};

// The head-facing counterpart to listStudentTopicsForOffering — every
// enrolled student in the offering regardless of assistant, since a head
// oversees (and can now edit) the whole course rather than just their own
// students.
export async function listAllStudentTopicsForOffering(offeringId: string, period: string): Promise<HeadStudentTopics[]> {
  await requireHeadOrAdmin();
  const supabase = await createClient();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id, students(id, name), profiles(full_name)")
    .eq("offering_id", offeringId);

  const { data: submissions } = await supabase
    .from("student_topic_submissions")
    .select("id, student_id, topic_id, topic_catalog(label)")
    .eq("offering_id", offeringId)
    .eq("period", period);

  return (enrollments ?? [])
    .map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      if (!s) return null;
      const assistant = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
      const subs = (submissions ?? [])
        .filter((sub) => sub.student_id === s.id)
        .map((sub) => {
          const topic = Array.isArray(sub.topic_catalog) ? sub.topic_catalog[0] : sub.topic_catalog;
          return { id: sub.id, topicId: sub.topic_id, topicLabel: topic?.label ?? "" };
        });
      return { studentId: s.id, studentName: s.name, assistantName: assistant?.full_name ?? null, submissions: subs };
    })
    .filter((x): x is HeadStudentTopics => !!x)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export type ApprovedStudentTopic = {
  studentId: string;
  studentName: string;
  topicLabel: string;
  materials: TopicMaterial[];
};

export async function listApprovedTopicsForPeriod(period: string): Promise<ApprovedStudentTopic[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "admin" && profile.role !== "head")) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_topic_submissions")
    .select("student_id, students(name), topic_catalog(label, topic_materials(id, kind, label, link, duration, sort_order))")
    .eq("org_id", profile.org.id)
    .eq("period", period)
    .eq("status", "approved");

  return (data ?? []).map((r) => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students;
    const topic = Array.isArray(r.topic_catalog) ? r.topic_catalog[0] : r.topic_catalog;
    const materials = (topic ? (Array.isArray(topic.topic_materials) ? topic.topic_materials : []) : []).sort((a, b) => a.sort_order - b.sort_order);
    return {
      studentId: r.student_id,
      studentName: student?.name ?? "",
      topicLabel: topic?.label ?? "",
      materials: materials.map((m) => ({ id: m.id, kind: m.kind as "video" | "drive", label: m.label, link: m.link, duration: m.duration })),
    };
  });
}
