import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import { getGeneratedReport, getMyGeneratedReport } from "@/lib/actions/academic-report";
import { getOfferingCourse } from "@/lib/actions/weak-topics";
import { getOrgBrandName } from "@/lib/actions/templates";
import { getBranding } from "@/lib/actions/branding";
import { getReportSettings } from "@/lib/actions/report-settings";
import { PrintReportView } from "@/components/academic-report/print-report-view";

type SearchParams = Promise<{ offeringId?: string; period?: string; studentId?: string; action?: string }>;

export default async function ReportPrintPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "head" && profile.role !== "admin" && profile.role !== "assistant") redirect("/dashboard");

  const { offeringId, period, studentId, action } = await searchParams;
  if (!offeringId || !period) {
    return <div className="p-10 text-[14px] text-[var(--muted)]">Missing report reference.</div>;
  }

  // Assistants only ever see their own students here, even if a studentId
  // for someone else's student is typed into the URL directly — head/admin
  // already see every student in the offering through their own flows, so
  // no extra scoping is needed for them.
  const [{ meta, students }, course, orgName, branding, reportSettings] = await Promise.all([
    profile.role === "assistant" ? getMyGeneratedReport(offeringId, period) : getGeneratedReport(offeringId, period),
    getOfferingCourse(offeringId),
    getOrgBrandName(),
    getBranding(),
    getReportSettings(),
  ]);

  const filtered = studentId ? students.filter((s) => s.studentId === studentId) : students;

  return (
    <PrintReportView
      meta={meta}
      students={filtered}
      courseName={course?.courseName ?? "Course"}
      orgName={orgName}
      logoUrl={branding?.logoUrl ?? null}
      settings={reportSettings}
      autoAction={action === "print" || action === "download" || action === "share" ? action : undefined}
    />
  );
}

export function generateMetadata() {
  return { title: "Monthly report — ZAD-AMS" };
}
