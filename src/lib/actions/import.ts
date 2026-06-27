"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { createPaymentPlan } from "@/lib/actions/payments";

export type ImportRow = {
  name: string;
  phone: string;
  email: string;
  guardianName: string;
  guardianPhone: string;
};

export async function importStudents(offeringId: string, rows: ImportRow[]): Promise<{ imported: number }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const valid = rows.filter((r) => r.name.trim().length > 0);
  if (!valid.length) return { imported: 0 };

  const { data: created, error } = await supabase
    .from("students")
    .insert(
      valid.map((r) => ({
        org_id: profile.org!.id,
        name: r.name.trim(),
        initials: r.name
          .trim()
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        phone: r.phone || null,
        email: r.email || null,
        guardian_name: r.guardianName || null,
        guardian_phone: r.guardianPhone || null,
      }))
    )
    .select("id");
  if (error || !created) throw new Error(error?.message ?? "Failed to import students");

  const { error: enrollError } = await supabase
    .from("enrollments")
    .insert(created.map((s) => ({ student_id: s.id, offering_id: offeringId })));
  if (enrollError) throw new Error(enrollError.message);

  for (const s of created) {
    await createPaymentPlan({ studentId: s.id, offeringId, planType: "full" });
  }

  return { imported: created.length };
}
