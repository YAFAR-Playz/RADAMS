"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { getGeneratedReport } from "@/lib/actions/academic-report";
import { shouldShowGrade } from "@/lib/report-grade";
import { getBranding } from "@/lib/actions/branding";
import { formatGradeByScale } from "@/lib/grade-scale";

// Web App deployed from the RadAMS Reports Bridge Apps Script project — see
// that script's header comment for what each action does. Root folder is
// where the whole Org > Course > Assistant > Student hierarchy lives; it's
// not secret (just a Drive resource id), so a hardcoded fallback is fine,
// but DRIVE_ROOT_FOLDER_ID can override it without a code change.
const DRIVE_BRIDGE_URL = process.env.DRIVE_BRIDGE_URL;
const DRIVE_BRIDGE_SECRET = process.env.DRIVE_BRIDGE_SECRET;
const DRIVE_ROOT_FOLDER_ID = process.env.DRIVE_ROOT_FOLDER_ID || "1VmTbvucuiK7-2NF0OTusD5rhB3c7yEnB";

async function callDriveBridge<T>(action: string, params: Record<string, unknown>): Promise<T> {
  if (!DRIVE_BRIDGE_URL || !DRIVE_BRIDGE_SECRET) {
    throw new Error("Drive delivery isn't configured yet — DRIVE_BRIDGE_URL/DRIVE_BRIDGE_SECRET are missing.");
  }
  const res = await fetch(DRIVE_BRIDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, secret: DRIVE_BRIDGE_SECRET, ...params }),
  });
  const data = await res.json().catch(() => null);
  if (!data || !data.ok) {
    throw new Error((data && data.error) || `Drive bridge request failed (${res.status})`);
  }
  return data as T;
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function markFraction(grade: string | null, maxMarks: number | null): string | null {
  if (grade == null || grade.trim() === "") return null;
  return maxMarks ? `${grade}/${maxMarks}` : grade;
}

function requireHeadOrAdmin(role: string | undefined) {
  if (role !== "head" && role !== "admin") throw new Error("Not authorized");
}

// Shared setup for both listing who needs delivering and delivering a
// chunk — fetched fresh each call rather than cached across a whole course's
// delivery, since a long-running delivery (many chunks, possibly minutes
// apart) shouldn't work off data that's gone stale if a head edits the
// report mid-delivery.
async function loadDriveDeliveryContext(offeringId: string, period: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  requireHeadOrAdmin(profile.role);
  const supabase = await createClient();

  const [{ meta, students }, { data: offering }, branding] = await Promise.all([
    getGeneratedReport(offeringId, period),
    supabase.from("course_offerings").select("session, unit, courses(name)").eq("id", offeringId).maybeSingle(),
    getBranding(),
  ]);
  if (!meta) throw new Error("Generate the report for this month before delivering it to Drive.");

  const course = offering ? (Array.isArray(offering.courses) ? offering.courses[0] : offering.courses) : null;
  const courseLabel = offering ? [course?.name, offering.session, offering.unit].filter(Boolean).join(" · ") : "Course";

  return {
    supabase,
    meta,
    students,
    courseLabel,
    orgName: branding?.name ?? profile.org.name ?? "RadAMS",
    primaryColor: branding?.primary ?? "#2563eb",
    logoUrl: branding?.logoUrl ?? null,
    monthLabel: periodLabel(period),
  };
}

// The ordered list of student ids still needing delivery for this report —
// the client slices this into DRIVE_DELIVERY_CHUNK_SIZE-sized batches and
// calls deliverDriveReportsChunk once per batch. Already-delivered students
// (delivered_at set) are left out, so if a head closes the tab/app partway
// through, clicking "Send to Drive" again just resumes the rest instead of
// redoing everyone from scratch.
export async function getDriveDeliveryStudentIds(offeringId: string, period: string): Promise<string[]> {
  const { supabase, meta, students } = await loadDriveDeliveryContext(offeringId, period);
  const { data: delivered } = await supabase
    .from("monthly_report_students")
    .select("student_id")
    .eq("generation_id", meta.id)
    .not("delivered_at", "is", null);
  const deliveredIds = new Set((delivered ?? []).map((d) => d.student_id));
  return students.filter((s) => !deliveredIds.has(s.studentId)).map((s) => s.studentId);
}

export type DriveDeliveryResult = { studentId: string; ok: boolean; folderUrl?: string; fileUrl?: string; error?: string };

export type DriveDeletionResult = { studentId: string; ok: boolean; deleted: boolean; error?: string };

