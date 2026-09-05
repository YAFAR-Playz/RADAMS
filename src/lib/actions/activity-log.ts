"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export type PlatformActivityRow = ActivityLogRow & { orgName: string };

// Owner spans every org, so this is the one place activity_log is read
// without an org_id filter — activity_log itself has no platform-level
// concept, this just aggregates every org's log into one feed for the
// Owner dashboard.
export async function listRecentActivityAcrossOrgs(limit = 8): Promise<PlatformActivityRow[]> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") return [];
  // activity_log's RLS only grants SELECT to an org's own admin
  // ("org_id = current_org_id() AND current_role() = 'admin'") — there's no
  // owner exemption, and owner has no current_org_id() anyway, so this must
  // go through the service-role admin client to see every org's rows.
  const admin = createAdminClient();

  const { data } = await admin
    .from("activity_log")
    .select("id, actor_name, category, summary, created_at, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
    return {
      id: r.id,
      actorName: r.actor_name,
      category: r.category as ActivityCategory,
      summary: r.summary,
      createdAt: r.created_at,
      orgName: org?.name ?? "—",
    };
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
