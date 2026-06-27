"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import type { Kpi, Role } from "@/lib/roles";

export type OrgMetrics = { students: number; assistants: number; heads: number; courses: number; assignments: number };
export type OrgOverview = {
  id: string;
  name: string;
  mark: string;
  primaryColor: string;
  adminName: string | null;
  adminPhone: string | null;
  adminEmail: string | null;
  adminId: string | null;
  status: "active" | "trial" | "suspended";
  metrics: OrgMetrics;
};

function markOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") throw new Error("Not authorized");
  return profile;
}

export async function listOrgsOverview(): Promise<OrgOverview[]> {
  await requireOwner();
  const supabase = await createClient();

  const { data: orgs } = await supabase.from("organizations").select("id, name, primary_color, status").order("created_at", { ascending: true });
  if (!orgs || orgs.length === 0) return [];

  const orgIds = orgs.map((o) => o.id);

  const [{ data: admins }, { data: students }, { data: profiles }, { data: offerings }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("id, org_id, full_name, phone, email, is_main_admin").eq("role", "admin").in("org_id", orgIds),
    supabase.from("students").select("org_id").in("org_id", orgIds),
    supabase.from("profiles").select("org_id, role").in("org_id", orgIds),
    supabase.from("course_offerings").select("id, org_id").in("org_id", orgIds),
    supabase.from("assignments").select("id, offering_id"),
  ]);

  const adminByOrg = new Map<string, NonNullable<typeof admins>[number]>();
  for (const a of admins ?? []) {
    const existing = adminByOrg.get(a.org_id);
    if (!existing || (a.is_main_admin && !existing.is_main_admin)) adminByOrg.set(a.org_id, a);
  }
  const studentCounts = new Map<string, number>();
  for (const s of students ?? []) studentCounts.set(s.org_id, (studentCounts.get(s.org_id) ?? 0) + 1);
  const assistantCounts = new Map<string, number>();
  const headCounts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.role === "assistant") assistantCounts.set(p.org_id, (assistantCounts.get(p.org_id) ?? 0) + 1);
    if (p.role === "head") headCounts.set(p.org_id, (headCounts.get(p.org_id) ?? 0) + 1);
  }
  const courseCounts = new Map<string, number>();
  const offeringOrgById = new Map<string, string>();
  for (const o of offerings ?? []) {
    courseCounts.set(o.org_id, (courseCounts.get(o.org_id) ?? 0) + 1);
    offeringOrgById.set(o.id, o.org_id);
  }
  const assignmentCounts = new Map<string, number>();
  for (const a of assignments ?? []) {
    const orgId = offeringOrgById.get(a.offering_id);
    if (!orgId) continue;
    assignmentCounts.set(orgId, (assignmentCounts.get(orgId) ?? 0) + 1);
  }

  return orgs.map((o) => {
    const admin = adminByOrg.get(o.id);
    return {
      id: o.id,
      name: o.name,
      mark: markOf(o.name),
      primaryColor: o.primary_color,
      adminName: admin?.full_name ?? null,
      adminPhone: admin?.phone ?? null,
      adminEmail: admin?.email ?? null,
      adminId: admin?.id ?? null,
      status: o.status as OrgOverview["status"],
      metrics: {
        students: studentCounts.get(o.id) ?? 0,
        assistants: assistantCounts.get(o.id) ?? 0,
        heads: headCounts.get(o.id) ?? 0,
        courses: courseCounts.get(o.id) ?? 0,
        assignments: assignmentCounts.get(o.id) ?? 0,
      },
    };
  });
}

export async function createOrganization(input: { name: string; adminName: string; adminPhone: string; adminEmail: string }): Promise<{ id: string }> {
  await requireOwner();
  if (!input.name.trim()) throw new Error("Organization name is required");
  if (!input.adminEmail.trim()) throw new Error("Admin email is required");

  const admin = createAdminClient();
  const mark = markOf(input.name);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: input.name.trim(), brand_name: input.name.trim(), logo_letter: mark.slice(0, 1) || "R", status: "trial" })
    .select("id")
    .single();
  if (orgError || !org) throw new Error(orgError?.message ?? "Failed to create organization");

  const { data: created, error: createError } = await admin.auth.admin.createUser({ email: input.adminEmail.trim(), email_confirm: true });
  if (createError || !created.user) {
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error(createError?.message ?? "Failed to create the admin account");
  }

  const adminInitials = markOf(input.adminName || input.adminEmail);
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    org_id: org.id,
    role: "admin",
    full_name: input.adminName.trim() || input.adminEmail.trim(),
    initials: adminInitials || "AD",
    email: input.adminEmail.trim(),
    phone: input.adminPhone || null,
    is_main_admin: true,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await admin.from("organizations").delete().eq("id", org.id);
    throw new Error(profileError.message);
  }

  return { id: org.id };
}

export async function updateOrganization(
  orgId: string,
  patch: { name: string; adminId: string | null; adminName: string; adminPhone: string }
) {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ name: patch.name.trim() }).eq("id", orgId);
  if (error) throw new Error(error.message);

  if (patch.adminId) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ full_name: patch.adminName.trim(), initials: markOf(patch.adminName) || "AD", phone: patch.adminPhone || null })
      .eq("id", patch.adminId);
    if (profileError) throw new Error(profileError.message);
  }
}

