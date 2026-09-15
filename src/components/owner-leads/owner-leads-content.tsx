"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { Spinner, SkeletonRow } from "@/components/ui/spinner";
import { TabLoader } from "@/components/ui/tab-loader";
import { PageHeader } from "@/components/ui/page-header";
import { listLeads, updateLeadStatus, type Lead } from "@/lib/actions/leads";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";

const STATUS_BADGE: Record<Lead["status"], { text: string; bg: string; fg: string }> = {
  new: { text: "New", bg: "var(--infos)", fg: "var(--info)" },
  contacted: { text: "Contacted", bg: "var(--oks)", fg: "var(--ok)" },
  closed: { text: "Closed", bg: "var(--surface2)", fg: "var(--muted)" },
};

const STATUS_ORDER: Lead["status"][] = ["new", "contacted", "closed"];

function buildOutreachMessage(lead: Lead, brandName: string): string {
  const parts = [
    `Hi ${lead.name}! \u{1F44B}`,
    "",
    `Thanks for your interest in ${brandName} - we'd love to help ${lead.organization} run things more smoothly.`,
    "",
    `We work with tutoring centers in ${lead.country} managing around ${lead.studentRange} students, so this should be a great fit.`,
  ];
  if (lead.message) {
    parts.push("", `You mentioned: "${lead.message}" - happy to dig into that.`);
  }
  parts.push("", "Let us know if you have any questions or would like a quick walkthrough!", "", `- The ${brandName} team`);
  return parts.join("\n");
}

export function OwnerLeadsContent() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [brandName, setBrandName] = useState("ZAD-AMS");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [data, branding] = await Promise.all([listLeads(), getPlatformDefaultBranding()]);
      setLeads(data);
      setBrandName(branding.name);
    } catch {
      setError("Couldn't load leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  async function onCycleStatus(lead: Lead) {
    const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(lead.status) + 1) % STATUS_ORDER.length];
    setBusyId(lead.id);
    try {
      await updateLeadStatus(lead.id, nextStatus);
      setLeads((prev) => (prev ? prev.map((l) => (l.id === lead.id ? { ...l, status: nextStatus } : l)) : prev));
    } catch {
      setError("Couldn't update this lead's status - try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!leads) {
    return error ? (
      <div className="rounded-[var(--rad-sm)] border border-[var(--danger)] bg-[var(--dangers)] px-4 py-3 text-[13px] font-medium text-[var(--danger)]">
        {error}
      </div>
    ) : (
      <TabLoader label="Loading leads…" />
    );
  }

  const stats = [
    { value: String(leads.length), label: "Total leads", color: "var(--text)" },
    { value: String(leads.filter((l) => l.status === "new").length), label: "New", color: "var(--info)" },
    { value: String(leads.filter((l) => l.status === "contacted").length), label: "Contacted", color: "var(--ok)" },
    { value: String(leads.filter((l) => l.status === "closed").length), label: "Closed", color: "var(--muted)" },
  ];

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

      <PageHeader eyebrow="Owner · Platform" title="Leads" subtitle="Contact requests submitted from the marketing site.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} className="h-[58px]" />)
            : stats.map((s) => (
                <div key={s.label} className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[12px_14px]">
                  <div className="text-[21px] font-bold leading-[1.1] tracking-[-0.02em]" style={{ color: s.color }}>
                    {s.value}
                  </div>
                  <div className="mt-[2px] text-[12px] font-medium text-[var(--muted)]">{s.label}</div>
                </div>
              ))}
        </div>
      </PageHeader>

      <div className="flex flex-col gap-[12px]">
        {loading ? (
          Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} className="h-[110px]" />)
        ) : leads.length === 0 ? (
          <div className="rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[13.5px] text-[var(--muted)] shadow-[var(--shadow)]">
            No leads yet - they&apos;ll show up here as soon as someone submits the contact form.
          </div>
        ) : (
          leads.map((lead) => {
            const badge = STATUS_BADGE[lead.status];
            const digits = lead.phone.replace(/[^\d]/g, "");
            const waUrl = `https://wa.me/${digits}?text=${encodeURIComponent(buildOutreachMessage(lead, brandName))}`;
            return (
              <section key={lead.id} className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border2)] p-[14px_16px]">
                  <div className="min-w-[160px] flex-[1_1_200px]">
                    <div className="text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">{lead.organization}</div>
                    <div className="text-[12px] text-[var(--subtle)]">
                      {lead.name} · {lead.email} · {lead.phone}
                    </div>
                  </div>
                  <button
                    onClick={() => onCycleStatus(lead)}
                    disabled={busyId === lead.id}
                    title="Click to advance status"
                    className="inline-flex flex-none items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11.5px] font-semibold disabled:opacity-60"
                    style={{ background: badge.bg, color: badge.fg }}
                  >
                    {busyId === lead.id ? <Spinner size={11} /> : <span className="h-[6px] w-[6px] rounded-full" style={{ background: badge.fg }} />}
                    {badge.text}
                  </button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-none items-center gap-[6px] rounded-[8px] border border-[#25D366] bg-[var(--surface)] px-[12px] py-[7px] text-[12px] font-semibold text-[#1ea952] hover:bg-[rgba(37,211,102,0.1)]"
                  >
                    <Icon name="message" size={13} />
                    Quick send
                  </a>
                </header>
                <div className="grid grid-cols-2 gap-[10px] p-[14px_16px] sm:grid-cols-4">
                  <div className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[10px_11px]">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Country</div>
                    <div className="text-[13px] font-medium text-[var(--text)]">{lead.country}</div>
                  </div>
                  <div className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[10px_11px]">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Students</div>
                    <div className="text-[13px] font-medium text-[var(--text)]">{lead.studentRange}</div>
                  </div>
                  <div className="rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[10px_11px] sm:col-span-2">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Submitted</div>
                    <div className="text-[13px] font-medium text-[var(--text)]">{new Date(lead.createdAt).toLocaleString()}</div>
                  </div>
                  {lead.message && (
                    <div className="col-span-2 rounded-[var(--rad-sm)] border border-[var(--border2)] bg-[var(--surface2)] p-[10px_11px] sm:col-span-4">
                      <div className="text-[10.5px] font-semibold uppercase tracking-[0.03em] text-[var(--subtle)]">Message</div>
                      <div className="text-[13px] font-medium text-[var(--text)]">{lead.message}</div>
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
