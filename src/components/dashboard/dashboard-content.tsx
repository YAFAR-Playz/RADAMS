import { Icon, type IconName } from "@/components/icons";
import { toneColors } from "@/lib/tone";
import { mockKpisForRole, type Role, type Tone } from "@/lib/roles";
import {
  HEAD_OFFERINGS,
  HEAD_ASSISTANTS,
  HEAD_STATUS_BREAKDOWN,
  PENDING_STUDENTS,
  MY_OFFERINGS,
  SALARY_ROWS,
  PAY_METHODS,
  ASSISTANT_REQUESTS,
  STAFF_BY_ROLE,
  ORGS,
  ACTIVITY,
  REG_QUEUE,
  IMPORT_ERRORS,
  dashboardSubtitle,
  greetingFor,
  dateLabel,
} from "@/lib/dashboard-data";

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
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
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

function ViewAllButton({ children = "View all" }: { children?: string }) {
  return (
    <button className="flex flex-none items-center gap-1 whitespace-nowrap bg-none text-[12.5px] font-semibold text-[var(--brand)]">
      {children}
      <Icon name="cr" size={14} />
    </button>
  );
}

function KpiRow({ role }: { role: Role }) {
  const kpis = mockKpisForRole(role);
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
          </div>
        );
      })}
    </div>
  );
}

