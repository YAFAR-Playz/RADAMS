"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type BrandingDraft = {
  name: string;
  primary: string;
  secondary: string;
  font: string;
  corner: "soft" | "sharp";
};

export async function getBranding(): Promise<BrandingDraft | null> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("brand_name, primary_color, secondary_color, font, corner")
    .eq("id", orgId)
    .single();
  if (!data) return null;
  return {
    name: data.brand_name,
    primary: data.primary_color,
    secondary: data.secondary_color,
    font: data.font,
    corner: data.corner as "soft" | "sharp",
  };
}

export async function saveBranding(draft: BrandingDraft) {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      brand_name: draft.name.trim() || "RadAMS",
      primary_color: draft.primary,
      secondary_color: draft.secondary,
      font: draft.font,
      corner: draft.corner,
      logo_letter: (draft.name.trim()[0] ?? "R").toUpperCase(),
    })
    .eq("id", orgId);
  if (error) throw new Error(error.message);
}
