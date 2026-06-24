"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type GroupStudent = { id: string; enrollmentId: string; name: string; initials: string };
export type AssistantGroup = { id: string; name: string; initials: string; students: GroupStudent[] };
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
    .select("profiles(id, full_name, initials)")
    .eq("offering_id", offeringId);

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, student_id, assistant_id, students(id, name, initials)")
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
      return { id: p.id, name: p.full_name, initials: p.initials, students };
    })
    .filter((x): x is AssistantGroup => !!x);

  const unassigned: UnassignedStudent[] = (enrollments ?? [])
    .filter((e) => !e.assistant_id)
    .map((e) => {
      const s = Array.isArray(e.students) ? e.students[0] : e.students;
      return s ? { enrollmentId: e.id, studentId: s.id, name: s.name, initials: s.initials } : null;
    })
    .filter((x): x is UnassignedStudent => !!x);

  return { groups, unassigned };
}

export async function reassignToGroup(enrollmentId: string, assistantId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").update({ assistant_id: assistantId }).eq("id", enrollmentId);
  if (error) throw new Error(error.message);
}

export async function autoAssignUnassigned(offeringId: string, strategy: "equal" | "alpha") {
  const supabase = await createClient();
  const { groups, unassigned } = await getAssistantGroups(offeringId);
  if (!groups.length || !unassigned.length) return;

  let pool = unassigned.slice();
  if (strategy === "alpha") pool = pool.slice().sort((a, b) => a.name.localeCompare(b.name));

  const updates: { id: string; assistant_id: string }[] = [];
  if (strategy === "alpha") {
    const per = Math.ceil(pool.length / groups.length);
    pool.forEach((st, idx) => {
      const g = groups[Math.min(groups.length - 1, Math.floor(idx / per))];
      updates.push({ id: st.enrollmentId, assistant_id: g.id });
    });
  } else {
    pool.forEach((st, idx) => {
      const g = groups[idx % groups.length];
      updates.push({ id: st.enrollmentId, assistant_id: g.id });
    });
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
  });
  if (error) throw new Error(error.message);
}

export async function cancelStaffingRequest(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("staffing_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
