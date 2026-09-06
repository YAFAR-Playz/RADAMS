"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { SkeletonRow } from "@/components/ui/spinner";
import { toneColors } from "@/lib/tone";
import { mockKpisForRole, type Kpi, type Role, type Tone } from "@/lib/roles";
import { dashboardSubtitle, greetingFor, dateLabel } from "@/lib/dashboard-data";
import {
  getAdminDashboard,
  getAssistantDashboard,
  getHeadDashboard,
  getRegistrationDashboard,
  getFinanceDashboard,
  type AdminDashboard,
  type AssistantDashboard,
  type HeadDashboard,
  type RegistrationDashboard,
  type FinanceDashboard,
  type CourseAverageRow,
} from "@/lib/actions/dashboard";
import {
  getFinancePayrollTrend,
  getRegistrationEnrollmentTrend,
  getStaffingTrend,
  getMyRatingDistribution,
  getOrgRatingDistribution,
  type PayrollTrendPoint,
  type EnrollmentTrendPoint,
  type StaffingTrendPoint,
  type RatingSlice,
} from "@/lib/actions/dashboard-charts";
import { getHrDashboard, type HrDashboard } from "@/lib/actions/hr";
import { getOwnerDashboard, listOrgsOverview, type OrgOverview } from "@/lib/actions/owner";
import { listRecentActivityAcrossOrgs, type PlatformActivityRow } from "@/lib/actions/activity-log";
import { CATEGORY_ICON } from "@/lib/activity-categories";
import { TrendAreaChart, GroupedBarChart, RatingDonut, Sparkline } from "./charts";

function Badge({ text, tone, icon }: { text: string; tone: Tone; icon?: IconName }) {
  const { bg, fg } = toneColors(tone);
  return (
    <span
      className="inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {icon && <Icon name={icon} size={13} />}
      {text}
    </span>
  );
}

function Avatar({ initials, tone = "brand" }: { initials: string; tone?: "brand" | "neutral" }) {
  return (
    <div
      className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[12px] font-bold"
      style={
        tone === "brand"
          ? { background: "var(--brands)", color: "var(--brand)" }
          : { background: "var(--surface2)", color: "var(--muted)" }
      }
    >
      {initials}
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-[6px] overflow-hidden rounded-full bg-[var(--surface2)]">
      <div className="h-full rounded-full transition-[width]" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--border2)] px-[18px] py-[15px]">
        <div className="min-w-0">
          <h3 className="m-0 text-[14px] font-semibold text-[var(--text)]">{title}</h3>
          {subtitle && <p className="mt-[2px] mb-0 text-[12px] text-[var(--subtle)]">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function ViewAllButton({ children = "View all", href }: { children?: string; href?: string }) {
  const className = "flex flex-none items-center gap-1 whitespace-nowrap bg-none text-[12.5px] font-semibold text-[var(--brand)]";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
        <Icon name="cr" size={14} />
      </Link>
    );
  }
  return (
    <button className={className}>
      {children}
      <Icon name="cr" size={14} />
    </button>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div className="p-[28px_18px] text-center text-[13px] text-[var(--muted)]">{children}</div>;
}

