"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getPlatformDefaultBranding } from "@/lib/actions/branding";
import { sendEmail, renderBrandedEmail } from "@/lib/email";

export type Lead = {
  id: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  country: string;
  studentRange: string;
  message: string | null;
  status: "new" | "contacted" | "closed";
  createdAt: string;
};

export type LeadSubmission = {
  name: string;
  organization: string;
  email: string;
  phone: string;
  country: string;
  studentRange: string;
  message: string;
};

// Falls back to whoever actually holds the owner role right now, rather
// than a hardcoded address — the fallback needs to keep working even if
// LEADS_NOTIFY_EMAIL is never set in Vercel, and especially if ownership of
// the account ever changes. Sends to every owner profile found, in case
// there's ever more than one.
async function getOwnerNotifyEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("email").eq("role", "owner");
  return (data ?? []).map((p) => p.email).filter((e): e is string => !!e);
}

// Submitted from the public landing page by a signed-out visitor, so there
// is no session for RLS to scope against — the service-role client is the
// only way to write this row, matching the pattern already used elsewhere
// (e.g. branding.ts) for privileged writes that bypass RLS on purpose.
export async function submitLead(input: LeadSubmission): Promise<void> {
  const name = input.name.trim();
  const organization = input.organization.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const country = input.country.trim();
  const studentRange = input.studentRange.trim();
  if (!name || !organization || !email || !phone || !country || !studentRange) {
    throw new Error("Please fill in all required fields.");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("leads").insert({
    name,
    organization,
    email,
    phone,
    country,
    student_range: studentRange,
    message: input.message.trim() || null,
  });
  if (error) throw new Error(error.message);

  const branding = await getPlatformDefaultBranding();
  const notifyTo = process.env.LEADS_NOTIFY_EMAIL ? [process.env.LEADS_NOTIFY_EMAIL] : await getOwnerNotifyEmails();
  if (!notifyTo.length) return;
  await sendEmail({
    to: notifyTo,
    subject: `New lead: ${organization}`,
    fromName: branding.name,
    html: renderBrandedEmail({
      brandName: branding.name,
      primaryColor: branding.primary,
      bodyHtml: `
        <p>A new lead came in from the landing page.</p>
        <ul>
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Organization:</strong> ${organization}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Country:</strong> ${country}</li>
          <li><strong>Students:</strong> ${studentRange}</li>
        </ul>
        ${input.message.trim() ? `<p><strong>Message:</strong><br/>${input.message.trim()}</p>` : ""}
      `,
    }),
  });
}

async function requireOwner() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "owner") throw new Error("Not authorized");
  return profile;
}

function mapLead(row: {
  id: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  country: string;
  student_range: string;
  message: string | null;
  status: string;
  created_at: string;
}): Lead {
  return {
    id: row.id,
    name: row.name,
    organization: row.organization,
    email: row.email,
    phone: row.phone,
    country: row.country,
    studentRange: row.student_range,
    message: row.message,
    status: row.status as Lead["status"],
    createdAt: row.created_at,
  };
}

export async function listLeads(): Promise<Lead[]> {
  await requireOwner();
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapLead);
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteLead(id: string): Promise<void> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
