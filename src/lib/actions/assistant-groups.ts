"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

export type GroupStudent = { id: string; enrollmentId: string; name: string; initials: string };
export type AssistantGroup = { id: string; name: string; initials: string; whatsappLink: string | null; students: GroupStudent[] };
export type UnassignedStudent = { enrollmentId: string; studentId: string; name: string; initials: string };

export type StaffingRequest = {
  id: string;
  kind: "add" | "remove" | "replace";
  targetName: string | null;
  candidateName: string | null;
  status: string;
  createdAt: string;
  offeringLabel: string | null;
};

export async function getAssistantGroups(offeringId: string): Promise<{ groups: AssistantGroup[]; unassigned: UnassignedStudent[] }> {
  const supabase = await createClient();

  const { data: assistantLinks } = await supabase
    .from("offering_assistants")
    .select("profiles(id, full_name, initials, student_whatsapp_link)")
    .eq("offering_id", offeringId);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id, assistant_id, students(id, name, initials, left_at)")
    .eq("offering_id", offeringId);

  const groups: AssistantGroup[] = (assistantLinks ?? [])
    .map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!p) return null;
      const students = (enrollments ?? [])
        .filter((e) => e.assistant_id === p.id)
        .map((e) => {
          const s = Array.isArray(e.students) ? e.students[0] : e.students;
          return s ? { id: s.id, enrollmentId: e.id, name: s.name, initials: s.initials } : null;
        })
        .filter((x): x is GroupStudent => !!x)
        .sort((a, b) => a.name.localeCompare(b.name));
      return { id: p.id, name: p.full_name, initials: p.initials, whatsappLink: p.student_whatsapp_link ?? null, students };
    })
    .filter((x): x is AssistantGroup => !!x);

  // A left student with no assistant shouldn't show up as "unassigned" to
  // reassign manually, and definitely shouldn't get swept into an assistant's
  // workload by auto-assign — they're gone, not waiting for staffing.
  const unassigned: UnassignedStudent[] = (enrollments ?? [])
    .filter((e) => !e.assistant_id)
    .map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      return s && !s.left_at ? { enrollmentId: e.id, studentId: s.id, name: s.name, initials: s.initials } : null;
    })
    .filter((x): x is UnassignedStudent => !!x);

  return { groups, unassigned };
}

export async function reassignToGroup(enrollmentId: string, assistantId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").update({ assistant_id: assistantId }).eq("id", enrollmentId);
  if (error) throw new Error(error.message);
}

export async function setAssistantWhatsappLink(assistantId: string, link: string) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin") || !profile.org) throw new Error("Not authorized");

  // profiles has no RLS UPDATE policy, so this goes through the admin
  // client — scope it to assistants in the caller's own org so a head
  // can't rewrite another organization's data.
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("org_id, role").eq("id", assistantId).single();
  if (!target || target.org_id !== profile.org.id || target.role !== "assistant") throw new Error("Not authorized");

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ student_whatsapp_link: link.trim() || null }).eq("id", assistantId);
  if (error) throw new Error(error.message);
}

export async function getOfferingParentWhatsappLink(offeringId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("course_offerings").select("parent_whatsapp_link").eq("id", offeringId).single();
  return data?.parent_whatsapp_link ?? null;
}

export async function setOfferingParentWhatsappLink(offeringId: string, link: string) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin") || !profile.org) throw new Error("Not authorized");

  const supabase = await createClient();
  const { data: offering } = await supabase.from("course_offerings").select("org_id").eq("id", offeringId).single();
  if (!offering || offering.org_id !== profile.org.id) throw new Error("Not authorized");

  const { error } = await supabase.from("course_offerings").update({ parent_whatsapp_link: link.trim() || null }).eq("id", offeringId);
  if (error) throw new Error(error.message);
}

export type AssistantWorkload = { id: string; name: string; initials: string; currentCount: number; maxStudents: number | null };