function KpiRow({ kpis }: { kpis: Kpi[] | null }) {
  if (!kpis) {
    return (
      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonRow key={i} className="h-[92px]" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
      {kpis.map((k) => {
        const { bg, fg } = toneColors(k.tone);
        const deltaUp = k.dir === "up";
        const deltaColor = deltaUp ? "var(--ok)" : "var(--danger)";
        return (
          <div
            key={k.label}
            className="flex flex-col gap-[11px] rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] p-[15px] pb-[14px] shadow-[var(--shadow)]"
          >
            <div className="flex items-center justify-between">
              <div
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px]"
                style={{ background: bg, color: fg }}
              >
                <Icon name={k.icon} size={18} />
              </div>
              {k.delta && (
                <span
                  className="inline-flex items-center gap-[2px] text-[12px] font-bold"
                  style={{ color: deltaColor }}
                >
                  <Icon name={deltaUp ? "arrow-up" : "arrow-down"} size={13} />
                  {k.delta}
                </span>
              )}
            </div>
            <div>
              <div className="text-[25px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--text)]">
                {k.value}
              </div>
              <div className="mt-[2px] text-[12.5px] font-medium text-[var(--muted)]">{k.label}</div>
            </div>
            {k.trend && k.trend.length > 1 && (
              <div className="-mx-[3px] -mb-[3px]">
                <Sparkline data={k.trend} color={fg} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <>
      <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] p-[18px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonRow key={i} className="h-[48px]" />
          ))}
        </div>
      </section>
      <section className="overflow-hidden rounded-[var(--rad)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] p-[18px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonRow key={i} className="h-[48px]" />
          ))}
        </div>
      </section>
    </>
  );
}

