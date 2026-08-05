import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import { navForRole, ROLE_LABELS } from "@/lib/roles";
import { AppShell } from "@/components/shell/app-shell";
import { listAllStaffingRequests } from "@/lib/actions/hr";
import { getAssistantPendingLogCount } from "@/lib/actions/dashboard";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";

// The tab title otherwise falls back to the root layout's static "ZAD-AMS" —
// once inside an org, show that org's own name instead.
//
// The icon href also needs an explicit per-org query string here rather
// than relying on src/app/icon.tsx's file-convention URL alone — that URL's
// hash is static regardless of who's signed in, so a browser that already
// cached it for one org (or the signed-out platform default) keeps reusing
// that cached image after switching accounts (e.g. Login As) instead of
// re-fetching; browsers cache favicons stickily and largely ignore normal
// Cache-Control for this. Keying the href on the org id gives each org (and
// the signed-out/no-org case) its own distinct, correctly-cached URL.
export async function generateMetadata() {
  const profile = await getCurrentProfile();
  return {
    title: profile?.org?.name ?? "ZAD-AMS",
    // No `type` here — icon.tsx proxies whatever format the org actually
    // uploaded (png/jpeg/svg/webp), so a hardcoded type could mismatch the
    // real Content-Type header and cause Safari specifically to reject it
    // (it's stricter about this than Chrome). `sizes` alone is enough to
    // satisfy Safari's pickier <link rel="icon"> parsing.
    icons: { icon: { url: `/icon?org=${profile?.org?.id ?? "none"}`, sizes: "64x64" } },
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  let navItems = navForRole(profile.role);
  if (profile.role === "hr") {
    const requests = await listAllStaffingRequests();
    const pending = requests.filter((r) => r.status === "pending").length;
    navItems = navItems.map((n) => (n.key === "requests" ? { ...n, badge: pending > 0 ? pending : undefined } : n));
  }
  if (profile.role === "assistant") {
    const pending = await getAssistantPendingLogCount();
    navItems = navItems.map((n) => (n.key === "assignments" ? { ...n, badge: pending > 0 ? pending : undefined } : n));
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
    </div>
  );
}