function HeadPanels() {
  return (
    <>
      <Card title="Assistant message completion" subtitle="Physics · June · Unit 1 — Paper 3 messages sent vs pending" action={<ViewAllButton />}>
        <div className="px-2 py-[7px]">
          {HEAD_ASSISTANTS.map((a) => (
            <div key={a.name} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
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
          ))}
        </div>
      </Card>
      <Card title="Course completion">
        <div className="p-[18px]">
          <div className="mb-[6px] flex items-end gap-2">
            <span className="text-[34px] font-bold leading-none tracking-[-0.02em] text-[var(--text)]">76%</span>
            <span className="mb-[6px] text-[12.5px] font-semibold text-[var(--ok)]">on schedule</span>
          </div>
          <div className="mb-[18px] h-2 overflow-hidden rounded-full bg-[var(--surface2)]">
            <div className="h-full w-[76%] rounded-full bg-[var(--brand)]" />
          </div>
          {HEAD_STATUS_BREAKDOWN.map((b) => (
            <div key={b.label} className="flex items-center gap-[9px] py-[7px]">
              <span className="h-[9px] w-[9px] rounded-full" style={{ background: toneColors(b.tone).fg }} />
              <span className="flex-1 text-[13px] text-[var(--muted)]">{b.label}</span>
              <span className="text-[13px] font-bold text-[var(--text)]">{b.count}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function AssistantPanels() {
  return (
    <>
      <Card
        title="Pending assignments today"
        subtitle="12 students awaiting an assignment status"
        action={
          <button className="flex flex-none items-center gap-[6px] whitespace-nowrap rounded-[var(--rad-sm)] bg-[var(--brand)] px-[13px] py-2 text-[12.5px] font-semibold text-[var(--brandfg)]">
            <Icon name="clipboard-list" size={15} />
            Open assignments
          </button>
        }
      >
        <div className="px-2 py-[7px]">
          {PENDING_STUDENTS.map((p) => (
            <div key={p.name} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
              <Avatar initials={p.initials} tone="neutral" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-[var(--text)]">{p.name}</div>
                <div className="text-[12px] text-[var(--subtle)]">{p.offering}</div>
              </div>
              <Badge text={p.badge.text} tone={p.badge.tone} icon={p.badge.icon} />
            </div>
          ))}
        </div>
      </Card>
      <Card title="My courses">
        <div className="px-2 py-[7px]">
          {MY_OFFERINGS.map((o) => (
            <div key={o.label} className="flex items-center gap-[11px] p-[11px]">
              <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="grad" size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[var(--text)]">{o.label}</div>
                <div className="text-[11.5px] text-[var(--subtle)]">{o.count} students</div>
              </div>
              <span className="text-[12.5px] font-bold text-[var(--text)]">{o.pending}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function FinancePanels() {
  return (
    <>
      <Card title="Salary overview" action={<ViewAllButton>View payroll</ViewAllButton>}>
        <div className="px-2 py-[7px]">
          {SALARY_ROWS.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-[10px] p-[10px_11px] hover:bg-[var(--surface2)]">
              <Avatar initials={r.initials} tone="neutral" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-[var(--text)]">{r.name}</div>
                <div className="text-[12px] text-[var(--subtle)]">
                  {r.offering} · {r.method}
                </div>
              </div>
              <span className="flex-none text-[14px] font-bold text-[var(--text)]">{r.amount}</span>
              <div className="w-[78px] flex-none">
                <Badge text={r.badge.text} tone={r.badge.tone} icon={r.badge.icon} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Payment methods">
        <div className="p-[18px]">
          {PAY_METHODS.map((m) => (
            <div key={m.label} className="mb-[15px] last:mb-0">
              <div className="mb-[7px] flex justify-between">
                <span className="text-[13px] font-medium text-[var(--text)]">{m.label}</span>
                <span className="text-[13px] font-semibold text-[var(--muted)]">{m.pct}%</span>
              </div>
              <div className="h-[7px] overflow-hidden rounded-full bg-[var(--surface2)]">
                <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.color }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function HrPanels() {
  return (
    <>
      <Card title="Pending assistant requests" subtitle="Submitted by course heads">
        <div className="px-2 py-[7px]">
          {ASSISTANT_REQUESTS.map((q) => (
            <div key={q.name} className="flex flex-wrap items-center gap-[10px] rounded-[10px] p-[11px] hover:bg-[var(--surface2)]">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brands)] text-[12px] font-bold text-[var(--brand)]">
                {q.initials}
              </div>
              <div className="min-w-[130px] flex-1">
                <div className="text-[13.5px] font-semibold text-[var(--text)]">{q.name}</div>
                <div className="text-[12px] text-[var(--subtle)]">{q.role}</div>
                <div className="mt-[1px] text-[11.5px] text-[var(--subtle)]">
                  by {q.by} · {q.date}
                </div>
              </div>
              <div className="flex flex-none gap-2">
                <button className="rounded-[8px] bg-[var(--brand)] px-3 py-2 text-[12px] font-semibold text-[var(--brandfg)]">
                  Approve
                </button>
                <button className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-semibold text-[var(--muted)]">
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <StaffByRoleCard />
    </>
  );
}

function StaffByRoleCard() {
  return (
    <Card title="Staff by role">
      <div className="p-[18px]">
        {STAFF_BY_ROLE.map((s) => (
          <div key={s.role} className="mb-[14px] last:mb-0">
            <div className="mb-[6px] flex justify-between">
              <span className="text-[13px] font-medium text-[var(--text)]">{s.role}</span>
              <span className="text-[13px] font-semibold text-[var(--muted)]">{s.n}</span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-[var(--surface2)]">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: s.barW }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActivityCard() {
  return (
    <Card title="Recent activity">
      <div className="px-2 py-[7px]">
        {ACTIVITY.map((a) => {
          const { bg, fg } = toneColors(a.tone);
          return (
            <div key={a.text} className="flex gap-[11px] p-[10px_11px]">
              <div
                className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px]"
                style={{ background: bg, color: fg }}
              >
                <Icon name={a.icon as IconName} size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] leading-[1.35] text-[var(--text)]">{a.text}</div>
                <div className="mt-[2px] text-[11.5px] text-[var(--subtle)]">{a.time}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function OwnerPanels() {
  return (
    <>
      <Card title="Organizations" action={<ViewAllButton>Manage</ViewAllButton>}>
        <div className="px-2 py-[7px]">
          {ORGS.map((o) => (
            <div key={o.name} className="flex items-center gap-3 rounded-[10px] p-[11px] hover:bg-[var(--surface2)]">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[var(--surface2)] text-[var(--muted)]">
                <Icon name="building" size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-[var(--text)]">{o.name}</div>
                <div className="text-[12px] text-[var(--subtle)]">
                  {o.users} users · {o.courses} courses
                </div>
              </div>
              <Badge text={o.badge.text} tone={o.badge.tone} />
            </div>
          ))}
        </div>
      </Card>
      <ActivityCard />
    </>
  );
}

function AdminPanels() {
  return (
    <>
      <ActivityCard />
      <StaffByRoleCard />
    </>
  );
}

function RegistrationPanels() {
  return (
    <>
      <Card
        title="Registration queue"
        action={
          <button className="flex flex-none items-center gap-[6px] whitespace-nowrap rounded-[var(--rad-sm)] bg-[var(--brand)] px-[13px] py-2 text-[12.5px] font-semibold text-[var(--brandfg)]">
            <Icon name="file-up" size={15} />
            Import
          </button>
        }
      >
        <div className="px-2 py-[7px]">
          {REG_QUEUE.map((r) => (
            <div key={r.name} className="flex items-center gap-3 rounded-[10px] p-[11px] hover:bg-[var(--surface2)]">
              <Avatar initials={r.initials} tone="neutral" />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-[var(--text)]">{r.name}</div>
                <div className="text-[12px] text-[var(--subtle)]">
                  {r.offering} · {r.channel}
                </div>
              </div>
              <Badge text={r.badge.text} tone={r.badge.tone} />
            </div>
          ))}
        </div>
      </Card>
      <Card
        title="Import errors"
        action={
          <span className="text-[var(--danger)]">
            <Icon name="alert" size={16} />
          </span>
        }
      >
        <div className="p-[9px_10px]">
          {IMPORT_ERRORS.map((e) => (
            <div key={e.row} className="mb-[6px] flex items-center gap-[10px] rounded-[9px] bg-[var(--dangers)] p-[9px_10px] last:mb-0">
              <span className="flex-none font-mono text-[12px] font-bold text-[var(--danger)]">{e.row}</span>
              <span className="flex-1 text-[12.5px] text-[var(--text)]">{e.msg}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

const PANELS: Record<Role, () => React.ReactElement> = {
  head: HeadPanels,
  assistant: AssistantPanels,
  finance: FinancePanels,
  hr: HrPanels,
  owner: OwnerPanels,
  admin: AdminPanels,
  registration: RegistrationPanels,
};

export function DashboardContent({
  role,
  orgName,
  firstName,
}: {
  role: Role;
  orgName: string | null;
  firstName: string;
}) {
  const Panels = PANELS[role];
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

      {role === "head" && (
        <div className="mb-[18px] flex flex-wrap items-center gap-[9px]">
          <span className="mr-[2px] flex-none text-[12.5px] font-semibold text-[var(--muted)]">Course</span>
          {HEAD_OFFERINGS.map((o) => (
            <span
              key={o.label}
              className="flex flex-none items-center gap-[7px] rounded-full border px-[14px] py-2 text-[13px] font-semibold"
              style={
                o.active
                  ? { borderColor: "var(--brand)", background: "var(--brand)", color: "var(--brandfg)" }
                  : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }
              }
            >
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: o.active ? "var(--brandfg)" : "var(--subtle)" }} />
              {o.label}
            </span>
          ))}
        </div>
      )}

      <KpiRow role={role} />

      <div className="mt-[18px] grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Panels />
      </div>
    </div>
  );
}
