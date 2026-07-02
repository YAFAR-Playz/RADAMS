import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type CurrentProfile = {
  id: string;
  role: Role;
  fullName: string;
  initials: string;
  email: string;
  avatarUrl: string | null;
  org: { id: string; name: string; brandName: string; logoLetter: string; logoUrl: string | null; primaryColor: string; corner: "soft" | "sharp" } | null;
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, initials, email, org_id, avatar_url")
    .eq("id", userData.user.id)
    .single();

  if (!profile) return null;

  let org: CurrentProfile["org"] = null;
  if (profile.org_id) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("id, name, brand_name, logo_url, primary_color, corner")
      .eq("id", profile.org_id)
      .single();
    if (orgRow) {
      let logoUrl = orgRow.logo_url;
      let brandName = orgRow.brand_name;
      let primaryColor = orgRow.primary_color;
      let corner = orgRow.corner as "soft" | "sharp" | null;
      if (!logoUrl || !brandName || !primaryColor || !corner) {
        const { data: platformSettings } = await supabase
          .from("platform_settings")
          .select("default_logo_url, default_brand_name, default_primary_color, default_corner")
          .eq("id", true)
          .single();
        logoUrl = logoUrl ?? platformSettings?.default_logo_url ?? null;
        brandName = brandName ?? platformSettings?.default_brand_name ?? "ZAD-AMS";
        primaryColor = primaryColor ?? platformSettings?.default_primary_color ?? "#2563eb";
        corner = corner ?? (platformSettings?.default_corner as "soft" | "sharp" | undefined) ?? "soft";
      }
      org = {
        id: orgRow.id,
        name: orgRow.name,
        brandName,
        logoLetter: (brandName.trim()[0] ?? "Z").toUpperCase(),
        logoUrl,
        primaryColor,
        corner,
      };
    }
  }

  return {
    id: profile.id,
    role: profile.role as Role,
    fullName: profile.full_name,
    initials: profile.initials,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    org,
  };
}
