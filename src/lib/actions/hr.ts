"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import type { Kpi } from "@/lib/roles";

export type StaffingRequestDetail = {
  id: string;
  kind: "add" | "remove" | "replace";
  status: string;
  createdAt: string;
  requestedByName: string | null;
  candidateName: string | null;
  candidatePhone: string | null;
  candidateEmail: string | null;
  targetName: string | null;
  offeringLabel: string;
  reason: string | null;
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null } | null) {
  if (!o) return "—";
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export type StaffingLogRow = { id: string; title: string; detail: string; createdAt: string; icon: "user-plus"; color: string };

export async function listRecentStaffJoins(): Promise<StaffingLogRow[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("org_id", profile.org.id)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((p) => ({
    id: p.id,
    title: `Added ${p.role.charAt(0).toUpperCase() + p.role.slice(1)} — ${p.full_name}`,
    detail: `joined ${new Date(p.created_at).toLocaleDateString()}`,
    createdAt: p.created_at,
    icon: "user-plus" as const,
    color: "var(--brand)",
  }));
}

export type StaffByRole = { role: string; n: number; barW: string };
export type HrDashboard = { kpis: Kpi[]; pendingRequests: StaffingRequestDetail[]; staffByRole: StaffByRole[] };

export async function getHrDashboard(): Promise<HrDashboard> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return { kpis: [], pendingRequests: [], staffByRole: [] };
  const supabase = await createClient();

  const { data: profiles } = await supabase.from("profiles").select("role").eq("org_id", profile.org.id);
  const counts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.role === "owner") continue;
    counts.set(p.role, (counts.get(p.role) ?? 0) + 1);
  }
  const max = Math.max(1, ...Array.from(counts.values()));
  const roleLabel: Record<string, string> = { admin: "Admin", hr: "HR", head: "Heads", assistant: "Assistants", registration: "Registration", finance: "Finance" };
  const staffByRole: StaffByRole[] = Array.from(counts.entries())
    .map(([role, n]) => ({ role: roleLabel[role] ?? role, n, barW: `${Math.round((n / max) * 100)}%` }))
    .sort((a, b) => b.n - a.n);

  const allRequests = await listAllStaffingRequests();
  const pendingRequests = allRequests.filter((r) => r.status === "pending");

  const totalStaff = (profiles ?? []).filter((p) => p.role !== "owner").length;
  const kpis: Kpi[] = [
    { icon: "users", value: String(totalStaff), label: "Total staff", tone: "neutral" },
    { icon: "inbox", value: String(pendingRequests.length), label: "Pending requests", tone: pendingRequests.length > 0 ? "warn" : "ok" },
    { icon: "user-plus", value: String(allRequests.filter((r) => r.kind === "add").length), label: "Add requests", tone: "brand" },
    { icon: "check", value: String(allRequests.filter((r) => r.status === "approved").length), label: "Approved this month", tone: "ok" },
  ];

  return { kpis, pendingRequests: pendingRequests.slice(0, 5), staffByRole };
}

export async function listAllStaffingRequests(): Promise<StaffingRequestDetail[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("staffing_requests")
    .select(
      "id, kind, status, created_at, reason, candidate_name, candidate_phone, candidate_email, requested_by, profiles!staffing_requests_target_assistant_id_fkey(full_name), course_offerings(session, unit, courses(name))"
    )
    .eq("org_id", profile.org.id)
    .order("created_at", { ascending: false });

  const requesterIds = Array.from(new Set((data ?? []).map((r) => r.requested_by).filter((x): x is string => !!x)));
  const requesterNames = new Map<string, string>();
  if (requesterIds.length) {
    const { data: requesters } = await supabase.from("profiles").select("id, full_name").in("id", requesterIds);
    for (const r of requesters ?? []) requesterNames.set(r.id, r.full_name);
  }

  return (data ?? []).map((r) => {
    const target = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const offering = Array.isArray(r.course_offerings) ? r.course_offerings[0] : r.course_offerings;
    return {
      id: r.id,
      kind: r.kind as StaffingRequestDetail["kind"],
      status: r.status,
      createdAt: r.created_at,
      requestedByName: r.requested_by ? requesterNames.get(r.requested_by) ?? null : null,
      candidateName: r.candidate_name,
      candidatePhone: r.candidate_phone,
      candidateEmail: r.candidate_email,
      targetName: target?.full_name ?? null,
      offeringLabel: offeringLabel(offering),
      reason: r.reason,
    };
  });
}
