"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicBranding = { brandName: string; logoUrl: string | null; logoLetter: string };

// Used only by the auth callback page (Login As), before any session exists
// — the "read own org" RLS policy on organizations keys off the current
// user's org, so an unauthenticated request can't read even the target
// org's branding through the normal client. This data (logo/name) isn't
// sensitive — it's already shown on the public login page for every org —
// so reading it via the admin client here is safe.
export async function getPublicOrgBranding(orgId: string): Promise<PublicBranding> {
  const admin = createAdminClient();
  const { data: orgRow } = await admin.from("organizations").select("brand_name, logo_url").eq("id", orgId).single();
  let brandName = orgRow?.brand_name ?? null;
  let logoUrl = orgRow?.logo_url ?? null;
  if (!brandName || !logoUrl) {
    const { data: platformSettings } = await admin
      .from("platform_settings")
      .select("default_logo_url, default_brand_name")
      .eq("id", true)
      .single();
    brandName = brandName ?? platformSettings?.default_brand_name ?? null;
    logoUrl = logoUrl ?? platformSettings?.default_logo_url ?? null;
  }
  const finalName = brandName ?? "ZAD-AMS";
  return { brandName: finalName, logoUrl, logoLetter: (finalName.trim()[0] ?? "Z").toUpperCase() };
}
