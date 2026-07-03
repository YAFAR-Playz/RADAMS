import { Suspense } from "react";
import { AuthCallback } from "@/components/login/auth-callback";
import { getPublicOrgBranding } from "@/lib/actions/public-branding";

type SearchParams = Promise<{ org?: string | string[] }>;

async function resolveBranding(searchParams: SearchParams) {
  const { org } = await searchParams;
  const orgId = Array.isArray(org) ? org[0] : org;
  if (!orgId) return { brandName: "ZAD-AMS", logoUrl: null as string | null, logoLetter: "Z" };
  return getPublicOrgBranding(orgId);
}

export default async function AuthCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const branding = await resolveBranding(searchParams);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--bg)] p-10">
      <div className="w-full max-w-[360px]">
        <div className="mb-9 flex items-center gap-[11px]">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-[42px] w-[42px] flex-none rounded-[12px] bg-[var(--brand)] object-contain" />
          ) : (
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[var(--brand)] text-[20px] font-bold tracking-[-0.02em] text-[var(--brandfg)]">
              {branding.logoLetter}
            </div>
          )}
          <span className="text-[22px] font-bold tracking-[-0.02em] text-[var(--text)]">{branding.brandName}</span>
        </div>
        <Suspense fallback={<p className="text-[14.5px] text-[var(--muted)]">Signing you in…</p>}>
          <AuthCallback />
        </Suspense>
      </div>
    </div>
  );
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const branding = await resolveBranding(searchParams);
  return { title: `Signing in — ${branding.brandName}` };
}
