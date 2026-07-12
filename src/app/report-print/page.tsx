import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import { getGeneratedReport } from "@/lib/actions/academic-report";
import { getOfferingCourse } from "@/lib/actions/weak-topics";
import { getOrgBrandName } from "@/lib/actions/templates";
import { getBranding } from "@/lib/actions/branding";
import { getReportSettings } from "@/lib/actions/report-settings";
import { PrintReportView } from "@/components/academic-report/print-report-view";

type SearchParams = Promise<{ offeringId?: string; period?: string; studentId?: string }>;

export default async function ReportPrintPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { offeringId, period, studentId } = await searchParams;
  if (!offeringId || !period) {
    return <div className="p-10 text-[14px] text-[var(--muted)]">Missing report reference.</div>;
  }

  const [{ meta, students }, course, orgName, branding, reportSettings] = await Promise.all([
    getGeneratedReport(offeringId, period),
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
    />
  );
}

export function generateMetadata() {
  return { title: "Monthly report — ZAD-AMS" };
}
