"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";

export type MyProfile = {
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
};

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export async function getMyProfile(): Promise<MyProfile | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("full_name, email, phone, avatar_url").eq("id", profile.id).single();
  if (!data) return null;
  return { fullName: data.full_name, email: data.email, phone: data.phone, avatarUrl: data.avatar_url };
}

export async function updateMyDetails(patch: { fullName: string; phone: string }) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  if (!patch.fullName.trim()) throw new Error("Name is required");

  const initials = patch.fullName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: patch.fullName.trim(), initials, phone: patch.phone || null })
    .eq("id", profile.id);
  if (error) throw new Error(error.message);
}

export async function updateMyEmail(newEmail: string) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  if (!newEmail.trim()) throw new Error("Email is required");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
  if (error) throw new Error(error.message);
}

export async function updateMyPassword(newPassword: string) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function uploadMyAvatar(formData: FormData): Promise<{ url: string }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided");
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) throw new Error("Profile picture must be a PNG, JPG or WEBP image");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("Profile picture must be under 2MB");

  const admin = createAdminClient();
  const ext = file.name.split(".").pop() || "png";
  const path = `${profile.id}.${ext}`;

  // Remove any previous avatar for this profile first — old uploads used a
  // different extension would otherwise sit in storage forever unused.
  const { data: existing } = await admin.storage.from("avatars").list("", { search: profile.id });
  const stale = (existing ?? []).filter((f) => f.name !== path).map((f) => f.name);
  if (stale.length) await admin.storage.from("avatars").remove(stale);

  const { error: uploadError } = await admin.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrl } = admin.storage.from("avatars").getPublicUrl(path);
  const { error: updateError } = await admin.from("profiles").update({ avatar_url: publicUrl.publicUrl }).eq("id", profile.id);
  if (updateError) throw new Error(updateError.message);

  return { url: publicUrl.publicUrl };
}

export async function removeMyAvatar() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Not authenticated");
  const admin = createAdminClient();

  const { data: existing } = await admin.storage.from("avatars").list("", { search: profile.id });
  const stale = (existing ?? []).map((f) => f.name);
  if (stale.length) await admin.storage.from("avatars").remove(stale);

  const { error } = await admin.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
  if (error) throw new Error(error.message);
}
