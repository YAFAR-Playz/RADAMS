"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { createPaymentPlan } from "@/lib/actions/payments";
import { logActivity } from "@/lib/actions/activity-log";

export type ImportRow = {
  name: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
};

export type ImportOutcome = { imported: number; merged: number };

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type ExistingStudent = { id: string; name: string; phone: string | null; email: string | null; guardian_phone: string | null };

// "strong": name + the student's own email/phone match — safe to auto-merge.
// "weak": name + only the guardian phone match — a shared guardian phone
// (siblings' actual guardian, or an agent/relative's number reused across
// unrelated families) is common enough that this must NOT auto-merge; it's
// surfaced to the user in the preview step and only merged if they confirm it.
export type MatchConfidence = "strong" | "weak";
export type MatchInfo = { id: string; name: string; confidence: MatchConfidence };

function findMatch(row: ImportRow, existing: ExistingStudent[]): MatchInfo | null {
  const name = row.name.trim().toLowerCase();
  const email = row.email.trim().toLowerCase();
  const phone = row.phone.trim();
  const guardianPhone = row.guardianPhone.trim();

  for (const s of existing) {
    if (s.name.trim().toLowerCase() !== name) continue;
    const emailMatch = !!email && !!s.email && s.email.toLowerCase() === email;
    const phoneMatch = !!phone && !!s.phone && s.phone === phone;
    const guardianMatch = !!guardianPhone && !!s.guardian_phone && s.guardian_phone === guardianPhone;
    if (emailMatch || phoneMatch) return { id: s.id, name: s.name, confidence: "strong" };
    if (guardianMatch) return { id: s.id, name: s.name, confidence: "weak" };
  }
  return null;
}

