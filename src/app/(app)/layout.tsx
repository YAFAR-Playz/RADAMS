import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import { navForRole, ROLE_LABELS } from "@/lib/roles";
import { AppShell } from "@/components/shell/app-shell";
import { getPendingStaffingRequestCount } from "@/lib/actions/hr";
import { getUnresolvedFinanceInquiryCount } from "@/lib/actions/finance-salaries";
import { getAssistantPendingLogCount } from "@/lib/actions/dashboard";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";
import { hasUnviewedReleasedPay } from "@/lib/actions/pay";
import { roleHasOnboardingTour } from "@/lib/onboarding-roles";
import { getTourSteps } from "@/lib/onboarding-tours";
import { DemoBanner } from "@/components/onboarding/demo-banner";
import { OnboardingPrompt } from "@/components/onboarding/onboarding-prompt";
import { TourRunner } from "@/components/onboarding/tour-runner";

// The tab title otherwise falls back to the root layout's static "ZAD-AMS" —
// once inside an org, show that org's own name instead.
//
// Deliberately does NOT also set `icons` here anymore — it used to, with its
// own separately-computed `/icon?org=<id>` href, alongside the root layout's
// own icon handling. Two different layouts each emitting their own
// `<link rel="icon">` (from the old file-convention icon.tsx AND this
// layout's metadata) meant two competing tags in the same document, and
// which one a browser actually kept using once cached was unpredictable —
// a likely contributor to the exact "shows a stale org's icon" reports this
// was meant to fix in the first place. The root layout (src/app/layout.tsx)
// is now the single source of truth for the favicon, computed the same way
// for every page including these — see src/app/org-icon/route.tsx.
export async function generateMetadata() {
  const profile = await getCurrentProfile();
  return { title: profile?.org?.name ?? "ZAD-AMS" };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  let navItems = navForRole(profile.role);
  if (profile.role === "hr") {
    const pending = await getPendingStaffingRequestCount();
    navItems = navItems.map((n) => (n.key === "requests" ? { ...n, badge: pending > 0 ? pending : undefined } : n));
  }
  if (profile.role === "assistant") {
    const pending = await getAssistantPendingLogCount();
    navItems = navItems.map((n) => (n.key === "assignments" ? { ...n, badge: pending > 0 ? pending : undefined } : n));
  }
  if (profile.role === "assistant" || profile.role === "head") {
    const unviewedPay = await hasUnviewedReleasedPay();
    navItems = navItems.map((n) => (n.key === "mypay" ? { ...n, dot: unviewedPay } : n));
  }
  // Admin has no separate "Requests" tab (that's HR-only) — staffing
  // requests are reviewed straight from the Staff tab, so a pending one
  // otherwise only ever showed up in the notification bell. Dot clears
  // itself once every request is accepted/declined, since it re-reads the
  // live pending count on every navigation.
  if (profile.role === "admin") {
    const pendingStaffing = await getPendingStaffingRequestCount();
    navItems = navItems.map((n) => (n.key === "staff" ? { ...n, dot: pendingStaffing > 0 } : n));
  }
  // Finance inquiries (payee -> Finance/Admin messages on a salary line)
  // previously only surfaced in the notification bell, easy to miss — a dot
  // on Salaries (where the reply panel actually lives) clears once someone
  // replies to every open thread.
  if (profile.role === "admin" || profile.role === "finance") {
    const unresolvedInquiries = await getUnresolvedFinanceInquiryCount();
    navItems = navItems.map((n) => (n.key === "salaries" ? { ...n, dot: unresolvedInquiries > 0 } : n));
  }

  // Owner has no org, so there's nothing for getCurrentProfile() to resolve
  // branding from — fetch the platform default directly so the owner's own
  // sidebar reflects what they've set instead of hardcoded fallbacks.
  const platformBranding = profile.org ? null : await getPlatformDefaultBranding();

  const primaryColor = profile.org?.primaryColor ?? platformBranding?.primary ?? "#2563eb";
  const brandVars: Record<string, string> = {
    "--brand": primaryColor,
    "--brandh": `color-mix(in srgb, ${primaryColor} 84%, black)`,
    "--brands": `color-mix(in srgb, ${primaryColor} 9%, var(--surface))`,
    "--info": primaryColor,
    "--infos": `color-mix(in srgb, ${primaryColor} 8%, var(--surface))`,
  };
  if ((profile.org?.corner ?? platformBranding?.corner) === "sharp") {
    brandVars["--rad"] = "6px";
    brandVars["--rad-sm"] = "5px";
  }

  return (
    <div style={brandVars as React.CSSProperties}>
      {profile.isTouringDemo && <DemoBanner />}
      <AppShell
        navItems={navItems}
        person={{ name: profile.fullName, label: ROLE_LABELS[profile.role], initials: profile.initials, avatarUrl: profile.avatarUrl }}
        brandName={profile.org?.brandName ?? platformBranding?.name ?? "ZAD-AMS"}
        logoLetter={profile.org?.logoLetter ?? (platformBranding?.name.trim()[0] ?? "Z").toUpperCase()}
        logoUrl={profile.org?.logoUrl ?? platformBranding?.logoUrl ?? null}
        orgName={profile.org?.name ?? null}
      >
        {children}
      </AppShell>
      {profile.isTouringDemo && <TourRunner steps={getTourSteps(profile.role)} />}
      {!profile.isTouringDemo && profile.onboardingTourStatus === "pending" && roleHasOnboardingTour(profile.role) && <OnboardingPrompt />}
    </div>
  );
}
