"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";

export type BrandingDraft = {
  name: string;
  primary: string;
  secondary: string;
  font: string;
  corner: "soft" | "sharp";
  logoUrl: string | null;
};

const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function getBranding(): Promise<BrandingDraft | null> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("brand_name, primary_color, secondary_color, font, corner, logo_url")
    .eq("id", orgId)
    .single();
  if (!data) return null;
  return {
    name: data.brand_name,
    primary: data.primary_color,
    secondary: data.secondary_color,
    font: data.font,
    corner: data.corner as "soft" | "sharp",
    logoUrl: data.logo_url,
  };
}

export async function uploadOrgLogo(formData: FormData): Promise<{ url: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || !profile.org) throw new Error("Not authorized");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) throw new Error("Logo must be a PNG, JPG, SVG or WEBP image");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Logo must be under 2MB");

  const admin = createAdminClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `org-logos/${profile.org.id}-${Date.now()}.${ext}`;

  const { error: uploadError } = await admin.storage.from("branding").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = admin.storage.from("branding").getPublicUrl(path);
  const { error: updateError } = await admin.from("organizations").update({ logo_url: publicUrl.publicUrl }).eq("id", profile.org.id);
  if (updateError) throw new Error(updateError.message);

  return { url: publicUrl.publicUrl };
}

export async function removeOrgLogo() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || !profile.org) throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ logo_url: null }).eq("id", profile.org.id);
  if (error) throw new Error(error.message);
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
