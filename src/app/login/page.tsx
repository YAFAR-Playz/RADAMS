import { Icon } from "@/components/icons";
import { LoginForm } from "@/components/login/login-form";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";

export default async function LoginPage() {
  const branding = await getPlatformDefaultBranding();
  const logoLetter = (branding.name.trim()[0] ?? "Z").toUpperCase();
  const brand = branding.primary;
  const brandVars = {
    "--brand": brand,
    "--brandfg": "#ffffff",
    "--brands": `color-mix(in srgb, ${brand} 9%, var(--surface))`,
  } as React.CSSProperties;
  const bars = [40, 68, 52, 85, 62];

  return (
    <div
      className="relative flex min-h-screen w-full overflow-hidden bg-[var(--bg)]"
      style={{
        ...brandVars,
        backgroundImage: `radial-gradient(70% 50% at 85% -10%, color-mix(in srgb, ${brand} 10%, transparent) 0%, transparent 100%)`,
      }}
    >
      {/* BRAND PANEL — desktop only */}
      <div
        className="relative hidden w-1/2 flex-col overflow-hidden border-r border-[var(--border)] p-[54px] lg:flex"
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, var(--text) 6%, transparent) 1px, transparent 1.4px) 0 0/24px 24px, radial-gradient(125% 100% at 0% 0%, color-mix(in srgb, ${brand} 16%, var(--surface)) 0%, var(--brands) 42%, var(--bg) 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-[140px] -top-[160px] h-[420px] w-[420px] rounded-full opacity-[0.18] blur-[10px]"
          style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
        />
        <div
          className="pointer-events-none absolute -bottom-[160px] -left-[100px] h-[360px] w-[360px] rounded-full opacity-[0.14] blur-[10px]"
          style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[13px] bg-[var(--brand)] text-[22px] font-bold tracking-[-0.02em] text-[var(--brandfg)] shadow-[0_6px_16px_rgba(16,23,41,0.14)]">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              logoLetter
            )}
          </div>
          <span className="text-[23px] font-bold tracking-[-0.02em] text-[var(--text)]">{branding.name}</span>
        </div>

        {/* HERO — floating product snapshot cards */}
        <div className="relative my-10 flex-1">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.14] blur-[30px]"
            style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
          />

          {/* Payroll card */}
          <div
            className="absolute left-[6%] top-[8%] w-[240px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[18px] shadow-[0_18px_36px_rgba(16,23,41,0.12)]"
            style={{ transform: "rotate(-6deg)" }}
          >
            <div className="flex items-center gap-[9px]">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="wallet" size={16} />
              </div>
              <div>
                <p className="m-0 text-[13px] font-semibold text-[var(--text)]">July payroll</p>
                <p className="m-0 text-[11.5px] text-[var(--subtle)]">42 staff · on time</p>
              </div>
            </div>
            <div className="mt-[14px] flex items-center justify-between rounded-[10px] bg-[var(--surface2)] px-3 py-[9px]">
              <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--text)]">$18,240</span>
              <span
                className="rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold"
                style={{ background: "color-mix(in srgb, #16a34a 16%, transparent)", color: "#15803d" }}
              >
                Released
              </span>
            </div>
          </div>

          {/* Attendance card */}
          <div
            className="absolute right-[2%] top-[30%] w-[210px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[18px] shadow-[0_18px_36px_rgba(16,23,41,0.12)]"
            style={{ transform: "rotate(4deg)" }}
          >
            <div className="flex items-center gap-[9px]">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="chart" size={16} />
              </div>
              <div>
                <p className="m-0 text-[13px] font-semibold text-[var(--text)]">Attendance</p>
                <p className="m-0 text-[11.5px] text-[var(--subtle)]">this month</p>
              </div>
            </div>
            <div className="mt-[16px] flex h-[46px] items-end gap-[6px]">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-[3px]"
                  style={{
                    height: `${h}%`,
                    background: i === bars.length - 1 ? "var(--brand)" : "color-mix(in srgb, var(--brand) 30%, transparent)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Team card */}
          <div
            className="absolute bottom-[6%] left-[16%] w-[220px] rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-[18px] shadow-[0_18px_36px_rgba(16,23,41,0.12)]"
            style={{ transform: "rotate(-3deg)" }}
          >
            <div className="flex items-center gap-[9px]">
              <div className="flex h-8 w-8 flex-none items-center justify-center rounded-[9px] bg-[var(--brands)] text-[var(--brand)]">
                <Icon name="users" size={16} />
              </div>
              <div>
                <p className="m-0 text-[13px] font-semibold text-[var(--text)]">12 assistants</p>
                <p className="m-0 text-[11.5px] text-[var(--subtle)]">auto-assigned today</p>
              </div>
            </div>
            <div className="mt-[14px] flex">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-7 w-7 rounded-full border-2 border-[var(--surface)] text-[10px] font-bold text-[var(--brandfg)]"
                  style={{
                    marginLeft: i === 0 ? 0 : -8,
                    background: `color-mix(in srgb, var(--brand) ${70 - i * 12}%, var(--subtle))`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 4 - i,
                  }}
                >
                  {i < 3 ? "" : "+9"}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <h2 className="m-0 mb-[10px] max-w-[400px] text-[28px] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--text)]">
            Run your tutoring center from one screen.
          </h2>
          <p className="m-0 max-w-[360px] text-[14px] leading-[1.55] text-[var(--muted)]">
            Assignments, evaluations and payroll — organized the way your team actually works.
          </p>
        </div>

        <span className="relative mt-8 text-[12px] text-[var(--subtle)]">© 2026 {branding.name}. All rights reserved.</span>
      </div>

      {/* FORM SIDE */}
      <div className="relative flex w-full flex-1 items-start justify-center overflow-hidden p-6 pt-[64px] sm:items-center sm:p-10 sm:pt-10">
        <div
          className="pointer-events-none absolute left-1/2 top-[18%] h-[260px] w-[260px] -translate-x-1/2 rounded-full opacity-[0.12] blur-[40px] lg:top-1/2 lg:-translate-y-1/2"
          style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
        />

        <div className="relative w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-[11px] lg:hidden">
            <div className="flex h-[42px] w-[42px] flex-none items-center justify-center overflow-hidden rounded-[12px] bg-[var(--brand)] text-[20px] font-bold tracking-[-0.02em] text-[var(--brandfg)] shadow-[0_4px_12px_rgba(16,23,41,0.12)]">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                logoLetter
              )}
            </div>
            <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">{branding.name}</span>
          </div>

          <div className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(16,23,41,0.04),0_18px_40px_rgba(16,23,41,0.08)] sm:p-8">
            <div
              className="absolute inset-x-0 top-0 h-[3px]"
              style={{ background: `linear-gradient(90deg, transparent, ${brand}, transparent)` }}
            />
            <LoginForm />
          </div>

          <p className="mt-7 text-center text-[12px] text-[var(--subtle)] lg:hidden">© 2026 {branding.name}. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
