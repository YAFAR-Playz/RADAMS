import type { ReportAssignmentDetail } from "@/lib/actions/academic-report";

// Single source of truth for "does this assignment get a grade row" —
// shared by the in-app print view and the Drive PDF export (drive.ts) so
// the two renderings can't drift apart on which assignments show a grade.
// Falls back to the pre-hasGrade heuristic (only quiz/mock_exam graded) for
// reports generated before this field existed.
//
// Lives outside academic-report.ts (a "use server" file, where every export
// must be an async Server Action) since this is a plain synchronous helper.
export function shouldShowGrade(a: Pick<ReportAssignmentDetail, "hasGrade" | "reportGroup">): boolean {
  return a.hasGrade ?? (a.reportGroup === "quiz" || a.reportGroup === "mock_exam");
}
