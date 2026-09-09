"use client";

import { startTransition, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { TabLoader } from "@/components/ui/tab-loader";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { getSystemOverview, type SystemOverview } from "@/lib/actions/owner";

const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: "var(--oks)", fg: "var(--ok)", label: "Active" },
  trial: { bg: "var(--infos)", fg: "var(--info)", label: "Trial" },
  suspended: { bg: "var(--dangers)", fg: "var(--danger)", label: "Suspended" },
};

export function OwnerSystemContent() {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await getSystemOverview();
        startTransition(() => {
          setData(result);
          setLoading(false);
        });
      } catch {
        setError("Couldn't load system overview.");
        setLoading(false);
      }
    })();
  }, []);

  if (!data) {
    return error ? (
      <div className="rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
        {error}
      </div>
    ) : (
      <TabLoader label="Loading system…" />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
          {error}
          <button onClick={() => setError(null)} className="flex-none">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}

      <PageHeader
        eyebrow="Owner · Platform"
        title="System"
        subtitle="Platform-wide composition — who's on ZAD-AMS and how organizations are doing."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Users by role">
          <div className="p-[17px_18px]">
          {loading ? (
            <SkeletonRow className="h-[140px]" />
          ) : data.usersByRole.length === 0 ? (
            <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No staff yet.</div>
          ) : (
            data.usersByRole.map((s) => (
              <div key={s.role} className="mb-[14px] last:mb-0">
                <div className="mb-[6px] flex justify-between">
                  <span className="text-[13px] font-medium text-[var(--text)]">{s.role}</span>
                  <span className="text-[13px] font-semibold text-[var(--muted)]">{s.n}</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-[var(--surface2)]">
                  <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: s.barW }} />
                </div>
              </div>
            ))
          )}
          </div>
        </SectionCard>

        <SectionCard title="Organizations by status">
          <div className="p-[17px_18px]">
          {loading ? (
            <SkeletonRow className="h-[100px]" />
          ) : data.orgsByStatus.length === 0 ? (
            <div className="p-3 text-center text-[12.5px] text-[var(--subtle)]">No organizations yet.</div>
          ) : (
            <div className="flex flex-wrap gap-[10px]">
              {data.orgsByStatus.map((s) => {
                const tone = STATUS_TONE[s.status] ?? STATUS_TONE.active;
                return (
                  <div key={s.status} className="flex flex-1 flex-col items-center gap-[6px] rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[14px]">
                    <div className="text-[22px] font-bold" style={{ color: tone.fg }}>
                      {s.n}
                    </div>
                    <span className="rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                      {tone.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Recent signups">
        <div className="p-[7px_8px]">
          {loading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 4 }, (_, i) => (
                <SkeletonRow key={i} className="h-[48px]" />
              ))}
            </div>
          ) : data.recentSignups.length === 0 ? (
            <div className="p-10 text-center text-[13.5px] text-[var(--muted)]">No signups yet.</div>
          ) : (
            data.recentSignups.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-[11px] rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] bg-[var(--surface2)] text-[var(--muted)]">
                  <Icon name="user-plus" size={16} />
                </div>
                <div className="min-w-[150px] flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{s.name}</div>
                  <div className="text-[12px] text-[var(--subtle)]">
                    {s.role} · {s.orgName}
                  </div>
                </div>
                <span className="flex-none text-[11.5px] text-[var(--subtle)]">{new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}
