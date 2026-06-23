import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import { navForRole, ROLE_LABELS } from "@/lib/roles";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const primaryColor = profile.org?.primaryColor ?? "#2563eb";
  const brandVars: Record<string, string> = {
    "--brand": primaryColor,
    "--brandh": `color-mix(in srgb, ${primaryColor} 84%, black)`,
    "--brands": `color-mix(in srgb, ${primaryColor} 9%, var(--surface))`,
    "--info": primaryColor,
    "--infos": `color-mix(in srgb, ${primaryColor} 8%, var(--surface))`,
  };
  if (profile.org?.corner === "sharp") {
    brandVars["--rad"] = "6px";
    brandVars["--rad-sm"] = "5px";
  }

  return (
    <div style={brandVars as React.CSSProperties}>
      <AppShell
        navItems={navForRole(profile.role)}
        person={{ name: profile.fullName, label: ROLE_LABELS[profile.role], initials: profile.initials }}
        brandName={profile.org?.brandName ?? "RadAMS"}
        logoLetter={profile.org?.logoLetter ?? "R"}
        orgName={profile.org?.name ?? null}
      >
        {children}
      </AppShell>
    </div>
  );
}