function HeadPanels({ data }: { data: HeadDashboard }) {
  return (
    <>
      <Card
        title="Assistant message completion"
        subtitle={data.offeringLabel ? `${data.offeringLabel} — messages sent vs pending` : "No course assigned yet"}
        action={<ViewAllButton href="/oversight" />}
      >
        <div className="px-2 py-[7px]">
          {data.assistants.length === 0 ? (
            <EmptyRow>No assistants on this course yet.</EmptyRow>
          ) : (
            data.assistants.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                <Avatar initials={a.initials} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-[var(--text)]">{a.name}</span>
                    <span className="text-[12px] font-medium text-[var(--muted)]">
                      {a.sent}/{a.total}
                    </span>
                  </div>
                  <div className="mt-[7px]">
                    <ProgressBar pct={a.pct} color={toneColors(a.badge.tone).fg} />
                  </div>
                </div>
                <Badge text={a.badge.text} tone={a.badge.tone} icon={a.badge.icon} />
              </div>
            ))
          )}
        </div>
      </Card>
      <Card title="Course completion">
        <div className="p-[18px]">
          <div className="mb-[6px] flex items-end gap-2">
            <span className="text-[34px] font-bold leading-none tracking-[-0.02em] text-[var(--text)]">
              {data.completionPct}%
            </span>
            <span className="mb-[6px] text-[12.5px] font-semibold text-[var(--ok)]">across your courses</span>
          </div>
          <div className="mb-[18px] h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
            <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: `${data.completionPct}%` }} />
          </div>
          {data.statusBreakdown.length === 0 ? (
            <EmptyRow>No course offerings yet.</EmptyRow>
          ) : (
            data.statusBreakdown.map((b) => (
              <div key={b.label} className="flex items-center gap-[9px] py-[7px]">
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: toneColors(b.tone).fg }} />
                <span className="flex-1 text-[13px] text-[var(--muted)]">{b.label}</span>
                <span className="text-[13px] font-bold text-[var(--text)]">{b.count}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}

function AssistantPanels({ data }: { data: AssistantDashboard }) {
  return (
    <>
      <Card
        title="Pending assignments today"
        subtitle={`${data.pendingStudents.length ? data.pendingStudents.length + "+" : "0"} students awaiting an assignment status`}
        action={
          <Link
            href="/assignments"
            className="flex flex-none items-center gap-[6px] whitespace-nowrap rounded-[var(--rad-sm)] bg-[var(--brand)] px-[13px] py-2 text-[12.5px] font-semibold text-[var(--brandfg)]"
          >
            <Icon name="clipboard-list" size={15} />
            Open assignments
          </Link>
        }
      >
        <div className="px-2 py-[7px]">
          {data.pendingStudents.length === 0 ? (
            <EmptyRow>Nothing pending — you&apos;re all caught up.</EmptyRow>
          ) : (
            data.pendingStudents.map((p) => (
              <div key={p.name + p.offering} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                <Avatar initials={p.initials} tone="neutral" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{p.name}</div>
                  <div className="text-[12px] text-[var(--subtle)]">{p.offering}</div>
                </div>
                <Badge text={p.badge.text} tone={p.badge.tone} icon={p.badge.icon} />
              </div>
            ))
          )}
        </div>
      </Card>
      <Card title="My courses">
        <div className="px-2 py-[7px]">
          {data.myOfferings.length === 0 ? (
            <EmptyRow>No courses assigned yet.</EmptyRow>
          ) : (
            data.myOfferings.map((o) => (
              <div key={o.id} className="flex items-center gap-[11px] p-[11px]">
                <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
                  <Icon name="grad" size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--text)]">{o.label}</div>
                  <div className="text-[11.5px] text-[var(--subtle)]">{o.students} students</div>
                </div>
                <span className="text-[12.5px] font-bold text-[var(--text)]">{o.pending}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}

const METHOD_COLORS = ["var(--brand)", "var(--info)", "var(--subtle)", "var(--ok)", "var(--warn)"];

function FinancePanels({ data }: { data: FinanceDashboard }) {
  return (
    <>
      <Card title="Salary overview" action={<ViewAllButton href="/salaries">View payroll</ViewAllButton>}>
        <div className="px-2 py-[7px]">
          {data.salaryOverview.length === 0 ? (
            <EmptyRow>No salary lines for this period yet.</EmptyRow>
          ) : (
            data.salaryOverview.map((r) => (
              <div key={r.name} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
                <Avatar initials={r.initials} tone="neutral" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{r.name}</div>
                  <div className="text-[12px] text-[var(--subtle)]">{r.offering}</div>
                </div>
                <span className="flex-none text-[14px] font-bold text-[var(--text)]">{data.currencySymbol}{r.amount.toLocaleString()}</span>
                <div className="w-[78px] flex-none">
                  <Badge
                    text={r.status === "paid" ? "Paid" : "Pending"}
                    tone={r.status === "paid" ? "ok" : "warn"}
                    icon={r.status === "paid" ? "check" : "clock"}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      <Card title="Payment methods">
        <div className="p-[18px]">
          {data.paymentMethods.length === 0 ? (
            <EmptyRow>No salary lines for this period yet.</EmptyRow>
          ) : (
            data.paymentMethods.map((m, i) => (
              <div key={m.label} className="mb-[15px] last:mb-0">
                <div className="mb-[7px] flex justify-between">
                  <span className="text-[13px] font-medium text-[var(--text)]">{m.label}</span>
                  <span className="text-[13px] font-semibold text-[var(--muted)]">{m.pct}%</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-[var(--surface2)]">
                  <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      <div className="lg:col-span-2">
        <SalaryByCourseCard rows={data.salaryByCourse} sym={data.currencySymbol} />
      </div>
    </>
  );
}

function HrPanels({ data }: { data: HrDashboard }) {
  return (
    <>
      <Card title="Pending staffing requests" subtitle="Submitted by course heads" action={<ViewAllButton href="/requests">View all</ViewAllButton>}>
        <div className="px-2 py-[7px]">
          {data.pendingRequests.length === 0 ? (
            <EmptyRow>No pending requests.</EmptyRow>
          ) : (
            data.pendingRequests.map((r) => {
              const name = r.candidateName ?? r.targetName ?? "—";
              return (
                <Link
                  key={r.id}
                  href="/requests"
                  className="flex flex-wrap items-center gap-[10px] rounded-[10px] p-[11px] hover:bg-[var(--surface2)]"
                >
                  <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                    {name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-[130px] flex-1">
                    <div className="text-[13.5px] font-semibold text-[var(--text)]">{name}</div>
                    <div className="text-[12px] text-[var(--subtle)]">{r.offeringLabel}</div>
                    <div className="mt-[1px] text-[11.5px] text-[var(--subtle)]">by {r.requestedByName ?? "—"}</div>
                  </div>
                  <Badge text="Pending" tone="warn" icon="clock" />
                </Link>
              );
            })
          )}
        </div>
      </Card>
      <StaffByRoleCard rows={data.staffByRole} />
    </>
  );
}

function StaffByRoleCard({ rows }: { rows: HrDashboard["staffByRole"] }) {
  return (
    <Card title="Staff by role">
      <div className="p-[18px]">
        {rows.length === 0 ? (
          <EmptyRow>No staff yet.</EmptyRow>
        ) : (
          rows.map((s) => (
            <div key={s.role} className="mb-[14px] last:mb-0">
              <div className="mb-[6px] flex justify-between">
                <span className="text-[13px] font-medium text-[var(--text)]">{s.role}</span>
                <span className="text-[13px] font-semibold text-[var(--muted)]">{s.n}</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-[var(--surface2)]">
                <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: s.barW }} />
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ActivityCard({ rows }: { rows: PlatformActivityRow[] }) {
  return (
    <Card title="Recent activity" subtitle="Across every organization">
      <div className="px-2 py-[7px]">
        {rows.length === 0 ? (
          <EmptyRow>No recent activity.</EmptyRow>
        ) : (
          rows.map((a) => (
            <div key={a.id} className="flex gap-[11px] p-[10px_11px]">
              <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] bg-[var(--surface2)] text-[var(--muted)]">
                <Icon name={CATEGORY_ICON[a.category]} size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] leading-[1.35] text-[var(--text)]">{a.summary}</div>
                <div className="mt-[2px] text-[11.5px] text-[var(--subtle)]">
                  {a.orgName} · {a.actorName} · {timeAgo(a.createdAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function OwnerPanels({ orgs, activity }: { orgs: OrgOverview[]; activity: PlatformActivityRow[] }) {
  return (
    <>
      <Card title="Organizations" action={<ViewAllButton href="/orgs">Manage</ViewAllButton>}>
        <div className="px-2 py-[7px]">
          {orgs.length === 0 ? (
            <EmptyRow>No organizations yet.</EmptyRow>
          ) : (
            orgs.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-[10px] p-[11px] hover:bg-[var(--surface2)]">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[var(--surface2)] text-[var(--muted)]">
                  <Icon name="building" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{o.name}</div>
                  <div className="text-[12px] text-[var(--subtle)]">
                    {o.metrics.students} students · {o.metrics.courses} courses
                  </div>
                </div>
                <Badge
                  text={o.status === "active" ? "Active" : o.status === "trial" ? "Trial" : "Suspended"}
                  tone={o.status === "active" ? "ok" : o.status === "trial" ? "info" : "danger"}
                />
              </div>
            ))
          )}
        </div>
      </Card>
      <ActivityCard rows={activity} />
    </>
  );
}

// Shared by Admin and Finance — lets either role flip between "which
// courses pay the most per person on average" and "which courses have the
// most people actually getting paid," rather than only ever showing one
// fixed view of the same per-course breakdown.
function SalaryByCourseCard({ rows, sym }: { rows: CourseAverageRow[]; sym: string }) {
  const [mode, setMode] = useState<"average" | "count">("average");
  const sorted = [...rows].sort((a, b) => (mode === "average" ? b.average - a.average : b.count - a.count));
  const max = Math.max(1, ...sorted.map((r) => (mode === "average" ? r.average : r.count)));

  return (
    <Card
      title="Salaries by course"
      subtitle="Last completed payroll period"
      action={
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as "average" | "count")}
          className="cursor-pointer appearance-none rounded-[7px] border border-[var(--border)] bg-[var(--surface2)] px-[10px] py-[6px] text-[12px] font-semibold text-[var(--text)] outline-none"
        >
          <option value="average">Average per person</option>
          <option value="count">Staff paid</option>
        </select>
      }
    >
      <div className="p-[18px]">
        {sorted.length === 0 ? (
          <EmptyRow>No paid salary lines for this period yet.</EmptyRow>
        ) : (
          sorted.map((r) => {
            const value = mode === "average" ? r.average : r.count;
            const barPct = Math.round((value / max) * 100);
            return (
              <div key={r.label} className="mb-[14px] last:mb-0">
                <div className="mb-[6px] flex justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text)]">{r.label}</span>
                  <span className="flex-none text-[13px] font-semibold text-[var(--muted)]">
                    {mode === "average" ? `${sym}${value.toLocaleString()}` : value}
                  </span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-[var(--surface2)]">
                  <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function AdminPanels({ data }: { data: AdminDashboard }) {
  return (
    <>
      <Card title="Offerings overview" action={<ViewAllButton href="/courses">Manage</ViewAllButton>}>
        <div className="px-2 py-[7px]">
          {data.offerings.length === 0 ? (
            <EmptyRow>No course offerings yet.</EmptyRow>
          ) : (
            data.offerings.map((o) => (
              <div key={o.id} className="flex items-center gap-3 rounded-[10px] p-[11px] hover:bg-[var(--surface2)]">
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[var(--surface2)] text-[var(--muted)]">
                  <Icon name="book" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{o.label}</div>
                  <div className="text-[12px] text-[var(--subtle)]">{o.students} students</div>
                </div>
                <span className="text-[12.5px] font-bold text-[var(--text)]">{o.pending}</span>
              </div>
            ))
          )}
        </div>
      </Card>
      <Card title="Staff by role">
        <div className="p-[18px]">
          {data.staffByRole.length === 0 ? (
            <EmptyRow>No staff yet.</EmptyRow>
          ) : (
            data.staffByRole.map((s) => (
              <div key={s.label} className="mb-[14px] last:mb-0">
                <div className="mb-[6px] flex justify-between">
                  <span className="text-[13px] font-medium text-[var(--text)]">{s.label}</span>
                  <span className="text-[13px] font-semibold text-[var(--muted)]">{s.n}</span>
                </div>
                <div className="h-[7px] overflow-hidden rounded-full bg-[var(--surface2)]">
                  <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: `${s.barWPct}%` }} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      <div className="lg:col-span-2">
        <SalaryByCourseCard rows={data.salaryByCourse} sym={data.currencySymbol} />
      </div>
    </>
  );
}

function RegistrationPanels({ data }: { data: RegistrationDashboard }) {
  return (
    <>
      <Card
        title="Recent enrollments"
        action={
          <Link
            href="/import"
            className="flex flex-none items-center gap-[6px] whitespace-nowrap rounded-[var(--rad-sm)] bg-[var(--brand)] px-[13px] py-2 text-[12.5px] font-semibold text-[var(--brandfg)]"
          >
            <Icon name="file-up" size={15} />
            Import
          </Link>
        }
      >
        <div className="px-2 py-[7px]">
          {data.recentEnrollments.length === 0 ? (
            <EmptyRow>No enrollments yet.</EmptyRow>
          ) : (
            data.recentEnrollments.map((r, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[10px] p-[11px] hover:bg-[var(--surface2)]">
                <Avatar initials={r.initials} tone="neutral" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-[var(--text)]">{r.name}</div>
                  <div className="text-[12px] text-[var(--subtle)]">{r.offering}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
      <Card
        title="Unassigned students"
        action={
          <Link href="/students" className="flex flex-none items-center gap-1 whitespace-nowrap bg-none text-[12.5px] font-semibold text-[var(--brand)]">
            View all
            <Icon name="cr" size={14} />
          </Link>
        }
      >
        <div className="p-[9px_10px]">
          {data.unassigned.length === 0 ? (
            <EmptyRow>Everyone has an assistant.</EmptyRow>
          ) : (
            data.unassigned.map((u) => (
              <div key={u.offering} className="mb-[6px] flex items-center gap-[10px] rounded-[9px] bg-[var(--warns)] p-[9px_10px] last:mb-0">
                <span className="flex-none font-mono text-[12px] font-bold text-[var(--warn)]">{u.count}</span>
                <span className="flex-1 text-[12.5px] text-[var(--text)]">{u.offering}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}

const MOCK_DASHBOARD_ROLES = new Set<Role>([]);

export function DashboardContent({
  role,
  orgName,
  firstName,
}: {
  role: Role;
  orgName: string | null;
  firstName: string;
}) {
  const isMock = MOCK_DASHBOARD_ROLES.has(role);

  const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
  const [assistantData, setAssistantData] = useState<AssistantDashboard | null>(null);
  const [headData, setHeadData] = useState<HeadDashboard | null>(null);
  const [registrationData, setRegistrationData] = useState<RegistrationDashboard | null>(null);
  const [financeData, setFinanceData] = useState<FinanceDashboard | null>(null);
  const [hrData, setHrData] = useState<HrDashboard | null>(null);
  const [ownerKpis, setOwnerKpis] = useState<Kpi[] | null>(null);
  const [ownerOrgs, setOwnerOrgs] = useState<OrgOverview[]>([]);
  const [ownerActivity, setOwnerActivity] = useState<PlatformActivityRow[]>([]);
  const [loading, setLoading] = useState(!isMock);

  const [payrollTrend, setPayrollTrend] = useState<{ points: PayrollTrendPoint[]; currencySymbol: string } | null>(null);
  const [enrollmentTrend, setEnrollmentTrend] = useState<EnrollmentTrendPoint[] | null>(null);
  const [staffingTrend, setStaffingTrend] = useState<StaffingTrendPoint[] | null>(null);
  const [ratingDistribution, setRatingDistribution] = useState<RatingSlice[] | null>(null);

  useEffect(() => {
    (async () => {
      if (isMock) return;
      setLoading(true);
      if (role === "admin") {
        const [dash, staffing] = await Promise.all([getAdminDashboard(), getStaffingTrend()]);
        setAdminData(dash);
        setStaffingTrend(staffing);
      } else if (role === "assistant") setAssistantData(await getAssistantDashboard());
      else if (role === "head") {
        const [dash, ratings] = await Promise.all([getHeadDashboard(), getMyRatingDistribution()]);
        setHeadData(dash);
        setRatingDistribution(ratings);
      } else if (role === "registration") {
        const [dash, trend] = await Promise.all([getRegistrationDashboard(), getRegistrationEnrollmentTrend()]);
        setRegistrationData(dash);
        setEnrollmentTrend(trend);
      } else if (role === "finance") {
        const [dash, trend, ratings] = await Promise.all([getFinanceDashboard(), getFinancePayrollTrend(), getOrgRatingDistribution()]);
        setFinanceData(dash);
        setPayrollTrend(trend);
        setRatingDistribution(ratings);
      } else if (role === "hr") {
        // No ratings chart here — evaluations' RLS never grants HR read
        // access at all (only head-own, admin, finance, owner), so
        // getOrgRatingDistribution would always come back empty for HR.
        // That would render as "no ratings exist," which is misleading —
        // real ratings exist, HR just can't see them under current policy.
        const [dash, staffing] = await Promise.all([getHrDashboard(), getStaffingTrend()]);
        setHrData(dash);
        setStaffingTrend(staffing);
      } else if (role === "owner") {
        const [dash, orgs, activity] = await Promise.all([getOwnerDashboard(), listOrgsOverview(), listRecentActivityAcrossOrgs()]);
        setOwnerKpis(dash.kpis);
        setOwnerOrgs(orgs);
        setOwnerActivity(activity);
      }
      setLoading(false);
    })();
  }, [role, isMock]);

  const kpis: Kpi[] | null = isMock
    ? mockKpisForRole(role)
    : role === "admin"
      ? adminData?.kpis ?? null
      : role === "assistant"
        ? assistantData?.kpis ?? null
        : role === "head"
          ? headData?.kpis ?? null
          : role === "registration"
            ? registrationData?.kpis ?? null
            : role === "finance"
              ? financeData?.kpis ?? null
              : role === "hr"
                ? hrData?.kpis ?? null
                : role === "owner"
                  ? ownerKpis
                  : null;

  return (
    <div className="flex flex-col">
      <div className="mb-[18px]">
        <div className="text-[12.5px] font-semibold uppercase tracking-[0.01em] text-[var(--subtle)]">
          {dateLabel()}
        </div>
        <h1 className="m-0 mt-[3px] mb-1 text-[23px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          {greetingFor(firstName)}
        </h1>
        <p className="m-0 text-[14px] text-[var(--muted)]">{dashboardSubtitle(role, orgName)}</p>
      </div>

      <KpiRow kpis={kpis} />

      <div className="mt-[18px] grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
        {role === "owner" && (loading ? <PanelSkeleton /> : <OwnerPanels orgs={ownerOrgs} activity={ownerActivity} />)}
        {role === "admin" && (loading || !adminData ? <PanelSkeleton /> : <AdminPanels data={adminData} />)}
        {role === "hr" && (loading || !hrData ? <PanelSkeleton /> : <HrPanels data={hrData} />)}
        {role === "head" && (loading || !headData ? <PanelSkeleton /> : <HeadPanels data={headData} />)}
        {role === "assistant" && (loading || !assistantData ? <PanelSkeleton /> : <AssistantPanels data={assistantData} />)}
        {role === "registration" && (loading || !registrationData ? <PanelSkeleton /> : <RegistrationPanels data={registrationData} />)}
        {role === "finance" && (loading || !financeData ? <PanelSkeleton /> : <FinancePanels data={financeData} />)}
      </div>

      {!loading && role === "admin" && staffingTrend && staffingTrend.some((p) => p.added || p.removed) && (
        <div className="mt-4">
          <Card title="Staffing trend" subtitle="Hires vs. departures, last 6 months">
            <div className="p-[18px]">
              <GroupedBarChart
                data={staffingTrend}
                series={[
                  { key: "added", label: "Added", color: "var(--ok)" },
                  { key: "removed", label: "Departed", color: "var(--danger)" },
                ]}
              />
            </div>
          </Card>
        </div>
      )}

      {!loading && role === "head" && ratingDistribution && ratingDistribution.length > 0 && (
        <div className="mt-4">
          <Card title="Evaluation ratings" subtitle="Every rating you've given, all-time">
            <div className="p-[18px]">
              <RatingDonut data={ratingDistribution} />
            </div>
          </Card>
        </div>
      )}

      {!loading && role === "registration" && enrollmentTrend && (
        <div className="mt-4">
          <Card title="Enrollment trend" subtitle="New students per day, last 14 days">
            <div className="p-[18px]">
              <TrendAreaChart data={enrollmentTrend.map((p) => ({ label: p.label, value: p.count }))} color="var(--brand)" />
            </div>
          </Card>
        </div>
      )}

      {!loading && role === "finance" && (payrollTrend || ratingDistribution) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {payrollTrend && (
            <Card title="Payroll over time" subtitle="Total payout per month">
              <div className="p-[18px]">
                <TrendAreaChart
                  data={payrollTrend.points.map((p) => ({ label: p.label, value: p.total }))}
                  color="var(--brand)"
                  valueFormatter={(v) => `${payrollTrend.currencySymbol}${Math.round(v / 1000)}k`}
                />
              </div>
            </Card>
          )}
          {ratingDistribution && ratingDistribution.length > 0 && (
            <Card title="Evaluation ratings" subtitle="Org-wide, all heads">
              <div className="p-[18px]">
                <RatingDonut data={ratingDistribution} />
              </div>
            </Card>
          )}
        </div>
      )}

      {!loading && role === "hr" && staffingTrend && staffingTrend.some((p) => p.added || p.removed) && (
        <div className="mt-4">
          <Card title="Staffing trend" subtitle="Hires vs. departures, last 6 months">
            <div className="p-[18px]">
              <GroupedBarChart
                data={staffingTrend}
                series={[
                  { key: "added", label: "Added", color: "var(--ok)" },
                  { key: "removed", label: "Departed", color: "var(--danger)" },
                ]}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
