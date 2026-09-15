import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";
import { LANDING_COPY } from "@/lib/landing-copy";

export const metadata: Metadata = {
  title: "ZAD-AMS — أدر السنتر التعليمي بالكامل من شاشة واحدة",
  description: "الواجبات والتقييمات والرواتب — منظمة بالطريقة التي يعمل بها فريقك بالفعل.",
};

export default async function HomePageArabic() {
  const branding = await getPlatformDefaultBranding();
  return (
    <LandingPage copy={LANDING_COPY.ar} brand={branding.primary} brandName={branding.name} logoUrl={branding.logoUrl} altHref="/" />
  );
}
