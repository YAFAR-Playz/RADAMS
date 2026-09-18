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
  // Only ever populated when the org has "Attendance ID matching" enabled
  // (see payroll-settings.ts) — an external id (e.g. a Zoom registration
  // id) later used to match attendance-session imports back to this
  // student. Empty string when not mapped, same convention as the other
  // optional fields here.
  attendanceId: string;
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

type ExistingStudent = { id: string; name: string; phone: string | null; email: string | null; guardian_phone: string | null; attendance_id: string | null };

// "strong": the student's own email/phone/attendance id matches — these are
// unique-per-person identifiers, so it's safe to auto-merge on them
// regardless of whether the name string matches exactly.
// "weak": only the name matches, with no phone/email/attendance id agreement
// — common names repeat across genuinely different students in these
// rosters (confirmed via several real sibling pairs found in production data
// that share a surname/guardian but are not the same person), so a bare name
// match must NOT auto-merge; it's surfaced to the user in the preview step
// and only merged if they confirm it.
//
// Guardian phone is deliberately NOT a match signal at all (dropped from the
// weak tier it used to anchor): a shared guardian phone alone — siblings'
// actual guardian, or an agent/relative's number reused across unrelated
// families — produced confirmed false positives when tested against real
// org data, and per the simpler dedup rule (name, then phone, then email;
// no match on any of the three means no dup) it isn't one of the signals
// that should ever flag a match.
export type MatchConfidence = "strong" | "weak";
// existingAttendanceId lets the preview step tell the user, per row, whether
// this student already has an attendance id on file (and whether it matches
// what's in the sheet) versus one that will be freshly backfilled on import.
export type MatchInfo = { id: string; name: string; confidence: MatchConfidence; existingAttendanceId: string | null };

