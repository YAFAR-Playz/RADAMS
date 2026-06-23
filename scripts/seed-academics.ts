// Provisions demo courses, offerings, students, enrollments, assignments and
// assignment logs for the org created by scripts/seed.ts, so the Assignments
// and Head oversight screens have real data to work against. Idempotent-ish:
// safe to re-run against a fresh org, but will duplicate rows if run twice
// against the same org. Requires SUPABASE_SERVICE_ROLE_KEY.
//
// Run with: npm run seed:academics

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

const FIRST = [
  "Aria", "Ben", "Ethan", "Hana", "Liam", "Mei", "Noah", "Omar", "Sofia", "Yara",
  "Chloe", "Diego", "Fatima", "Grace", "Henry", "Isla", "Jack", "Karim", "Lucy", "Marco",
  "Nadia", "Oscar", "Priya", "Quinn", "Rana", "Sam", "Tara", "Uma", "Victor", "Wendy",
];
const LAST = [
  "Khan", "Cohen", "Park", "Kim", "Carter", "Wong", "Bauer", "Sayed", "Rossi", "Haddad",
  "Adeyemi", "Luna", "Zahra", "Owusu", "Walsh", "Murphy", "Lee", "Adel", "Brennan", "Ricci",
  "Petrov", "Reyes", "Menon", "Foster", "Saleh", "Okonkwo", "Vidal", "Desai", "Hugo", "Tan",
];
const STATUSES = ["checked", "submitted", "late", "missing", "excused"] as const;
const COMMENT_BY_STATUS: Record<(typeof STATUSES)[number], string> = {
  checked: "Strong work",
  submitted: "Good attempt",
  late: "Handed in late",
  missing: "No submission yet",
  excused: "Approved absence",
};

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    console.error(`Couldn't find org "${ORG_NAME}" — run "npm run seed" first.`);
    process.exit(1);
  }

  const { data: head } = await supabase.from("profiles").select("id").eq("email", "head@radams.dev").single();
  const { data: assistant } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "assistant@radams.dev")
    .single();
  if (!head || !assistant) {
    console.error('Couldn\'t find "head@radams.dev" / "assistant@radams.dev" — run "npm run seed" first.');
    process.exit(1);
  }

  console.log("Creating courses & offerings...");
  const { data: physics } = await supabase.from("courses").insert({ org_id: org.id, name: "Physics" }).select().single();
  const { data: chemistry } = await supabase
    .from("courses")
    .insert({ org_id: org.id, name: "Chemistry" })
    .select()
    .single();
  if (!physics || !chemistry) throw new Error("Failed to create courses");

  const offeringDefs = [
    { course: physics.id, session: "June", unit: "Unit 1" },
    { course: physics.id, session: "Nov", unit: "Unit 1" },
    { course: physics.id, session: "June", unit: "Unit 2" },
    { course: chemistry.id, session: "June", unit: "Unit 1" },
  ];
  const offerings: { id: string }[] = [];
  for (const def of offeringDefs) {
    const { data, error } = await supabase
      .from("course_offerings")
      .insert({ org_id: org.id, course_id: def.course, session: def.session, unit: def.unit })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create offering");
    offerings.push(data);
  }

  console.log("Linking head + assistant to all offerings...");
  await supabase
    .from("offering_heads")
    .insert(offerings.map((o) => ({ offering_id: o.id, head_id: head.id })));
  await supabase
    .from("offering_assistants")
    .insert(offerings.map((o) => ({ offering_id: o.id, assistant_id: assistant.id })));

  console.log("Creating 30 students...");
  const studentIds: string[] = [];
  for (let i = 1; i <= 30; i++) {
    const first = FIRST[(i - 1) % FIRST.length];
    const last = LAST[(i * 13) % LAST.length];
    const { data, error } = await supabase
      .from("students")
      .insert({
        org_id: org.id,
        name: `${first} ${last}`,
        initials: (first[0] + last[0]).toUpperCase(),
        guardian_name: `${first} ${last}'s guardian`,
        guardian_phone: `+44 7700 900${100 + i}`,
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create student");
    studentIds.push(data.id);
  }

  console.log("Enrolling students into offerings...");
  await supabase.from("enrollments").insert(
    studentIds.map((id) => ({ student_id: id, offering_id: offerings[0].id, assistant_id: assistant.id }))
  );
  await supabase.from("enrollments").insert(
    studentIds.slice(0, 14).map((id) => ({ student_id: id, offering_id: offerings[1].id, assistant_id: assistant.id }))
  );
  await supabase.from("enrollments").insert(
    studentIds.slice(0, 8).map((id) => ({ student_id: id, offering_id: offerings[2].id, assistant_id: assistant.id }))
  );

  console.log("Creating assignments...");
  const { data: a1 } = await supabase
    .from("assignments")
    .insert({ offering_id: offerings[0].id, title: "Paper 3 — Mechanics", max_marks: 100, created_by: head.id })
    .select()
    .single();
  await supabase
    .from("assignments")
    .insert({ offering_id: offerings[0].id, title: "Paper 1 — Multiple Choice", max_marks: 100, created_by: head.id });
  await supabase
    .from("assignments")
    .insert({ offering_id: offerings[1].id, title: "Paper 3 — Mechanics", max_marks: 100, created_by: head.id });
  if (!a1) throw new Error("Failed to create first assignment");

  console.log("Logging sample statuses for the first assignment...");
  const logs = [];
  for (let i = 0; i < studentIds.length; i++) {
    if ((i + 1) % 6 === 0) continue; // leave some unlogged
    const status = STATUSES[(i * 3) % STATUSES.length];
    const hasGrade = status === "checked" || status === "submitted" || status === "late";
    logs.push({
      assignment_id: a1.id,
      student_id: studentIds[i],
      status,
      grade: hasGrade ? String(55 + ((i * 7) % 44)) : null,
      comment: COMMENT_BY_STATUS[status],
      sent_at: i % 5 !== 0 ? new Date(Date.now() - i * 3600_000).toISOString() : null,
      logged_by: assistant.id,
    });
  }
  await supabase.from("assignment_logs").insert(logs);

  console.log("\nDone — academic demo data seeded.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
