"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = createAdminClient();

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("email", normalizedEmail)
    .eq("success", false)
    .gte("created_at", since);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return { error: `Too many failed attempts. Try again in ${WINDOW_MINUTES} minutes.` };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

  await admin.from("login_attempts").insert({ email: normalizedEmail, success: !error });

  if (error) {
    return { error: error.message || "Something went wrong. Please try again." };
  }
  return { error: null };
}
