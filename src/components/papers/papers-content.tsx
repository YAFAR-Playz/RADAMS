"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { TabLoader } from "@/components/ui/tab-loader";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { pickerOnlyDateProps } from "@/lib/date-input";
import { getPapersCheckedReport, type PapersCheckedRow } from "@/lib/actions/finance-salaries";
import { listAllOfferingsForOrg, type OfferingChoice } from "@/lib/actions/students";

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function PapersContent() {
  const [offerings, setOfferings] = useState<OfferingChoice[] | null>(null);
  const [offeringId, setOfferingId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<PapersCheckedRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guards against a race: switching month/course twice in quick succession
  // fires two overlapping fetches, and without this an earlier, slower
  // response could land after (and overwrite) a newer one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    listAllOfferingsForOrg().then(setOfferings);
  }, []);

  // `loading` is tracked separately from `rows` so switching month/course
  // always shows a loading state even though the table keeps the previous
  // rows underneath (rather than being wiped to a skeleton) — a
  // stale-but-labeled table reads better than a flash of empty skeleton for
  // what's usually a quick refetch.
  function reload() {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    getPapersCheckedReport(period, offeringId || null)
      .then((data) => {
        if (requestIdRef.current === requestId) setRows(data);
      })
      .catch(() => {
        if (requestIdRef.current === requestId) setError("Couldn't load this report — try again.");
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }

  useEffect(() => {
    (() => reload())();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, offeringId]);

  const totalPapers = rows?.reduce((sum, r) => sum + r.papers, 0) ?? 0;
  const totalMock = rows?.reduce((sum, r) => sum + r.mockPapers, 0) ?? 0;
  const showMockColumn = totalMock > 0;

  if (offerings === null && !error) return <TabLoader label="Loading papers report…" />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Papers"
        title="Papers checked"
        subtitle={`Papers each assistant checked toward salary in ${periodLabel(period)}${offeringId ? " for the selected course" : " across every course"}.`}
        actions={
          <>
            <select
              value={offeringId}
              onChange={(e) => setOfferingId(e.target.value)}
              disabled={loading}
              className="h-10 max-w-[220px] rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none disabled:opacity-60"
            >
              <option value="">All courses</option>
              {(offerings ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="month"
              value={period}
              max={currentPeriod()}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={loading}
              {...pickerOnlyDateProps}
              className="h-10 w-[110px] cursor-pointer rounded-[var(--rad-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 text-[13px] text-[var(--text)] outline-none disabled:opacity-60"
            />
            {loading && <Spinner size={16} />}
          </>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            {loading && <Spinner size={13} />}
            {rows ? `${rows.length} assistant${rows.length === 1 ? "" : "s"} · ${totalPapers} papers checked` : "Papers checked"}
          </span>
        }
      >
        {rows === null ? (
          <div className="flex flex-col gap-2 p-[14px_18px]">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonRow key={i} className="h-[48px]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          loading ? (
            <div className="flex flex-col gap-2 p-[14px_18px]">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonRow key={i} className="h-[48px]" />
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">
              No papers checked toward salary for {periodLabel(period)}
              {offeringId ? " in this course" : ""} yet.
            </div>
          )
        ) : (
          <div className="overflow-x-auto transition-opacity" style={{ opacity: loading ? 0.5 : 1 }}>
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">
                  <th className="p-[12px_18px]">Assistant</th>
                  <th className="p-[12px_18px] text-right">Papers checked</th>
                  {showMockColumn && <th className="p-[12px_18px] text-right">Mock papers</th>}
                  <th className="p-[12px_18px] text-right">Assignments</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.assistantId} className="border-b border-[var(--border)] last:border-0">
                    <td className="p-[12px_18px] font-semibold text-[var(--text)]">{r.assistantName}</td>
                    <td className="p-[12px_18px] text-right font-mono font-semibold text-[var(--text)]">{r.papers}</td>
                    {showMockColumn && <td className="p-[12px_18px] text-right font-mono text-[var(--muted)]">{r.mockPapers}</td>}
                    <td className="p-[12px_18px] text-right text-[var(--muted)]">{r.assignmentsChecked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