// currentCount is students already assigned to this assistant on this
// offering — heads use it alongside maxStudents to judge remaining capacity
// before picking who to include in an auto-assign run.
export async function getAssistantWorkloads(offeringId: string): Promise<AssistantWorkload[]> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("offering_assistants")
    .select("max_students, profiles(id, full_name, initials)")
    .eq("offering_id", offeringId);

  const { data: enrollments } = await supabase.from("enrollments").select("assistant_id").eq("offering_id", offeringId);
  const counts = new Map<string, number>();
  for (const e of enrollments ?? []) {
    if (!e.assistant_id) continue;
    counts.set(e.assistant_id, (counts.get(e.assistant_id) ?? 0) + 1);
  }

  return (links ?? [])
    .map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      if (!p) return null;
      return { id: p.id, name: p.full_name, initials: p.initials, currentCount: counts.get(p.id) ?? 0, maxStudents: row.max_students };
    })
    .filter((x): x is AssistantWorkload => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setAssistantMaxStudents(offeringId: string, assistantId: string, maxStudents: number | null) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "head" && profile.role !== "admin")) throw new Error("Not authorized");
  const supabase = await createClient();
  const { error } = await supabase
    .from("offering_assistants")
    .update({ max_students: maxStudents })
    .eq("offering_id", offeringId)
    .eq("assistant_id", assistantId);
  if (error) throw new Error(error.message);
}

export async function autoAssignUnassigned(offeringId: string, strategy: "equal" | "alpha", includeAssistantIds?: string[]) {
  const supabase = await createClient();
  const { groups, unassigned } = await getAssistantGroups(offeringId);
  const workloads = await getAssistantWorkloads(offeringId);
  if (!groups.length || !unassigned.length) return;

  const eligible = includeAssistantIds ? groups.filter((g) => includeAssistantIds.includes(g.id)) : groups;
  if (!eligible.length) return;

  const maxByAssistant = new Map(workloads.map((w) => [w.id, w.maxStudents]));
  const capacities = new Map<string, number>(
    eligible.map((g) => {
      const max = maxByAssistant.get(g.id) ?? null;
      const remaining = max == null ? Number.POSITIVE_INFINITY : Math.max(0, max - g.students.length);
      return [g.id, remaining];
    })
  );

  const updates: { id: string; assistant_id: string }[] = [];

  if (strategy === "alpha") {
    const pool = unassigned.slice().sort((a, b) => a.name.localeCompare(b.name));
    let idx = 0;
    const capacitated = eligible.filter((g) => (capacities.get(g.id) ?? 0) > 0);
    for (let gi = 0; gi < capacitated.length && idx < pool.length; gi++) {
      const g = capacitated[gi];
      const cap = capacities.get(g.id) ?? 0;
      const groupsLeft = capacitated.length - gi;
      const share = Math.min(cap, Math.ceil((pool.length - idx) / groupsLeft));
      for (let k = 0; k < share && idx < pool.length; k++) {
        updates.push({ id: pool[idx].enrollmentId, assistant_id: g.id });
        idx++;
      }
    }
  } else {
    const pool = unassigned.slice();
    let gi = 0;
    let idx = 0;
    while (idx < pool.length) {
      let attempts = 0;
      while (attempts < eligible.length && (capacities.get(eligible[gi].id) ?? 0) <= 0) {
        gi = (gi + 1) % eligible.length;
        attempts++;
      }
      const cap = capacities.get(eligible[gi].id) ?? 0;
      if (cap <= 0) break;
      updates.push({ id: pool[idx].enrollmentId, assistant_id: eligible[gi].id });
      capacities.set(eligible[gi].id, cap - 1);
      idx++;
      gi = (gi + 1) % eligible.length;
    }
  }

  for (const u of updates) {
    const { error } = await supabase.from("enrollments").update({ assistant_id: u.assistant_id }).eq("id", u.id);
    if (error) throw new Error(error.message);
  }
}