// A student enrolled only in course(s) that have since been deactivated is
// effectively archived — their contact info may be stale, and the course
// they were on is no longer selectable anywhere, so a fresh import for a
// new/current offering should create a new, visible record for them rather
// than silently matching into a hidden one. Students with no enrollment yet
// (freshly added but not yet enrolled anywhere), or with at least one
// enrollment in a still-active offering, remain eligible to match against.
async function fetchDedupCandidates(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<ExistingStudent[]> {
  // Paginated: an org accumulating more than 1,000 total students (this
  // codebase's flagship large table) had this unbounded select silently
  // truncate, so every import run after that point stopped seeing older
  // students at all — dedup matching failed for them and duplicate records
  // got created instead of merging.
  const existing: ExistingStudent[] = [];
  const STUDENT_PAGE_SIZE = 1000;
  for (let from = 0; ; from += STUDENT_PAGE_SIZE) {
    const { data: page } = await supabase
      .from("students")
      .select("id, name, phone, email, guardian_phone")
      .eq("org_id", orgId)
      .range(from, from + STUDENT_PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    existing.push(...page);
    if (page.length < STUDENT_PAGE_SIZE) break;
  }
  if (!existing.length) return existing;

  // Scoped only to this org's own students, but that set can itself run
  // into the thousands, both risking the same 1000-row cap on the result
  // and building a `.in()` filter with one UUID per student — for a large
  // org that's tens of thousands of characters, past what a GET request's
  // URL can carry, silently failing the whole query. Paginated over the
  // student ids in URL-safe batches, with each batch's own row pagination.
  const studentIds = existing.map((s) => s.id);
  const ID_BATCH_SIZE = 200;
  const ENROLLMENT_PAGE_SIZE = 1000;
  const enrollmentRows: { student_id: string; course_offerings: { active: boolean } | { active: boolean }[] | null }[] = [];
  for (let i = 0; i < studentIds.length; i += ID_BATCH_SIZE) {
    const idBatch = studentIds.slice(i, i + ID_BATCH_SIZE);
    for (let from = 0; ; from += ENROLLMENT_PAGE_SIZE) {
      const { data: page } = await supabase
        .from("enrollments")
        .select("student_id, course_offerings(active)")
        .in("student_id", idBatch)
        .range(from, from + ENROLLMENT_PAGE_SIZE - 1);
      if (!page || page.length === 0) break;
      enrollmentRows.push(...page);
      if (page.length < ENROLLMENT_PAGE_SIZE) break;
    }
  }

  const hasAny = new Set<string>();
  const hasActive = new Set<string>();
  for (const row of enrollmentRows) {
    hasAny.add(row.student_id);
    const offering = Array.isArray(row.course_offerings) ? row.course_offerings[0] : row.course_offerings;
    if (offering?.active) hasActive.add(row.student_id);
  }

  return existing.filter((s) => !hasAny.has(s.id) || hasActive.has(s.id));
}

// Lets the import preview show potential matches before the user commits.
// Strong matches will auto-merge; weak (guardian-phone-only) matches need
// the user to explicitly confirm before they're merged.
export async function previewExistingMatches(rows: ImportRow[]): Promise<Record<number, MatchInfo>> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return {};
  const supabase = await createClient();
  const existing = await fetchDedupCandidates(supabase, profile.org.id);

  const result: Record<number, MatchInfo> = {};
  rows.forEach((r, i) => {
    if (!r.name.trim()) return;
    const match = findMatch(r, existing);
    if (match) result[i] = match;
  });
  return result;
}

// A student already imported for one course who shows up again in an import
// for a different course must end up as one student with two enrollments,
// not two disconnected student records — this matches each row against the
// org's existing students before deciding whether to create a new one.
// `confirmedRowIndices` are rows the user explicitly confirmed are the same
// person despite only a weak (guardian-phone-only) match; every other weak
// match is treated as a distinct student to avoid merging unrelated siblings.
export async function importStudents(offeringId: string, rows: ImportRow[], confirmedRowIndices: number[] = []): Promise<ImportOutcome> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const orgId = profile.org.id;
  const supabase = await createClient();

  const valid = rows.filter((r) => r.name.trim().length > 0);
  if (!valid.length) return { imported: 0, merged: 0 };

  const confirmed = new Set(confirmedRowIndices);

  const existing = await fetchDedupCandidates(supabase, orgId);

  const rawMatches = valid.map((r) => findMatch(r, existing));
  const matches = rawMatches.map((m, i) => (m && (m.confidence === "strong" || confirmed.has(i)) ? m : null));
  const toCreate = valid.filter((_, i) => !matches[i]);

  let created: { id: string }[] = [];
  if (toCreate.length) {
    const { data, error } = await supabase
      .from("students")
      .insert(
        toCreate.map((r) => ({
          org_id: orgId,
          name: r.name.trim(),
          initials: initialsOf(r.name),
          phone: r.phone || null,
          email: r.email || null,
          guardian_name: r.guardianName || null,
          guardian_phone: r.guardianPhone || null,
        }))
      )
      .select("id");
    if (error || !data) throw new Error(error?.message ?? "Failed to import students");
    created = data;
  }

  // Walk the rows again in order, resolving each to its final student id —
  // either the existing match, or the next freshly-created row — and
  // backfill any contact fields the matched student was missing.
  const studentIds: string[] = [];
  let createdIdx = 0;
  let mergedCount = 0;
  for (let i = 0; i < valid.length; i++) {
    const match = matches[i];
    if (match) {
      studentIds.push(match.id);
      mergedCount++;
      const r = valid[i];
      const existingStudent = existing.find((s) => s.id === match.id);
      const patch: Record<string, string> = {};
      if (existingStudent && !existingStudent.phone && r.phone.trim()) patch.phone = r.phone.trim();
      if (existingStudent && !existingStudent.email && r.email.trim()) patch.email = r.email.trim();
      if (existingStudent && !existingStudent.guardian_phone && r.guardianPhone.trim()) patch.guardian_phone = r.guardianPhone.trim();
      if (Object.keys(patch).length) {
        await supabase.from("students").update(patch).eq("id", match.id);
      }
    } else {
      studentIds.push(created[createdIdx].id);
      createdIdx++;
    }
  }

  // enrollments has a unique (student_id, offering_id) constraint, so a
  // student who previously left THIS offering (or was re-imported before)
  // already holds that slot via their existing — possibly left — row.
  // Fetching left_at too (not just existence) lets a left row be reactivated
  // instead of silently skipped: the old behavior treated "a row exists" as
  // "already properly enrolled" regardless of left_at, so re-importing
  // someone who'd left this exact course never re-added them and they
  // stayed marked left forever. Mirrors addStudentEnrollment's fix for the
  // same case in the single-student "add to course" flow.
  const uniqueIds = Array.from(new Set(studentIds));
  const { data: existingEnrollmentRows } = uniqueIds.length
    ? await supabase.from("enrollments").select("id, student_id, left_at").eq("offering_id", offeringId).in("student_id", uniqueIds)
    : { data: [] as { id: string; student_id: string; left_at: string | null }[] };
  const existingByStudent = new Map((existingEnrollmentRows ?? []).map((e) => [e.student_id, e]));
  const toEnroll = uniqueIds.filter((id) => !existingByStudent.has(id));
  const toReactivate = uniqueIds.filter((id) => existingByStudent.get(id)?.left_at);

  if (toEnroll.length) {
    const { error: enrollError } = await supabase
      .from("enrollments")
      .insert(toEnroll.map((studentId) => ({ student_id: studentId, offering_id: offeringId })));
    if (enrollError) throw new Error(enrollError.message);

    for (const studentId of toEnroll) {
      await createPaymentPlan({ studentId, offeringId, planType: "full" });
    }
  }

  if (toReactivate.length) {
    const { error: reactivateError } = await supabase
      .from("enrollments")
      .update({ left_at: null })
      .in("id", toReactivate.map((studentId) => existingByStudent.get(studentId)!.id));
    if (reactivateError) throw new Error(reactivateError.message);
  }

  await logActivity(
    "students",
    `Imported ${toCreate.length} new student${toCreate.length === 1 ? "" : "s"}${mergedCount ? ` and matched ${mergedCount} existing student${mergedCount === 1 ? "" : "s"}` : ""} into this course`
  );

  return { imported: toCreate.length, merged: mergedCount };
}
