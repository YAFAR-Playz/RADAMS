import { LandingPage } from "@/components/landing/landing-page";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";
import { LANDING_COPY } from "@/lib/landing-copy";

// generateMetadata (not a static `metadata` export) so the tab title/SEO
// description use whatever name the owner has actually set in Branding
// settings, instead of a hardcoded "ZAD-AMS" that would go stale the moment
// they rename the platform.
export async function generateMetadata() {
  const branding = await getPlatformDefaultBranding();
  return {
    title: `${branding.name} — Run your tutoring center from one screen`,
    description: "Assignments, evaluations and payroll — organized the way your team actually works.",
  };
}

export default async function HomePage() {
  const branding = await getPlatformDefaultBranding();
  return (
    <LandingPage copy={LANDING_COPY.en} brand={branding.primary} brandName={branding.name} logoUrl={branding.logoUrl} altHref="/ar" />
  );
}
