// Provisions a demo organization and one user per role, using the same
// personas the design used (RadAMS.dc.html `meta()`), so the seeded app
// matches what was designed. Requires SUPABASE_SERVICE_ROLE_KEY (never
// expose this key to the client).
//
// Run with: npm run seed

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your environment (.env.local)."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_NAME = "Cambridge Prep Center";

const PEOPLE: Array<{
  role:
    | "owner"
    | "admin"
    | "hr"
    | "head"
    | "assistant"
    | "registration"
    | "finance";
  name: string;
  initials: string;
  email: string;
  scopedToOrg: boolean;
}> = [
  { role: "owner", name: "Daniel Okafor", initials: "DO", email: "owner@radams.dev", scopedToOrg: false },
  { role: "admin", name: "Sara Mensah", initials: "SM", email: "admin@radams.dev", scopedToOrg: true },
  { role: "hr", name: "Lena Farouk", initials: "LF", email: "hr@radams.dev", scopedToOrg: true },
  { role: "head", name: "Marcus Bell", initials: "MB", email: "head@radams.dev", scopedToOrg: true },
  { role: "assistant", name: "Priya Nair", initials: "PN", email: "assistant@radams.dev", scopedToOrg: true },
  { role: "registration", name: "Omar Haddad", initials: "OH", email: "registration@radams.dev", scopedToOrg: true },
  { role: "finance", name: "Grace Lim", initials: "GL", email: "finance@radams.dev", scopedToOrg: true },
];

async function main() {
  console.log(`Creating organization "${ORG_NAME}"...`);
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME, brand_name: "RadAMS", logo_letter: "R" })
    .select()
    .single();

  if (orgError) throw orgError;
  console.log(`Organization created: ${org.id}`);

  for (const person of PEOPLE) {
    const { data: created, error: createError } =
      await supabase.auth.admin.createUser({
        email: person.email,
        email_confirm: true,
      });

    if (createError) {
      console.error(`Failed to create auth user for ${person.email}:`, createError.message);
      continue;
    }

    const { error: profileError } = await supabase.from("profiles").insert({
      id: created.user.id,
      org_id: person.scopedToOrg ? org.id : null,
      role: person.role,
      full_name: person.name,
      initials: person.initials,
      email: person.email,
    });

    if (profileError) {
      console.error(`Failed to create profile for ${person.email}:`, profileError.message);
      continue;
    }

    console.log(`Seeded ${person.role.padEnd(12)} ${person.email}`);
  }

  console.log("\nDone. Sign in with any of the emails above via the email + code login flow.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
