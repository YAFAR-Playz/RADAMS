"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivity } from "@/lib/actions/activity-log";
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
  offeringIds: string[];
  isMainAdmin: boolean;
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

  let query = supabase
    .from("profiles")
    .select("id, full_name, initials, email, phone, role, created_at, is_main_admin")
    .eq("org_id", orgId)
    .is("left_at", null)
    .order("full_name", { ascending: true });
  // HR manages non-admin staff only — keep admin/owner rows (and their PII)
  // out of the response entirely rather than just hiding them client-side.
  if (profile.role === "hr") query = query.not("role", "in", '("admin","owner")');
  const { data: profiles } = await query;

  const heads = (profiles ?? []).filter((p) => p.role === "head").map((p) => p.id);
  const assistants = (profiles ?? []).filter((p) => p.role === "assistant").map((p) => p.id);

  const coursesByProfile = new Map<string, string[]>();
  const offeringIdsByProfile = new Map<string, string[]>();
  if (heads.length) {
    const { data } = await supabase
      .from("offering_heads")
      .select("head_id, offering_id, course_offerings(session, unit, courses(name))")
      .in("head_id", heads);
    for (const row of data ?? []) {
      const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
      if (!o) continue;
      coursesByProfile.set(row.head_id, [...(coursesByProfile.get(row.head_id) ?? []), offeringLabel(o)]);
      offeringIdsByProfile.set(row.head_id, [...(offeringIdsByProfile.get(row.head_id) ?? []), row.offering_id]);
    }
  }
  if (assistants.length) {
    const { data } = await supabase
      .from("offering_assistants")
      .select("assistant_id, offering_id, course_offerings(session, unit, courses(name))")
      .in("assistant_id", assistants);
    for (const row of data ?? []) {
      const o = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
      if (!o) continue;
      coursesByProfile.set(row.assistant_id, [...(coursesByProfile.get(row.assistant_id) ?? []), offeringLabel(o)]);
      offeringIdsByProfile.set(row.assistant_id, [...(offeringIdsByProfile.get(row.assistant_id) ?? []), row.offering_id]);
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
    offeringIds: offeringIdsByProfile.get(p.id) ?? [],
    isMainAdmin: !!p.is_main_admin,
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
  await logActivity("staff", `Added ${input.name.trim()} as ${input.role}`);

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
  await logActivity("staff", `Updated ${patch.name.trim()}'s profile`);
}

// Deactivates rather than deletes: salary_lines, evaluations, and
// assignment_logs attribution all cascade/null out on a real auth-user
// delete, which would destroy a departing assistant's payroll history right
// when it matters most (their final, possibly prorated, paycheck). Banning
// the auth user blocks login while leaving every historical record intact;
// left_at/gave_notice are what salary proration and "active staff" listings
// key off going forward.
export async function removeStaffMember(id: string, leaveDate?: string, gaveNotice?: boolean) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("org_id, full_name, role, is_main_admin").eq("id", id).single();
  if (!target || target.org_id !== profile.org.id) throw new Error("User not found in your organization");
  if (target.is_main_admin) throw new Error("This is the organization's main admin and can't be removed.");

  const resolvedLeaveDate = leaveDate || new Date().toISOString().slice(0, 10);

  const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
  if (banError) throw new Error(banError.message);

  const { error } = await admin
    .from("profiles")
    .update({ left_at: resolvedLeaveDate, gave_notice: gaveNotice ?? null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await admin.from("staffing_log").insert({
    org_id: target.org_id,
    kind: "remove",
    target_name: target.full_name,
    target_role: target.role,
    leave_date: resolvedLeaveDate,
    gave_notice: gaveNotice ?? null,
  });
  await logActivity("staff", `Removed ${target.full_name} (${target.role})${gaveNotice ? " — gave notice" : ""}`);
}

// A remove/replace request is scoped to one course — it should only take
// the assistant off that course, not revoke their whole account, unless
// this was the only course they had. Reassigning enrollments lets a
// "replace" hand the outgoing assistant's students straight to whoever is
// taking over, instead of leaving them unassigned.
export async function removeAssistantFromOffering(
  assistantId: string,
  offeringId: string,
  opts?: { leaveDate?: string; gaveNotice?: boolean; reassignEnrollmentsTo?: string }
) {
  const supabase = await createClient();

  const { error: enrollError } = await supabase
    .from("enrollments")
    .update({ assistant_id: opts?.reassignEnrollmentsTo ?? null })
    .eq("offering_id", offeringId)
    .eq("assistant_id", assistantId);
  if (enrollError) throw new Error(enrollError.message);

  const { error: unlinkError } = await supabase.from("offering_assistants").delete().eq("offering_id", offeringId).eq("assistant_id", assistantId);
  if (unlinkError) throw new Error(unlinkError.message);

  const { count } = await supabase.from("offering_assistants").select("offering_id", { count: "exact", head: true }).eq("assistant_id", assistantId);

  if (!count) {
    await removeStaffMember(assistantId, opts?.leaveDate, opts?.gaveNotice);
  } else {
    const { data: assistant } = await supabase.from("profiles").select("full_name").eq("id", assistantId).single();
    await logActivity(
      "staff",
      `Removed ${assistant?.full_name ?? "an assistant"} from one course — still active on ${count} other${count === 1 ? "" : "s"}`
    );
  }
}

export async function getLoginAsLink(targetProfileId: string, redirectTo: string): Promise<{ url: string }> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || !profile.org) throw new Error("Not authorized");

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email, org_id").eq("id", targetProfileId).single();
  if (!target || target.org_id !== profile.org.id) throw new Error("User not found in your organization");

  // Carries the target org through to the auth callback page so its
  // "Signing you in…" loading screen can show that org's branding instead
  // of a generic default — there's no session yet at that point to look it
  // up any other way.
  const brandedRedirect = `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}org=${target.org_id}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.email,
    options: { redirectTo: brandedRedirect },
  });
  if (error || !data) {
    console.error("getLoginAsLink: generateLink failed", { targetProfileId, email: target.email, redirectTo, error });
    throw new Error(error?.message ?? "Couldn't create a login link");
  }

  return { url: data.properties.action_link };
}

// Approving a request used to only flip its status — the add/remove/replace
// it described never actually happened, so an approved "replace" would
// leave the outgoing assistant fully active and no incoming one ever
// created. This now performs the real staffing change before recording the
// approval, so the request and reality can't drift apart.
export async function resolveStaffingRequest(id: string, status: "approved" | "declined") {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "hr")) throw new Error("Not authorized");
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("staffing_requests")
    .select("kind, status, candidate_name, candidate_email, candidate_phone, target_assistant_id, offering_id, leave_date, gave_notice, proposed_date")
    .eq("id", id)
    .single();
  if (!request) throw new Error("Request not found");
  if (request.status !== "pending") throw new Error("This request has already been resolved");

  if (status === "approved") {
    let newAssistantId: string | undefined;
    if (request.kind === "add" || request.kind === "replace") {
      if (!request.candidate_name?.trim() || !request.candidate_email?.trim()) {
        throw new Error("This request is missing the candidate's name or email — can't add them yet.");
      }
      const created = await createStaffMember({
        name: request.candidate_name,
        email: request.candidate_email,
        phone: request.candidate_phone ?? "",
        role: "assistant",
        hireDate: request.proposed_date ?? undefined,
      });
      newAssistantId = created.id;
      if (request.offering_id) await assignStaffToCourses(newAssistantId, "assistant", [request.offering_id]);
    }
    if ((request.kind === "remove" || request.kind === "replace") && request.target_assistant_id) {
      if (request.offering_id) {
        await removeAssistantFromOffering(request.target_assistant_id, request.offering_id, {
          leaveDate: request.leave_date ?? undefined,
          gaveNotice: request.gave_notice ?? undefined,
          reassignEnrollmentsTo: request.kind === "replace" ? newAssistantId : undefined,
        });
      } else {
        // No specific course on record — fall back to a full deactivation
        // since there's nothing to scope the removal to.
        await removeStaffMember(request.target_assistant_id, request.leave_date ?? undefined, request.gave_notice ?? undefined);
      }
    }
  }

  const { error } = await supabase.from("staffing_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity("requests", `${status === "approved" ? "Approved" : "Declined"} ${request.kind} request for ${request.candidate_name ?? "a staff change"}`);
}

export async function assignStaffToCourses(profileId: string, role: "head" | "assistant", offeringIds: string[]) {
  if (!offeringIds.length) return;
  const supabase = await createClient();
  const table = role === "head" ? "offering_heads" : "offering_assistants";
  const column = role === "head" ? "head_id" : "assistant_id";
  // joined_at feeds bracket-salary proration for assistants added mid-period
  // — offering_heads has no such column, so only stamp it for assistants.
  const extra = role === "assistant" ? { joined_at: new Date().toISOString() } : {};
  const { error } = await supabase.from(table).insert(offeringIds.map((offeringId) => ({ offering_id: offeringId, [column]: profileId, ...extra })));
  if (error) throw new Error(error.message);
}

export async function getAssignedOfferingIds(profileId: string, role: "head" | "assistant"): Promise<string[]> {
  const supabase = await createClient();
  const table = role === "head" ? "offering_heads" : "offering_assistants";
  const column = role === "head" ? "head_id" : "assistant_id";
  const { data } = await supabase.from(table).select("offering_id").eq(column, profileId);
  return (data ?? []).map((r) => r.offering_id);
}

// Diffs against the existing assignment rather than wiping and reinserting
// everything — a straight delete-then-reinsert would stamp joined_at fresh
// on every edit, even for courses the assistant has been on for months,
// which would wreck bracket-salary proration the next time their courses
// are touched for an unrelated reason.
export async function setStaffCourses(profileId: string, role: "head" | "assistant", offeringIds: string[]) {
  const supabase = await createClient();
  const table = role === "head" ? "offering_heads" : "offering_assistants";
  const column = role === "head" ? "head_id" : "assistant_id";

  const { data: existing } = await supabase.from(table).select("offering_id").eq(column, profileId);
  const existingIds = new Set((existing ?? []).map((r) => r.offering_id));
  const toRemove = Array.from(existingIds).filter((id) => !offeringIds.includes(id));
  const toAdd = offeringIds.filter((id) => !existingIds.has(id));

  if (toRemove.length) {
    const { error } = await supabase.from(table).delete().eq(column, profileId).in("offering_id", toRemove);
    if (error) throw new Error(error.message);
  }
  if (toAdd.length) {
    const extra = role === "assistant" ? { joined_at: new Date().toISOString() } : {};
    const { error } = await supabase.from(table).insert(toAdd.map((offeringId) => ({ offering_id: offeringId, [column]: profileId, ...extra })));
    if (error) throw new Error(error.message);
  }
}