export async function listStaffingRequests(): Promise<StaffingRequest[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("staffing_requests")
    .select("id, kind, status, created_at, target_assistant_id, candidate_name, profiles!staffing_requests_target_assistant_id_fkey(full_name), course_offerings(session, unit, courses(name))")
    .eq("requested_by", profile.id)
    .order("created_at", { ascending: false });

  return (data ?? []).map((r) => {
    const target = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const offering = Array.isArray(r.course_offerings) ? r.course_offerings[0] : r.course_offerings;
    const course = offering ? (Array.isArray(offering.courses) ? offering.courses[0] : offering.courses) : null;
    return {
      id: r.id,
      kind: r.kind as StaffingRequest["kind"],
      status: r.status,
      createdAt: r.created_at,
      targetName: target?.full_name ?? null,
      candidateName: r.candidate_name,
      offeringLabel: offering ? [course?.name, offering.session, offering.unit].filter(Boolean).join(" · ") : null,
    };
  });
}

export async function createStaffingRequest(input: {
  offeringId: string;
  kind: "add" | "remove" | "replace";
  targetAssistantId: string | null;
  candidateName: string;
  candidatePhone: string;
  candidateEmail: string;
  reason: string;
  proposedDate: string;
  leaveDate?: string;
  gaveNotice?: boolean;
}) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase.from("staffing_requests").insert({
    org_id: profile.org.id,
    offering_id: input.offeringId,
    kind: input.kind,
    target_assistant_id: input.targetAssistantId,
    candidate_name: input.candidateName || null,
    candidate_phone: input.candidatePhone || null,
    candidate_email: input.candidateEmail || null,
    reason: input.reason || null,
    requested_by: profile.id,
    proposed_date: input.proposedDate || null,
    leave_date: input.kind === "replace" ? input.leaveDate || null : null,
    gave_notice: input.kind === "add" ? null : input.gaveNotice ?? null,
  });
  if (error) throw new Error(error.message);

  await notifyHrAndAdminOfPendingRequest(supabase, profile.org.id, profile.fullName, input);
}

// HR/admin only see pending requests in-app when they happen to check the
// bell — email closes the gap for anyone not actively watching the app.
// Best-effort: a failed email must never surface as a failure to submit
// the request itself, so errors are swallowed inside sendEmail already.
async function notifyHrAndAdminOfPendingRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  requesterName: string,
  input: { offeringId: string; kind: "add" | "remove" | "replace"; candidateName: string; reason: string }
) {
  const [{ data: recipients }, { data: offering }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("email").eq("org_id", orgId).in("role", ["hr", "admin"]).is("left_at", null),
    supabase.from("course_offerings").select("session, unit, courses(name)").eq("id", input.offeringId).maybeSingle(),
    supabase.from("organizations").select("brand_name, primary_color").eq("id", orgId).maybeSingle(),
  ]);
  const emails = (recipients ?? []).map((r) => r.email).filter((e): e is string => !!e);
  if (!emails.length) return;

  const course = offering ? (Array.isArray(offering.courses) ? offering.courses[0] : offering.courses) : null;
  const offeringLabel = offering ? [course?.name, offering.session, offering.unit].filter(Boolean).join(" · ") : "a course";
  const kindLabel = input.kind === "add" ? "New assistant request" : input.kind === "remove" ? "Removal request" : "Replacement request";
  const brandName = org?.brand_name || "RadAMS";
  const primaryColor = org?.primary_color || "#2563eb";

  await sendEmail({
    to: emails,
    subject: `${kindLabel} pending approval — ${offeringLabel}`,
    fromName: brandName,
    html: renderBrandedEmail({
      brandName,
      primaryColor,
      bodyHtml: `
        <p><strong>${requesterName}</strong> submitted a staffing request that needs your approval.</p>
        <ul>
          <li><strong>Type:</strong> ${kindLabel}</li>
          <li><strong>Course:</strong> ${offeringLabel}</li>
          ${input.candidateName ? `<li><strong>Candidate:</strong> ${input.candidateName}</li>` : ""}
          ${input.reason ? `<li><strong>Reason:</strong> ${input.reason}</li>` : ""}
        </ul>
        <p>Review it in the ${brandName} Staffing Requests tab.</p>
      `,
    }),
  });
}

export async function cancelStaffingRequest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("staffing_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
