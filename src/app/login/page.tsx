import { LoginForm } from "@/components/login/login-form";
import { LoginHeroCards } from "@/components/login/login-hero-cards";
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

        <div className="relative flex items-center gap-3 animate-[fadeUp_500ms_ease-out_both]">
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

        <LoginHeroCards brand={brand} />

        <div className="relative animate-[fadeUp_550ms_ease-out_both]" style={{ animationDelay: "180ms" }}>
          <h2 className="m-0 mb-[10px] max-w-[400px] text-[28px] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--text)]">
            Run your tutoring center from one screen.
          </h2>
          <p className="m-0 max-w-[360px] text-[14px] leading-[1.55] text-[var(--muted)]">
            Assignments, evaluations and payroll — organized the way your team actually works.
          </p>
        </div>

        <span
          className="relative mt-8 text-[12px] text-[var(--subtle)] animate-[fadeUp_550ms_ease-out_both]"
          style={{ animationDelay: "240ms" }}
        >
          © 2026 {branding.name}. All rights reserved.
        </span>
      </div>

      {/* FORM SIDE */}
      <div className="relative flex w-full flex-1 items-start justify-center overflow-hidden p-6 pt-[64px] sm:items-center sm:p-10 sm:pt-10">
        <div
          className="pointer-events-none absolute left-1/2 top-[18%] h-[260px] w-[260px] -translate-x-1/2 rounded-full opacity-[0.12] blur-[40px] lg:top-1/2 lg:-translate-y-1/2"
          style={{ background: `radial-gradient(circle, ${brand} 0%, transparent 70%)` }}
        />

        <div className="relative w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-[11px] animate-[fadeUp_500ms_ease-out_both] lg:hidden">
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

          <div
            className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(16,23,41,0.04),0_18px_40px_rgba(16,23,41,0.08)] animate-[fadeUp_550ms_ease-out_both] sm:p-8"
            style={{ animationDelay: "80ms" }}
          >
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
