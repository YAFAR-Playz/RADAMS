"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { ActivityCategory } from "@/lib/activity-categories";

export type ActivityLogRow = {
  id: string;
  actorName: string;
  category: ActivityCategory;
  summary: string;
  createdAt: string;
};

const RETENTION_DAYS = 30;

// Best-effort — a logging failure should never break the action that
// triggered it, so callers fire this and don't await error handling.
export async function logActivity(category: ActivityCategory, summary: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return;
  const supabase = await createClient();
  await supabase.from("activity_log").insert({
    org_id: profile.org.id,
    actor_id: profile.id,
    actor_name: profile.fullName,
    category,
    summary,
  });
}

export async function listActivityLog(category?: ActivityCategory): Promise<ActivityLogRow[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || !profile.org) return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString();

  let query = supabase
    .from("activity_log")
    .select("id, actor_name, category, summary, created_at")
    .eq("org_id", profile.org.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (category) query = query.eq("category", category);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id,
    actorName: r.actor_name,
    category: r.category as ActivityCategory,
    summary: r.summary,
    createdAt: r.created_at,
  }));
}
