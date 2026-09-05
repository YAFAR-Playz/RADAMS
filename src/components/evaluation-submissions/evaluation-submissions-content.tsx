"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import {
  listEvaluationPeriods,
  listEvaluationSubmissions,
  type EvaluationSubmission,
} from "@/lib/actions/evaluations";
import { listAllOfferingsForOrg, type OfferingChoice } from "@/lib/actions/students";
import { listStaffForCalcMethod } from "@/lib/actions/staff-payments";
import { getPayrollSettings } from "@/lib/actions/payroll-settings";
import { currencySymbol } from "@/lib/currency";

const RATING_LABEL: Record<string, string> = { outstanding: "Outstanding", exceeds: "Exceeds", meets: "Meets", below: "Below" };
const RATING_TONE: Record<string, { bg: string; fg: string }> = {
  outstanding: { bg: "var(--brands)", fg: "var(--brand)" },
  exceeds: { bg: "var(--oks)", fg: "var(--ok)" },
  meets: { bg: "var(--infos)", fg: "var(--info)" },
  below: { bg: "var(--warns)", fg: "var(--warn)" },
};

function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className="text-[12px] text-[var(--subtle)]">No rating</span>;
  const { bg, fg } = RATING_TONE[rating] ?? { bg: "var(--surface2)", fg: "var(--muted)" };
  return (
    <span className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold" style={{ background: bg, color: fg }}>
      {RATING_LABEL[rating] ?? rating}
    </span>
  );
}

export function EvaluationSubmissionsContent() {
  const [periods, setPeriods] = useState<string[] | null>(null);
  const [offerings, setOfferings] = useState<OfferingChoice[] | null>(null);
  const [assistants, setAssistants] = useState<{ id: string; name: string }[] | null>(null);
  const [currencySym, setCurrencySym] = useState("£");

  const [period, setPeriod] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [assistantId, setAssistantId] = useState("");

  const [rows, setRows] = useState<EvaluationSubmission[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEvaluationPeriods().then((p) => {
      setPeriods(p);
      if (p.length) setPeriod(p[0]);
    });
    listAllOfferingsForOrg().then(setOfferings);
    listStaffForCalcMethod().then((staff) => setAssistants(staff.filter((s) => s.role === "assistant").map((s) => ({ id: s.id, name: s.name }))));
    getPayrollSettings().then((s) => s && setCurrencySym(currencySymbol(s.currency)));
  }, []);

  useEffect(() => {
    // The default period is only known once listEvaluationPeriods resolves
    // (a separate effect above), so this effect necessarily fires once for
    // period="" and again once the real default is set. Without this guard,
    // whichever fetch happens to resolve LAST wins — if the unfiltered "" one
    // resolves after the filtered one, it silently overwrites correct
    // filtered rows with every period mixed together.
    let cancelled = false;
    (async () => {
      setRows(null);
      setError(null);
      try {
        const data = await listEvaluationSubmissions({
          period: period || undefined,
          offeringId: offeringId || undefined,
          assistantId: assistantId || undefined,
        });
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setError("Couldn't load evaluation submissions — try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, offeringId, assistantId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[17px_18px] shadow-[var(--shadow)]">
        <div className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--subtle)]">Read-only</div>
        <h1 className="m-0 mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">Evaluation submissions</h1>
        <p className="m-0 mt-[3px] max-w-[620px] text-[13px] leading-[1.5] text-[var(--muted)]">
          Every evaluation a Head has submitted, by month, course and assistant — extras, deductions, rating and notes exactly as
          submitted. To edit a payable amount, use Salaries instead.
        </p>
      </div>

      <div className="flex flex-wrap gap-[10px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[13px] shadow-[var(--shadow)]">
        <div className="flex h-9 min-w-[140px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
          >
            <option value="">All months</option>
            {(periods ?? []).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex h-9 min-w-[180px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
          <select
            value={offeringId}
            onChange={(e) => setOfferingId(e.target.value)}
            className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
          >
            <option value="">All courses</option>
            {(offerings ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex h-9 min-w-[160px] flex-1 items-center rounded-[8px] border border-[var(--border)] bg-[var(--surface2)] px-[10px]">
          <select
            value={assistantId}
            onChange={(e) => setAssistantId(e.target.value)}
            className="h-full w-full cursor-pointer appearance-none border-none bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none"
          >
            <option value="">All assistants</option>
            {(assistants ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
        {rows === null ? (
          <div className="flex flex-col gap-2 p-[14px]">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonRow key={i} className="h-[54px]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-[36px_18px] text-center text-[13px] text-[var(--muted)]">No evaluations match these filters.</div>
        ) : (
          rows.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="border-b border-[var(--border2)] last:border-b-0">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="flex w-full flex-wrap items-center gap-[10px] p-[13px_16px] text-left hover:bg-[var(--surface2)]"
                >
                  <span className="w-[70px] flex-none font-mono text-[11.5px] font-semibold text-[var(--subtle)]">{r.period}</span>
                  <div className="min-w-[140px] flex-1">
                    <div className="text-[13.5px] font-semibold text-[var(--text)]">{r.assistantName}</div>
                    <div className="text-[11.5px] text-[var(--subtle)]">{r.offeringLabel}</div>
                  </div>
                  <span className="w-[110px] flex-none text-[12px] text-[var(--muted)]">by {r.headName}</span>
                  <RatingBadge rating={r.rating} />
                  <span className="w-[70px] flex-none text-right font-mono text-[12.5px] font-bold text-[var(--ok)]">
                    {r.extraTotal > 0 ? `+${currencySym}${Math.round(r.extraTotal).toLocaleString()}` : "—"}
                  </span>
                  <span className="w-[70px] flex-none text-right font-mono text-[12.5px] font-bold text-[var(--danger)]">
                    {r.deductionTotal > 0 ? `-${currencySym}${Math.round(r.deductionTotal).toLocaleString()}` : "—"}
                  </span>
                  <Icon name="chevron-down" size={16} className="flex-none text-[var(--subtle)]" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} />
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--border2)] bg-[var(--surface2)] p-[14px_18px]">
                    {r.notes && <p className="m-0 mb-[10px] text-[13px] leading-[1.5] text-[var(--text)]">&quot;{r.notes}&quot;</p>}
                    {r.lines.length === 0 ? (
                      <p className="m-0 text-[12.5px] text-[var(--subtle)]">No extra/deduction lines on this evaluation.</p>
                    ) : (
                      <div className="flex flex-col gap-[7px]">
                        {r.lines.map((l, i) => (
                          <div key={i} className="flex items-center gap-[10px] rounded-[7px] bg-[var(--surface)] p-[9px_11px]">
                            <span
                              className="flex-none rounded-full px-[7px] py-[2px] text-[10.5px] font-bold"
                              style={l.kind === "extra" ? { background: "var(--oks)", color: "var(--ok)" } : { background: "var(--dangers)", color: "var(--danger)" }}
                            >
                              {l.kind === "extra" ? "Extra" : "Deduction"}
                            </span>
                            <span className="flex-1 text-[12.5px] text-[var(--text)]">{l.category}</span>
                            {l.note && <span className="flex-1 text-[12px] italic text-[var(--subtle)]">{l.note}</span>}
                            <span className="flex-none font-mono text-[12.5px] font-bold text-[var(--text)]">
                              {currencySym}
                              {Math.round(l.amount).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
