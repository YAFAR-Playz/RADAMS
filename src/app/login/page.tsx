import { Icon } from "@/components/icons";
import { LoginForm } from "@/components/login/login-form";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";

const CHECKLIST = [
  "Track assignment logging, evaluations and salary in one place.",
  "Role-aware dashboards for every team across your org.",
  "Built for IGCSE sessions, units and offerings.",
];

export default async function LoginPage() {
  const branding = await getPlatformDefaultBranding();
  const logoLetter = (branding.name.trim()[0] ?? "R").toUpperCase();
  const brandVars = {
    "--brand": branding.primary,
    "--brandfg": "#ffffff",
    "--brands": `color-mix(in srgb, ${branding.primary} 9%, var(--surface))`,
  } as React.CSSProperties;

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg)]" style={brandVars}>
      <div className="hidden w-1/2 flex-col justify-between border-r border-[var(--border)] bg-[var(--brands)] p-[54px] lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[13px] bg-[var(--brand)] text-[22px] font-bold tracking-[-0.02em] text-[var(--brandfg)]">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              logoLetter
            )}
          </div>
          <span className="text-[23px] font-bold tracking-[-0.02em] text-[var(--text)]">{branding.name}</span>
        </div>
        <div>
          <h2 className="m-0 mb-[18px] max-w-[380px] text-[30px] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--text)]">
            The operating system for your tutoring center.
          </h2>
          <div className="flex max-w-[360px] flex-col gap-[14px]">
            {CHECKLIST.map((text) => (
              <div key={text} className="flex items-start gap-[11px]">
                <div className="mt-[1px] flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] bg-[var(--brand)] text-[var(--brandfg)]">
                  <Icon name="check" size={13} />
                </div>
                <span className="text-[14px] leading-[1.5] text-[var(--muted)]">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="text-[12px] text-[var(--subtle)]">© 2026 {branding.name}. All rights reserved.</span>
      </div>

      <div className="flex w-full flex-1 items-center justify-center p-10">
        <div className="w-full max-w-[360px]">
          <div className="mb-9 flex items-center gap-[11px] lg:hidden">
            <div className="flex h-[42px] w-[42px] flex-none items-center justify-center overflow-hidden rounded-[12px] bg-[var(--brand)] text-[20px] font-bold tracking-[-0.02em] text-[var(--brandfg)]">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
              ) : (
                logoLetter
              )}
            </div>
            <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">{branding.name}</span>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
