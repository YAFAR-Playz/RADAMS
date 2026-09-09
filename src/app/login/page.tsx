import { Icon } from "@/components/icons";
import { LoginForm } from "@/components/login/login-form";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";

const CHECKLIST = [
  "Assignment logging, evaluations and salary — one place, not five spreadsheets.",
  "A dashboard tailored to every role, from assistants to owners.",
  "Built around how tutoring centers actually run: sessions, units and offerings.",
];

export default async function LoginPage() {
  const branding = await getPlatformDefaultBranding();
  const logoLetter = (branding.name.trim()[0] ?? "Z").toUpperCase();
  const brandVars = {
    "--brand": branding.primary,
    "--brandfg": "#ffffff",
    "--brands": `color-mix(in srgb, ${branding.primary} 9%, var(--surface))`,
  } as React.CSSProperties;

  return (
    <div
      className="relative flex min-h-screen w-full overflow-hidden bg-[var(--bg)]"
      style={{
        ...brandVars,
        backgroundImage: `radial-gradient(70% 50% at 85% -10%, color-mix(in srgb, ${branding.primary} 10%, transparent) 0%, transparent 100%)`,
      }}
    >
      {/* BRAND PANEL — desktop only */}
      <div
        className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-[var(--border)] p-[54px] lg:flex"
        style={{
          background: `radial-gradient(120% 100% at 0% 0%, color-mix(in srgb, ${branding.primary} 14%, var(--surface)) 0%, var(--brands) 45%, var(--bg) 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-[120px] -top-[120px] h-[340px] w-[340px] rounded-full opacity-[0.16]"
          style={{ background: `radial-gradient(circle, ${branding.primary} 0%, transparent 70%)` }}
        />
        <div
          className="pointer-events-none absolute -bottom-[140px] -left-[80px] h-[320px] w-[320px] rounded-full opacity-[0.12]"
          style={{ background: `radial-gradient(circle, ${branding.primary} 0%, transparent 70%)` }}
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

        <div className="relative">
          <h2 className="m-0 mb-[20px] max-w-[400px] text-[32px] font-semibold leading-[1.22] tracking-[-0.02em] text-[var(--text)]">
            Everything your tutoring center runs on, in one place.
          </h2>
          <div className="flex max-w-[380px] flex-col gap-[16px]">
            {CHECKLIST.map((text) => (
              <div key={text} className="flex items-start gap-[11px]">
                <div className="mt-[1px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] bg-[var(--brand)] text-[var(--brandfg)] shadow-[0_3px_8px_rgba(16,23,41,0.12)]">
                  <Icon name="check" size={13} />
                </div>
                <span className="text-[14px] leading-[1.55] text-[var(--muted)]">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <span className="relative text-[12px] text-[var(--subtle)]">© 2026 {branding.name}. All rights reserved.</span>
      </div>

      {/* FORM SIDE */}
      <div className="relative flex w-full flex-1 items-start justify-center p-6 pt-[64px] sm:items-center sm:p-10 sm:pt-10">
        <div className="w-full max-w-[380px]">
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

          <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_1px_2px_rgba(16,23,41,0.04),0_18px_40px_rgba(16,23,41,0.06)] sm:p-8 lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
            <LoginForm />
          </div>

          <p className="mt-7 text-center text-[12px] text-[var(--subtle)] lg:hidden">© 2026 {branding.name}. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
