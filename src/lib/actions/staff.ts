"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import type { Role } from "@/lib/roles";

export type StaffMember = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  role: Role;
  joinedAt: string;
  courses: string[];
};

export type PendingRequest = {
  id: string;
  kind: "add" | "remove" | "replace";
  title: string;
  detail: string;
  status: string;
};

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null }) {
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function listStaff(): Promise<StaffMember[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, initials, email, phone, role, created_at")
    .eq("org_id", orgId)
    .order("full_name", { ascending: true });

  const heads = (profiles ?? []).filter((p) => p.role === "head").map((p) => p.id);
  const assistants = (profiles ?? []).filter((p) => p.role === "assistant").map((p) => p.id);

  const coursesByProfile = new Map<string, string[]>();
  if (heads.length) {
    const { data } = await supabase
      .from("offering_heads")
      .select("head_id, course_offerings(session, unit, courses(name))")
      .in("head_id", heads);
    for (const row of data ?? []) {
      const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
      if (!o) continue;
      const list = coursesByProfile.get(row.head_id) ?? [];
      list.push(offeringLabel(o));
      coursesByProfile.set(row.head_id, list);
    }
  }
  if (assistants.length) {
    const { data } = await supabase
      .from("offering_assistants")
      .select("assistant_id, course_offerings(session, unit, courses(name))")
      .in("assistant_id", assistants);
    for (const row of data ?? []) {
      const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
      if (!o) continue;
      const list = coursesByProfile.get(row.assistant_id) ?? [];
      list.push(offeringLabel(o));
      coursesByProfile.set(row.assistant_id, list);
    }
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    initials: p.initials,
    email: p.email,
    phone: p.phone,
    role: p.role as Role,
    joinedAt: p.created_at,
    courses: coursesByProfile.get(p.id) ?? [],
  }));
}

export async function createStaffMember(input: { name: string; email: string; phone: string; role: Role; hireDate?: string }): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  if (!input.name.trim() || !input.email.trim()) throw new Error("Name and email are required");

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(createError?.message ?? "Failed to create account");

  const initials = input.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hiredAt = input.hireDate || new Date().toISOString().slice(0, 10);

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    org_id: profile.org.id,
    role: input.role,
    full_name: input.name.trim(),
    initials,
    email: input.email.trim(),
    phone: input.phone || null,
    hired_at: hiredAt,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(profileError.message);
  }

  await admin.from("staffing_log").insert({
    org_id: profile.org.id,
    kind: "add",
    target_name: input.name.trim(),
    target_role: input.role,
    hire_date: hiredAt,
  });

  return { id: created.user.id };
}

export async function updateStaffMember(id: string, patch: { name: string; phone: string; role: Role }) {
  const admin = createAdminClient();
  const initials = patch.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const { error } = await admin
    .from("profiles")
    .update({ full_name: patch.name.trim(), initials, phone: patch.phone || null, role: patch.role })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeStaffMember(id: string, leaveDate?: string) {
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("org_id, full_name, role").eq("id", id).single();

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);

  if (target) {
    await admin.from("staffing_log").insert({
      org_id: target.org_id,
      kind: "remove",
      target_name: target.full_name,
      target_role: target.role,
      leave_date: leaveDate || new Date().toISOString().slice(0, 10),
    });
  }
}

export async function getLoginAsLink(targetProfileId: string, redirectTo: string): Promise<{ url: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || !profile.org) throw new Error("Not authorized");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email, org_id").eq("id", targetProfileId).single();
  if (!target || target.org_id !== profile.org.id) throw new Error("User not found in your organization");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
    options: { redirectTo },
  });
  if (error || !data) {
    console.error("getLoginAsLink: generateLink failed", { targetProfileId, email: target.email, redirectTo, error });
    throw new Error(error?.message ?? "Couldn't create a login link");
  }

  return { url: data.properties.action_link };
}

export async function listPendingRequests(): Promise<PendingRequest[]> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("staffing_requests")
    .select("id, kind, status, candidate_name, reason, profiles!staffing_requests_target_assistant_id_fkey(full_name), course_offerings(session, unit, courses(name))")
    .eq("org_id", profile.org.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const target = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const offering = Array.isArray(r.course_offerings) ? r.course_offerings[0] : r.course_offerings;
    const title = r.kind === "add" ? "New assistant requested" : r.kind === "remove" ? "Removal requested" : "Replacement requested";
    const who = r.candidate_name || target?.full_name || "—";
    const detail = `${who} · ${offering ? offeringLabel(offering) : "—"}`;
    return { id: r.id, kind: r.kind as PendingRequest["kind"], title, detail, status: r.status };
  });
}

export async function resolveStaffingRequest(id: string, status: "approved" | "declined") {
  const supabase = await createClient();
  const { error } = await supabase.from("staffing_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function assignStaffToCourses(profileId: string, role: "head" | "assistant", offeringIds: string[]) {
  if (!offeringIds.length) return;
  const supabase = await createClient();
  const table = role === "head" ? "offering_heads" : "offering_assistants";
  const column = role === "head" ? "head_id" : "assistant_id";
  const { error } = await supabase.from(table).insert(offeringIds.map((offeringId) => ({ offering_id: offeringId, [column]: profileId })));
  if (error) throw new Error(error.message);
}

export async function getAssignedOfferingIds(profileId: string, role: "head" | "assistant"): Promise<string[]> {
  const supabase = await createClient();
  const table = role === "head" ? "offering_heads" : "offering_assistants";
  const column = role === "head" ? "head_id" : "assistant_id";
  const { data } = await supabase.from(table).select("offering_id").eq(column, profileId);
  return (data ?? []).map((r) => r.offering_id);
}

export async function setStaffCourses(profileId: string, role: "head" | "assistant", offeringIds: string[]) {
  const supabase = await createClient();
  const table = role === "head" ? "offering_heads" : "offering_assistants";
  const column = role === "head" ? "head_id" : "assistant_id";
  await supabase.from(table).delete().eq(column, profileId);
  if (offeringIds.length) {
    const { error } = await supabase.from(table).insert(offeringIds.map((offeringId) => ({ offering_id: offeringId, [column]: profileId })));
    if (error) throw new Error(error.message);
  }
}
