"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { getGeneratedReport } from "@/lib/actions/academic-report";
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

export type DriveDeliveryResult = { studentId: string; ok: boolean; folderUrl?: string; fileUrl?: string; error?: string };

// Delivers every student's already-generated monthly report (same data the
// on-screen/print view uses — no duplicated logic) into their Drive folder
// as a branded PDF, creating any missing folder in the Org > Course >
// Assistant > Student hierarchy along the way, and keeps each student's
// drive_folder_link in sync so it's always ready to hand to a parent.
export async function deliverGeneratedReportsToDrive(offeringId: string, period: string): Promise<DriveDeliveryResult[]> {
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
  const monthLabel = periodLabel(period);

  const payload = {
    rootFolderId: DRIVE_ROOT_FOLDER_ID,
    orgName: branding?.name ?? profile.org.name ?? "RadAMS",
    courseLabel,
    monthLabel,
    primaryColor: branding?.primary ?? "#2563eb",
    logoUrl: branding?.logoUrl ?? null,
    students: students.map((s) => ({
      studentId: s.studentId,
      studentCode: s.studentCode,
      studentName: s.studentName,
      assistantName: s.assistantName ?? "Unassigned",
      homeworks: s.assignments.filter((a) => a.reportGroup === "homework").map((a) => ({ title: a.title, status: a.status })),
      quizzes: s.assignments
        .filter((a) => a.reportGroup === "quiz")
        .map((a) => ({ title: a.title, status: a.status, grade: a.grade, mark: markFraction(a.grade, a.maxMarks) })),
      other: s.assignments
        .filter((a) => !a.reportGroup || a.reportGroup === "other")
        .map((a) => ({ title: a.title, status: a.status, grade: a.grade })),
      performanceComment: s.assistantComment,
      averageGrade: formatGradeByScale(s.avgGrade, meta.gradeScale),
    })),
  };

  const { results } = await callDriveBridge<{ results: { studentId: string; ok: boolean; folderUrl?: string; fileUrl?: string; error?: string }[] }>(
    "generateReportsBatch",
    payload
  );

  await Promise.all(
    results.map((r) => (r.ok && r.folderUrl ? supabase.from("students").update({ drive_folder_link: r.folderUrl }).eq("id", r.studentId) : Promise.resolve()))
  );

  return results;
}
