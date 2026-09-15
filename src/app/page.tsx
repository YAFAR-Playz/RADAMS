import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";
import { LANDING_COPY } from "@/lib/landing-copy";

export const metadata: Metadata = {
  title: "ZAD-AMS — Run your tutoring center from one screen",
  description: "Assignments, evaluations and payroll — organized the way your team actually works.",
};

export default async function HomePage() {
  const branding = await getPlatformDefaultBranding();
  return (
    <LandingPage copy={LANDING_COPY.en} brand={branding.primary} brandName={branding.name} logoUrl={branding.logoUrl} altHref="/ar" />
  );
}
