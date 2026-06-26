"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { TEMPLATE_DEFS, type TemplateKey } from "@/lib/template-defs";
import { applyTemplateVars } from "@/lib/message-vars";

export async function getOrgTemplates(): Promise<Record<TemplateKey, string | null>> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  const result: Record<TemplateKey, string | null> = { assignment: null, attendance: null, payment: null, welcome: null };
  if (!orgId) return result;
  const supabase = await createClient();
  const { data } = await supabase.from("message_templates").select("key, body").eq("org_id", orgId);
  for (const row of data ?? []) {
    result[row.key as TemplateKey] = row.body;
  }
  return result;
}

export async function getEffectiveTemplate(key: TemplateKey): Promise<string> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  const supabase = await createClient();
  const builtIn = TEMPLATE_DEFS.find((t) => t.key === key)?.def ?? "";

  const { data: platformRow } = await supabase.from("platform_message_templates").select("body").eq("key", key).maybeSingle();
  const fallback = platformRow?.body ?? builtIn;

  if (!orgId) return fallback;
  const { data } = await supabase.from("message_templates").select("body").eq("org_id", orgId).eq("key", key).maybeSingle();
  return data?.body ?? fallback;
}

export async function getPlatformTemplates(): Promise<Record<TemplateKey, string | null>> {
  const result: Record<TemplateKey, string | null> = { assignment: null, attendance: null, payment: null, welcome: null };
  const supabase = await createClient();
  const { data } = await supabase.from("platform_message_templates").select("key, body");
  for (const row of data ?? []) {
    result[row.key as TemplateKey] = row.body;
  }
  return result;
}

export async function savePlatformTemplate(key: TemplateKey, body: string) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_message_templates")
    .upsert({ key, body, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function resetPlatformTemplate(key: TemplateKey) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase.from("platform_message_templates").delete().eq("key", key);
  if (error) throw new Error(error.message);
}

export async function renderTemplate(key: TemplateKey, vars: Record<string, string>): Promise<string> {
  const template = await getEffectiveTemplate(key);
  return applyTemplateVars(template, vars);
}

export async function getOrgBrandName(): Promise<string> {
  const profile = await getCurrentProfile();
  return profile?.org?.name ?? "RadAMS";
}

export async function saveOrgTemplate(key: TemplateKey, body: string) {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").upsert({ org_id: orgId, key, body, updated_at: new Date().toISOString() }, { onConflict: "org_id,key" });
  if (error) throw new Error(error.message);
}

export async function resetOrgTemplate(key: TemplateKey) {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").delete().eq("org_id", orgId).eq("key", key);
  if (error) throw new Error(error.message);
}
