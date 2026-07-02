"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type TopicOption = {
  id: string;
  label: string;
  videoLink: string | null;
  driveLink: string | null;
  courseId: string | null;
  courseName: string | null;
};

export type StudentTopicSubmission = {
  id: string;
  studentId: string;
  studentName: string;
  topicId: string;
  topicLabel: string;
  videoLink: string | null;
  driveLink: string | null;
  status: "pending" | "approved" | "rejected";
  period: string;
  assistantName: string | null;
};

async function requireHeadOrAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  return profile;
}

export async function listCoursesForOrg(): Promise<{ id: string; name: string }[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id, name").eq("org_id", profile.org.id).order("name");
  return data ?? [];
}

export async function listTopicCatalog(courseId?: string): Promise<TopicOption[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();
  let query = supabase.from("topic_catalog").select("id, label, video_link, drive_link, course_id, courses(name)").eq("org_id", profile.org.id).order("label");
  if (courseId) query = query.eq("course_id", courseId);
  const { data } = await query;
  return (data ?? []).map((r) => {
    const course = Array.isArray(r.courses) ? r.courses[0] : r.courses;
    return {
      id: r.id,
      label: r.label,
      videoLink: r.video_link,
      driveLink: r.drive_link,
      courseId: r.course_id,
      courseName: course?.name ?? null,
    };
  });
}

export async function createTopic(input: { courseId: string | null; label: string; videoLink: string; driveLink: string }) {
  const profile = await requireHeadOrAdmin();
  if (!input.label.trim()) return;
  const supabase = await createClient();
  const { error } = await supabase.from("topic_catalog").insert({
    org_id: profile.org!.id,
    course_id: input.courseId,
    label: input.label.trim(),
    video_link: input.videoLink.trim() || null,
    drive_link: input.driveLink.trim() || null,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
}

export async function updateTopic(id: string, input: { label: string; videoLink: string; driveLink: string }) {
  await requireHeadOrAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("topic_catalog")
    .update({ label: input.label.trim(), video_link: input.videoLink.trim() || null, drive_link: input.driveLink.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
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
  submissions: { id: string; topicId: string; topicLabel: string; status: "pending" | "approved" | "rejected" }[];
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
    .select("id, student_id, topic_id, status, topic_catalog(label)")
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
          return { id: sub.id, topicId: sub.topic_id, topicLabel: topic?.label ?? "", status: sub.status as "pending" | "approved" | "rejected" };
        });
      return { studentId: s.id, studentName: s.name, submissions: subs };
    })
    .filter((x): x is AssistantStudentTopics => !!x)
    .sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export async function submitStudentTopic(input: { studentId: string; offeringId: string; topicId: string; period: string }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase.from("student_topic_submissions").insert({
    org_id: profile.org.id,
    student_id: input.studentId,
    offering_id: input.offeringId,
    topic_id: input.topicId,
    assistant_id: profile.id,
    period: input.period,
  });
  if (error) throw new Error(error.message);
}

export async function removeStudentTopicSubmission(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("student_topic_submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listPendingTopicApprovals(offeringId: string, period: string): Promise<StudentTopicSubmission[]> {
  await requireHeadOrAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_topic_submissions")
    .select("id, status, period, student_id, students(name), topic_id, topic_catalog(label, video_link, drive_link), profiles!student_topic_submissions_assistant_id_fkey(full_name)")
    .eq("offering_id", offeringId)
    .eq("period", period)
    .order("submitted_at", { ascending: false });

  return (data ?? []).map((r) => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students;
    const topic = Array.isArray(r.topic_catalog) ? r.topic_catalog[0] : r.topic_catalog;
    const assistant = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      studentId: r.student_id,
      studentName: student?.name ?? "",
      topicId: r.topic_id,
      topicLabel: topic?.label ?? "",
      videoLink: topic?.video_link ?? null,
      driveLink: topic?.drive_link ?? null,
      status: r.status as "pending" | "approved" | "rejected",
      period: r.period,
      assistantName: assistant?.full_name ?? null,
    };
  });
}

export async function reviewTopicSubmission(id: string, status: "approved" | "rejected") {
  const profile = await requireHeadOrAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_topic_submissions")
    .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type ApprovedStudentTopic = {
  studentId: string;
  studentName: string;
  topicLabel: string;
  videoLink: string | null;
  driveLink: string | null;
};

export async function listApprovedTopicsForPeriod(period: string): Promise<ApprovedStudentTopic[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || (profile.role !== "admin" && profile.role !== "head")) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_topic_submissions")
    .select("student_id, students(name), topic_catalog(label, video_link, drive_link)")
    .eq("org_id", profile.org.id)
    .eq("period", period)
    .eq("status", "approved");

  return (data ?? []).map((r) => {
    const student = Array.isArray(r.students) ? r.students[0] : r.students;
    const topic = Array.isArray(r.topic_catalog) ? r.topic_catalog[0] : r.topic_catalog;
    return {
      studentId: r.student_id,
      studentName: student?.name ?? "",
      topicLabel: topic?.label ?? "",
      videoLink: topic?.video_link ?? null,
      driveLink: topic?.drive_link ?? null,
    };
  });
}
