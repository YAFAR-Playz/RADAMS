"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authErrorMessage } from "@/lib/auth-error";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

async function countRecentFailures(normalizedEmail: string): Promise<number> {
  try {
    const admin = createAdminClient();
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", normalizedEmail)
      .eq("success", false)
      .gte("created_at", since);
    return count ?? 0;
  } catch {
    // Rate-limit bookkeeping is best-effort — never block a real login
    // attempt just because the logging table/service-role client is
    // unavailable.
    return 0;
  }
}

async function recordAttempt(normalizedEmail: string, success: boolean) {
  try {
    const admin = createAdminClient();
    await admin.from("login_attempts").insert({ email: normalizedEmail, success });
  } catch {
    // Best-effort logging only.
  }
}

export async function signInWithPassword(email: string, password: string): Promise<{ error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  const recentFailures = await countRecentFailures(normalizedEmail);
  if (recentFailures >= MAX_ATTEMPTS) {
    return { error: `Too many failed attempts. Try again in ${WINDOW_MINUTES} minutes.` };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

    await recordAttempt(normalizedEmail, !error);

    if (error) {
      return { error: authErrorMessage(error) };
    }
    return { error: null };
  } catch {
    return { error: "Something went wrong. Please try again." };
  }
}
