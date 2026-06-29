import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/login/reset-password-form";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";

export default async function ResetPasswordPage() {
  const branding = await getPlatformDefaultBranding();
  const logoLetter = (branding.name.trim()[0] ?? "R").toUpperCase();
  const brandVars = {
    "--brand": branding.primary,
    "--brandfg": "#ffffff",
  } as React.CSSProperties;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--bg)] p-10" style={brandVars}>
      <div className="w-full max-w-[360px]">
        <div className="mb-9 flex items-center gap-[11px]">
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
        <Suspense fallback={<p className="text-[14.5px] text-[var(--muted)]">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

export function generateMetadata() {
  return { title: "Reset password — RadAMS" };
}
