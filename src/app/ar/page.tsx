import { LandingPage } from "@/components/landing/landing-page";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";
import { LANDING_COPY } from "@/lib/landing-copy";

// See src/app/page.tsx for why this is generateMetadata rather than a
// static `metadata` export — the title must reflect the owner's actual
// configured brand name, not a hardcoded "ZAD-AMS".
export async function generateMetadata() {
  const branding = await getPlatformDefaultBranding();
  return {
    title: branding.name,
    description: "الواجبات والتقييمات والرواتب — منظمة بالطريقة التي يعمل بها فريقك بالفعل.",
  };
}

export default async function HomePageArabic() {
  const branding = await getPlatformDefaultBranding();
  return (
    <LandingPage copy={LANDING_COPY.ar} brand={branding.primary} brandName={branding.name} logoUrl={branding.logoUrl} altHref="/" />
  );
}
