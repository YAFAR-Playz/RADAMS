import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only ever import this from
// "use server" action files; never expose it to client components.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY — required to create or remove staff accounts.");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
