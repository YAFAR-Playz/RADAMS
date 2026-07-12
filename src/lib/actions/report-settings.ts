"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type ReportSettings = {
  showWeakTopics: boolean;
  showComment: boolean;
  groupByType: boolean;
};

export async function getReportSettings(): Promise<ReportSettings> {
  const defaults: ReportSettings = { showWeakTopics: true, showComment: true, groupByType: true };
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return defaults;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("report_show_weak_topics, report_show_comment, report_group_by_type")
    .eq("id", orgId)
    .single();
  if (!data) return defaults;
  return {
    showWeakTopics: data.report_show_weak_topics,
    showComment: data.report_show_comment,
    groupByType: data.report_group_by_type,
  };
}

export async function setReportSettings(settings: ReportSettings) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org || profile.role !== "admin") throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      report_show_weak_topics: settings.showWeakTopics,
      report_show_comment: settings.showComment,
      report_group_by_type: settings.groupByType,
    })
    .eq("id", profile.org.id);
  if (error) throw new Error(error.message);
}