// Strong matches used to also require the name string to match exactly —
// but re-typed sheets routinely spell the same real student's name
// differently (missing a middle name, "Basem" vs "Bassem", a doubled
// space), while their own phone/email/attendance id stays identical. That
// name requirement was silently defeating dedup for exactly those rows:
// confirmed in production for both orgs reporting this — matching pairs of
// student rows with identical phone AND guardian_phone but a slightly
// different name, created minutes/days apart by separate imports. Fixed by
// treating the student's own phone/email/attendance id as sufficient on its
// own; a name-only match (no phone/email/attendance id agreement) still
// flags as a weak match rather than being ignored entirely.
function findMatch(row: ImportRow, existing: ExistingStudent[]): MatchInfo | null {
  const name = row.name.trim().toLowerCase();
  const email = row.email.trim().toLowerCase();
  const phone = row.phone.trim();
  const attendanceId = row.attendanceId.trim();

  for (const s of existing) {
    const emailMatch = !!email && !!s.email && s.email.toLowerCase() === email;
    const phoneMatch = !!phone && !!s.phone && s.phone === phone;
    const attendanceIdMatch = !!attendanceId && !!s.attendance_id && s.attendance_id === attendanceId;
    if (emailMatch || phoneMatch || attendanceIdMatch) {
      return { id: s.id, name: s.name, confidence: "strong", existingAttendanceId: s.attendance_id };
    }
  }
  for (const s of existing) {
    if (!name || s.name.trim().toLowerCase() !== name) continue;
    return { id: s.id, name: s.name, confidence: "weak", existingAttendanceId: s.attendance_id };
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
      .select("id, name, phone, email, guardian_phone, attendance_id")
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
//
// `attendanceIdOnlyRowIndices` are rows with no guardian phone in the sheet
// at all — normally a hard error, since a brand-new student record needs it
// — that the UI let through anyway *because* the row strong-matches (own
// phone/email, not just a shared guardian phone) an existing student and is
// only there to backfill that student's attendance ID. These rows must
// never create a new student or touch enrollments; re-verified below rather
// than trusted from the client, since this is the one bypass of the
// guardian-phone requirement and it must not be exploitable to create an
// incomplete record.
export async function importStudents(
  offeringId: string,
  rows: ImportRow[],
  confirmedRowIndices: number[] = [],
  attendanceIdOnlyRowIndices: number[] = []
): Promise<ImportOutcome> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const orgId = profile.org.id;
  const supabase = await createClient();

  const valid = rows.filter((r) => r.name.trim().length > 0);
  if (!valid.length) return { imported: 0, merged: 0 };

  const confirmed = new Set(confirmedRowIndices);
  const attendanceIdOnly = new Set(attendanceIdOnlyRowIndices);

  const existing = await fetchDedupCandidates(supabase, orgId);

  const rawMatches = valid.map((r) => findMatch(r, existing));
  const matches = rawMatches.map((m, i) => (m && (m.confidence === "strong" || confirmed.has(i)) ? m : null));
  // A row marked attendanceIdOnly with no real (re-verified) match here is a
  // stale/tampered request, not a new student to create — guardian phone is
  // missing, so silently creating one would be exactly the incomplete
  // record this whole mechanism exists to prevent. Drop it instead.
  const toCreate = valid.filter((_, i) => !matches[i] && !attendanceIdOnly.has(i));

  // Two rows in the same sheet neither of which matched an existing student
  // (so both are about to be inserted as brand-new) can still share the same
  // attendance id by data-entry error — a bulk insert would then hit the
  // org's unique (org_id, attendance_id) constraint and abort with an opaque
  // "duplicate key value" error, failing every row in the batch rather than
  // just the offending two. Caught here with a specific, actionable message
  // instead (this is what was crashing real imports in production).
  const attendanceIdCounts = new Map<string, string[]>();
  for (const r of toCreate) {
    const id = r.attendanceId.trim();
    if (!id) continue;
    attendanceIdCounts.set(id, [...(attendanceIdCounts.get(id) ?? []), r.name.trim()]);
  }
  const collidingIds = Array.from(attendanceIdCounts.entries()).filter(([, names]) => names.length > 1);
  if (collidingIds.length) {
    const [id, names] = collidingIds[0];
    throw new Error(`Attendance ID "${id}" is used by more than one row in this sheet (${names.join(", ")}) - fix the sheet and try again.`);
  }

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
          attendance_id: r.attendanceId.trim() || null,
        }))
      )
      .select("id");
    if (error || !data) throw new Error(error?.message ?? "Failed to import students");
    created = data;
  }

  // Walk the rows again in order, resolving each to its final student id —
  // either the existing match, or the next freshly-created row — and
  // backfill any contact fields the matched student was missing.
  // attendanceIdOnly rows resolve to their matched student's id too (for the
  // patch below) but are never pushed into studentIds, since that array
  // feeds the enrollment step further down and these rows must not enroll.
  const studentIds: string[] = [];
  let createdIdx = 0;
  let mergedCount = 0;
  for (let i = 0; i < valid.length; i++) {
    const match = matches[i];
    const isAttendanceIdOnly = attendanceIdOnly.has(i);
    if (match) {
      if (!isAttendanceIdOnly) {
        studentIds.push(match.id);
        mergedCount++;
      }
      const r = valid[i];
      const existingStudent = existing.find((s) => s.id === match.id);
      const patch: Record<string, string> = {};
      if (existingStudent && !existingStudent.phone && r.phone.trim()) patch.phone = r.phone.trim();
      if (existingStudent && !existingStudent.email && r.email.trim()) patch.email = r.email.trim();
      if (existingStudent && !existingStudent.guardian_phone && r.guardianPhone.trim()) patch.guardian_phone = r.guardianPhone.trim();
      if (existingStudent && !existingStudent.attendance_id && r.attendanceId.trim()) patch.attendance_id = r.attendanceId.trim();
      if (Object.keys(patch).length) {
        await supabase.from("students").update(patch).eq("id", match.id);
      }
    } else if (!isAttendanceIdOnly) {
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
  // Batched in URL-safe chunks and paginated per batch — a large import run
  // (or a course with many prior imports) can push `uniqueIds` past both a
  // URL-safe `.in()` length and Postgrest's default 1000-row cap, same as
  // fetchDedupCandidates above.
  const uniqueIds = Array.from(new Set(studentIds));
  const existingEnrollmentRows: { id: string; student_id: string; left_at: string | null }[] = [];
  const ID_BATCH_SIZE = 200;
  const ENROLLMENT_PAGE_SIZE = 1000;
  for (let i = 0; i < uniqueIds.length; i += ID_BATCH_SIZE) {
    const idBatch = uniqueIds.slice(i, i + ID_BATCH_SIZE);
    for (let from = 0; ; from += ENROLLMENT_PAGE_SIZE) {
      const { data: page } = await supabase
        .from("enrollments")
        .select("id, student_id, left_at")
        .eq("offering_id", offeringId)
        .in("student_id", idBatch)
        .range(from, from + ENROLLMENT_PAGE_SIZE - 1);
      if (!page || page.length === 0) break;
      existingEnrollmentRows.push(...page);
      if (page.length < ENROLLMENT_PAGE_SIZE) break;
    }
  }
  const existingByStudent = new Map(existingEnrollmentRows.map((e) => [e.student_id, e]));
  const toEnroll = uniqueIds.filter((id) => !existingByStudent.has(id));
  const toReactivate = uniqueIds.filter((id) => existingByStudent.get(id)?.left_at);

  if (toEnroll.length) {
    // Upsert with ignoreDuplicates rather than a plain insert: a bulk insert
    // is one statement, so if a slow request gets retried (e.g. the user
    // re-submits after the page seemed to hang) and a second, concurrent
    // importStudents call computes the same toEnroll set, a single
    // conflicting row would abort this entire batch and enroll nobody. This
    // lets rows genuinely already enrolled by a concurrent run silently no-op
    // instead of failing every other row alongside them.
    const { error: enrollError } = await supabase
      .from("enrollments")
      .upsert(
        toEnroll.map((studentId) => ({ student_id: studentId, offering_id: offeringId })),
        { onConflict: "student_id,offering_id", ignoreDuplicates: true }
      );
    if (enrollError) throw new Error(enrollError.message);

    // Each payment plan is independent (its own insert, no shared state or
    // ordering dependency between students) — created concurrently instead
    // of one at a time, which was one full round trip per newly-enrolled
    // student on every import. Chunked at the same ID_BATCH_SIZE as the
    // .in() batches above rather than fired all at once: createPaymentPlan
    // is itself 3-4 sequential queries, so an all-new-student import (every
    // row in `toEnroll`) would otherwise open hundreds of chains of queries
    // simultaneously — batching keeps the concurrency bounded while still
    // running every batch's students in parallel.
    //
    // The same concurrent-retry race as above can reach here too — the
    // enrollments upsert above no-ops for a row a concurrent run already
    // enrolled, but createPaymentPlan doesn't know that and tries to create
    // a plan anyway, hitting payment_plans' own (student_id, offering_id)
    // unique constraint. That's a real production crash this surfaced
    // (a hard 500 with no user-facing message beyond a generic error
    // screen) rather than a hypothetical: a plan already existing for this
    // pair means a concurrent run is handling (or already handled) it, so
    // it's safe to skip here rather than treat it as a failure.
    for (let i = 0; i < toEnroll.length; i += ID_BATCH_SIZE) {
      const idBatch = toEnroll.slice(i, i + ID_BATCH_SIZE);
      await Promise.all(
        idBatch.map(async (studentId) => {
          try {
            await createPaymentPlan({ studentId, offeringId, planType: "full" });
          } catch (err) {
            const message = err instanceof Error ? err.message : "";
            if (!message.includes("payment_plans_student_id_offering_id_key")) throw err;
          }
        })
      );
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
