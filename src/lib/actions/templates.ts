"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { TemplateKey } from "@/lib/template-defs";

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
