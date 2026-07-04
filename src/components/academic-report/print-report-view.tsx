"use client";

import { formatGradeByScale } from "@/lib/grade-scale";
import type { GeneratedReportMeta, GeneratedStudentReport } from "@/lib/actions/academic-report";

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function PrintReportView({
  meta,
  students,
  courseName,
  orgName,
}: {
  meta: GeneratedReportMeta | null;
  students: GeneratedStudentReport[];
  courseName: string;
  orgName: string;
}) {
  if (!meta) {
    return <div className="p-10 text-[14px] text-[#666]">No report has been generated for this month yet.</div>;
  }

  return (
    <div className="mx-auto max-w-[820px] p-8 text-[#111] print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-page { break-after: page; }
          .report-page:last-child { break-after: auto; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between rounded-[10px] border border-[#ddd] bg-[#f7f7f8] p-4">
        <div className="text-[13px] text-[#555]">
          {students.length} student report{students.length === 1 ? "" : "s"} · {periodLabel(meta.period)}
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-[8px] bg-[#2563eb] px-4 py-2 text-[13px] font-semibold text-white"
        >
          Print / Save as PDF
        </button>
      </div>

      {students.length === 0 ? (
        <div className="text-[14px] text-[#666]">No student found for this report.</div>
      ) : (
        students.map((s) => (
          <div key={s.studentId} className="report-page mb-10 border-b border-[#eee] pb-8">
            <div className="mb-5 flex items-start justify-between border-b-2 border-[#111] pb-3">
              <div>
                <div className="text-[19px] font-bold">{orgName}</div>
                <div className="text-[13px] text-[#555]">{courseName} · Monthly report</div>
              </div>
              <div className="text-right text-[13px] text-[#555]">
                <div>{periodLabel(meta.period)}</div>
                <div>Generated {new Date(meta.createdAt).toLocaleDateString()}</div>
              </div>
            </div>

            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-[17px] font-semibold">{s.studentName}</div>
                <div className="text-[12px] text-[#777]">#{s.studentCode}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-[#777]">Average grade</div>
                <div className="text-[22px] font-bold">{formatGradeByScale(s.avgGrade, meta.gradeScale)}</div>
              </div>
            </div>

            <div className="mb-5">
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#555]">Assignments</div>
              {s.assignments.length === 0 ? (
                <div className="text-[13px] text-[#777]">No assignments included in this report.</div>
              ) : (
                <table className="w-full border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b border-[#ccc] text-left text-[#555]">
                      <th className="py-[6px] pr-2">Assignment</th>
                      <th className="py-[6px] pr-2">Status</th>
                      <th className="py-[6px] pr-2">Grade</th>
                      <th className="py-[6px]">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.assignments.map((a, i) => (
                      <tr key={i} className="border-b border-[#eee]">
                        <td className="py-[6px] pr-2 font-medium">{a.title}</td>
                        <td className="py-[6px] pr-2 capitalize">{a.status ?? "not logged"}</td>
                        <td className="py-[6px] pr-2">{a.grade ?? "—"}</td>
                        <td className="py-[6px] text-[#555]">{a.comment ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mb-5">
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#555]">Weak topics</div>
              {s.weakTopics.length === 0 ? (
                <div className="text-[13px] text-[#777]">None flagged this month.</div>
              ) : (
                <ul className="list-disc pl-5 text-[13px]">
                  {s.weakTopics.map((t, i) => (
                    <li key={i} className="mb-1">
                      <span className="font-medium">{t.label}</span>
                      {t.materials.length > 0 && (
                        <span className="text-[#555]">
                          {" — "}
                          {t.materials.map((m) => `${m.label?.trim() || (m.kind === "video" ? "Video" : "Document")}${m.duration ? ` (${m.duration})` : ""}`).join(", ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#555]">Assistant&apos;s comment</div>
              <div className="text-[13px] leading-[1.5]">{s.assistantComment || <span className="text-[#777]">No comment left.</span>}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