// Admin-only — deletes just this course+month's PDF from each student's
// Drive folder (via Apps Script's Trash, so it's recoverable there for the
// usual ~30 days), leaving the Org > Course > Assistant > Student folder
// structure itself untouched. Chunked for the same reason as delivery: a
// large course means many folder lookups + file operations inside Apps
// Script, which risks its own execution-time limit in one call.
export async function deleteMonthlyReportsFromDriveChunk(offeringId: string, period: string, studentIds: string[]): Promise<DriveDeletionResult[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") throw new Error("Not authorized");

  const { students, courseLabel, orgName, monthLabel } = await loadDriveDeliveryContext(offeringId, period);
  const wanted = new Set(studentIds);
  const scoped = students.filter((s) => wanted.has(s.studentId));
  if (scoped.length === 0) return [];

  const payload = {
    rootFolderId: DRIVE_ROOT_FOLDER_ID,
    orgName,
    courseLabel,
    monthLabel,
    students: scoped.map((s) => ({
      studentId: s.studentId,
      studentCode: s.studentCode,
      studentName: s.studentName,
      assistantName: s.assistantName ?? "Unassigned",
    })),
  };

  const { results } = await callDriveBridge<{ results: DriveDeletionResult[] }>("deleteReportsBatch", payload);
  return results;
}

// Delivers one chunk of students' already-generated monthly report data
// (same source the on-screen/print view uses — no duplicated logic) into
// their Drive folder as a branded PDF, creating any missing folder in the
// Org > Course > Assistant > Student hierarchy along the way, and keeps
// each student's drive_folder_link in sync. Safe to re-run on failure —
// folder creation is idempotent and the script replaces (not duplicates)
// that month's PDF.
export async function deliverDriveReportsChunk(offeringId: string, period: string, studentIds: string[]): Promise<DriveDeliveryResult[]> {
  const { supabase, meta, students, courseLabel, orgName, primaryColor, logoUrl, monthLabel } = await loadDriveDeliveryContext(offeringId, period);
  const wanted = new Set(studentIds);
  const scoped = students.filter((s) => wanted.has(s.studentId));
  if (scoped.length === 0) return [];

  const payload = {
    rootFolderId: DRIVE_ROOT_FOLDER_ID,
    orgName,
    courseLabel,
    monthLabel,
    primaryColor,
    logoUrl,
    students: scoped.map((s) => ({
      studentId: s.studentId,
      studentCode: s.studentCode,
      studentName: s.studentName,
      assistantName: s.assistantName ?? "Unassigned",
      // hasGrade is sent explicitly (not inferred from grade being non-null)
      // so an ungraded-so-far assignment that's still meant to carry a grade
      // shows "Grade: —" instead of silently falling back to a plain status
      // row — same distinction the print view makes via shouldShowGrade.
      homeworks: s.assignments
        .filter((a) => a.reportGroup === "homework")
        .map((a) => ({ title: a.title, status: a.status, grade: a.grade, mark: markFraction(a.grade, a.maxMarks), hasGrade: shouldShowGrade(a) })),
      classwork: s.assignments
        .filter((a) => a.reportGroup === "classwork")
        .map((a) => ({ title: a.title, status: a.status, grade: a.grade, mark: markFraction(a.grade, a.maxMarks), hasGrade: shouldShowGrade(a) })),
      quizzes: s.assignments
        .filter((a) => a.reportGroup === "quiz")
        .map((a) => ({ title: a.title, status: a.status, grade: a.grade, mark: markFraction(a.grade, a.maxMarks) })),
      mockExams: s.assignments
        .filter((a) => a.reportGroup === "mock_exam")
        .map((a) => ({ title: a.title, status: a.status, grade: a.grade, mark: markFraction(a.grade, a.maxMarks) })),
      other: s.assignments
        .filter((a) => !a.reportGroup || a.reportGroup === "other")
        .map((a) => ({ title: a.title, status: a.status, grade: a.grade })),
      performanceComment: s.assistantComment,
      averageGrade: formatGradeByScale(s.avgGrade, meta.gradeScale),
      weakTopics: s.weakTopics.map((t) => ({
        label: t.label,
        notes: t.materials.filter((m) => m.kind === "notes").map((m) => ({ label: m.label, link: m.link })),
        trickyQuestions: t.materials.filter((m) => m.kind === "tricky_question").map((m) => ({ label: m.label, link: m.link })),
        videos: t.materials.filter((m) => m.kind === "video").map((m) => ({ label: m.label, link: m.link, duration: m.duration })),
      })),
    })),
  };

  const { results } = await callDriveBridge<{ results: DriveDeliveryResult[] }>("generateReportsBatch", payload);

  await Promise.all(
    results.map((r) => {
      if (!r.ok) return Promise.resolve();
      return Promise.all([
        r.folderUrl ? supabase.from("students").update({ drive_folder_link: r.folderUrl }).eq("id", r.studentId) : Promise.resolve(),
        supabase.from("monthly_report_students").update({ delivered_at: new Date().toISOString() }).eq("generation_id", meta.id).eq("student_id", r.studentId),
      ]);
    })
  );

  return results;
}
