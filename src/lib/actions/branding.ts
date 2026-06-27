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

function validateLogoFile(formData: FormData): File {
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) throw new Error("Logo must be a PNG, JPG, SVG or WEBP image");
  if (file.size > MAX_LOGO_BYTES) throw new Error("Logo must be under 2MB");
  return file;
}

// Re-uploading a logo previously created a new timestamped object every
// time without ever deleting the old one. List anything matching this
// entity's prefix in its folder and remove it before the new upload lands,
// so storage doesn't grow forever from repeated re-uploads.
async function removeStalePrefixed(admin: ReturnType<typeof createAdminClient>, folder: string, prefix: string) {
  const { data: existing } = await admin.storage.from("branding").list(folder, { search: prefix });
  const stale = (existing ?? []).map((f) => `${folder}${f.name}`);
  if (stale.length) await admin.storage.from("branding").remove(stale);
}

async function getPlatformDefaults(supabase: Awaited<ReturnType<typeof createClient>>): Promise<BrandingDraft> {
  const { data } = await supabase
    .from("platform_settings")
    .select("default_brand_name, default_primary_color, default_secondary_color, default_font, default_corner, default_logo_url")
    .eq("id", true)
    .single();
  return {
    name: data?.default_brand_name ?? "RadAMS",
    primary: data?.default_primary_color ?? "#2563eb",
    secondary: data?.default_secondary_color ?? "#7c3aed",
    font: data?.default_font ?? "geist",
    corner: (data?.default_corner as "soft" | "sharp") ?? "soft",
    logoUrl: data?.default_logo_url ?? null,
  };
}

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

  const needsDefaults = !data.brand_name || !data.primary_color || !data.secondary_color || !data.font || !data.corner || !data.logo_url;
  const defaults = needsDefaults ? await getPlatformDefaults(supabase) : null;

  return {
    name: data.brand_name ?? defaults!.name,
    primary: data.primary_color ?? defaults!.primary,
    secondary: data.secondary_color ?? defaults!.secondary,
    font: data.font ?? defaults!.font,
    corner: (data.corner as "soft" | "sharp" | null) ?? defaults!.corner,
    logoUrl: data.logo_url ?? defaults!.logoUrl,
  };
}

export async function uploadOrgLogo(formData: FormData): Promise<{ url: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || !profile.org) throw new Error("Not authorized");

  const file = validateLogoFile(formData);
  const admin = createAdminClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `org-logos/${profile.org.id}.${ext}`;

  await removeStalePrefixed(admin, "org-logos/", profile.org.id);
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
  const admin = createAdminClient();
  await removeStalePrefixed(admin, "org-logos/", profile.org.id);
  const { error } = await admin.from("organizations").update({ logo_url: null }).eq("id", profile.org.id);
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

export async function getPlatformDefaultBranding(): Promise<BrandingDraft> {
  const supabase = await createClient();
  return getPlatformDefaults(supabase);
}

export async function savePlatformDefaultBranding(draft: Omit<BrandingDraft, "logoUrl">) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      default_brand_name: draft.name.trim() || "RadAMS",
      default_primary_color: draft.primary,
      default_secondary_color: draft.secondary,
      default_font: draft.font,
      default_corner: draft.corner,
    })
    .eq("id", true);
  if (error) throw new Error(error.message);
}

export async function uploadPlatformDefaultLogo(formData: FormData): Promise<{ url: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") throw new Error("Not authorized");

  const file = validateLogoFile(formData);
  const admin = createAdminClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `platform-default.${ext}`;

  await removeStalePrefixed(admin, "", "platform-default");
  const { error: uploadError } = await admin.storage.from("branding").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = admin.storage.from("branding").getPublicUrl(path);
  const { error: updateError } = await admin.from("platform_settings").update({ default_logo_url: publicUrl.publicUrl }).eq("id", true);
  if (updateError) throw new Error(updateError.message);

  return { url: publicUrl.publicUrl };
}

export async function removePlatformDefaultLogo() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") throw new Error("Not authorized");
  const admin = createAdminClient();
  await removeStalePrefixed(admin, "", "platform-default");
  const { error } = await admin.from("platform_settings").update({ default_logo_url: null }).eq("id", true);
  if (error) throw new Error(error.message);
}