export async function setOrgStatus(orgId: string, status: "active" | "trial" | "suspended") {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ status }).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function deleteOrganization(orgId: string) {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").delete().eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function getOwnerLoginAsLink(targetProfileId: string, redirectTo: string): Promise<{ url: string }> {
  await requireOwner();
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("email").eq("id", targetProfileId).single();
  if (!target) throw new Error("User not found");

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.email, options: { redirectTo } });
  if (error || !data) throw new Error(error?.message ?? "Couldn't create a login link");
  return { url: data.properties.action_link };
}

export type OwnerDashboard = { kpis: Kpi[] };

export async function getOwnerDashboard(): Promise<OwnerDashboard> {
  const orgs = await listOrgsOverview();
  const totalStudents = orgs.reduce((s, o) => s + o.metrics.students, 0);
  const totalCourses = orgs.reduce((s, o) => s + o.metrics.courses, 0);
  const activeOrgs = orgs.filter((o) => o.status === "active").length;

  const kpis: Kpi[] = [
    { icon: "building", value: String(orgs.length), label: "Organizations", tone: "brand" },
    { icon: "check", value: String(activeOrgs), label: "Active organizations", tone: "ok" },
    { icon: "grad", value: totalStudents.toLocaleString(), label: "Total students", tone: "neutral" },
    { icon: "clipboard-list", value: String(totalCourses), label: "Total courses", tone: "neutral" },
  ];

  return { kpis };
}

export type PlatformStaffMember = {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string | null;
  role: Role;
  orgId: string;
  orgName: string;
  joinedAt: string;
  isMainAdmin: boolean;
};

const STAFF_PAGE_SIZE = 20;

export async function listAllStaff(params: { page?: number; search?: string; role?: Role | "all" } = {}): Promise<{
  rows: PlatformStaffMember[];
  total: number;
  pageSize: number;
}> {
  await requireOwner();
  const supabase = await createClient();
  const page = params.page ?? 0;
  const pageSize = STAFF_PAGE_SIZE;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select("id, full_name, initials, email, phone, role, org_id, created_at, is_main_admin, organizations(name)", { count: "exact" })
    .order("full_name", { ascending: true });

  if (params.search?.trim()) {
    const term = params.search.trim();
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  if (params.role && params.role !== "all") query = query.eq("role", params.role);

  const { data, count } = await query.range(from, to);

  const rows = (data ?? [])
    .map((p) => {
      const org = Array.isArray(p.organizations) ? p.organizations[0] : p.organizations;
      if (!org) return null;
      return {
        id: p.id,
        name: p.full_name,
        initials: p.initials,
        email: p.email,
        phone: p.phone,
        role: p.role as Role,
        orgId: p.org_id,
        orgName: org.name,
        joinedAt: p.created_at,
        isMainAdmin: !!p.is_main_admin,
      };
    })
    .filter((x): x is PlatformStaffMember => !!x);

  return { rows, total: count ?? rows.length, pageSize };
}

export async function updateAnyStaffRole(id: string, role: Role) {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeAnyStaffMember(id: string) {
  await requireOwner();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
}

export type SystemOverview = {
  usersByRole: { role: string; n: number; barW: string }[];
  orgsByStatus: { status: string; n: number }[];
  recentSignups: { name: string; role: string; orgName: string; createdAt: string }[];
};

export async function getSystemOverview(): Promise<SystemOverview> {
  await requireOwner();
  const supabase = await createClient();

  const { data: profiles } = await supabase.from("profiles").select("full_name, role, created_at, organizations(name)").order("created_at", { ascending: false });
  const { data: orgs } = await supabase.from("organizations").select("status");

  const roleCounts = new Map<string, number>();
  for (const p of profiles ?? []) {
    if (p.role === "owner") continue;
    roleCounts.set(p.role, (roleCounts.get(p.role) ?? 0) + 1);
  }
  const maxRole = Math.max(1, ...Array.from(roleCounts.values()));
  const roleLabel: Record<string, string> = { admin: "Admin", hr: "HR", head: "Head", assistant: "Assistant", registration: "Registration", finance: "Finance" };
  const usersByRole = Array.from(roleCounts.entries())
    .map(([role, n]) => ({ role: roleLabel[role] ?? role, n, barW: `${Math.round((n / maxRole) * 100)}%` }))
    .sort((a, b) => b.n - a.n);

  const statusCounts = new Map<string, number>();
  for (const o of orgs ?? []) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  const orgsByStatus = Array.from(statusCounts.entries()).map(([status, n]) => ({ status, n }));

  const recentSignups = (profiles ?? []).slice(0, 8).map((p) => {
    const org = Array.isArray(p.organizations) ? p.organizations[0] : p.organizations;
    return { name: p.full_name, role: roleLabel[p.role] ?? p.role, orgName: org?.name ?? "—", createdAt: p.created_at };
  });

  return { usersByRole, orgsByStatus, recentSignups };
}
