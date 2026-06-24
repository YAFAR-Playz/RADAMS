"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type TemplateKey = "assignment" | "attendance" | "payment" | "welcome";

export const TEMPLATE_DEFS: { key: TemplateKey; label: string; usage: string; icon: "clipboard-list" | "cal-check" | "wallet" | "user-plus"; def: string }[] = [
  {
    key: "assignment",
    label: "Assignment update",
    usage: "Sent from assignment logging",
    icon: "clipboard-list",
    def: 'Assalamu alaikum, this is {org}.\n\nUpdate for {student} on "{assignment}":\nStatus: {status}{grade}\n\n{comment}\n\nThank you.',
  },
  {
    key: "attendance",
    label: "Attendance update",
    usage: "Sent per session",
    icon: "cal-check",
    def: "Assalamu alaikum, this is {org}.\n\n{student} was marked {status} for {session} on {date}.\n\nThank you.",
  },
  {
    key: "payment",
    label: "Payment reminder",
    usage: "Sent by Finance/Registration",
    icon: "wallet",
    def: "Dear parent, this is a reminder that {student}'s fee for {course} is due on {date}. Please contact us with any questions.",
  },
  {
    key: "welcome",
    label: "Welcome message",
    usage: "Sent by assistant on enrollment",
    icon: "user-plus",
    def: "Assalamu alaikum, I'm {assistant_name}, {student}'s teaching assistant for {course} at {org}. I'll be sharing their progress with you this term. Please feel free to reach out any time.",
  },
];

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
