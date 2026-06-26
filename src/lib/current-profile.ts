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
      .select("id, name, brand_name, logo_letter, logo_url, primary_color, corner")
      .eq("id", profile.org_id)
      .single();
    if (orgRow) {
      let logoUrl = orgRow.logo_url;
      if (!logoUrl) {
        const { data: platformSettings } = await supabase.from("platform_settings").select("default_logo_url").eq("id", true).single();
        logoUrl = platformSettings?.default_logo_url ?? null;
      }
      org = {
        id: orgRow.id,
        name: orgRow.name,
        brandName: orgRow.brand_name,
        logoLetter: orgRow.logo_letter,
        logoUrl,
        primaryColor: orgRow.primary_color,
        corner: orgRow.corner,
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
