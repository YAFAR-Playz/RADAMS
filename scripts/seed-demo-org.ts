// Provisions the ONE canonical "ZAD-AMS Demo" template organization that
// the onboarding tour clones per session (see
// supabase/migrations/0059_add_onboarding_demo_tour.sql's
// start_onboarding_demo function). This is never touched directly by any
// tourer — every "Start tour" click makes a private, disposable copy of it.
//
// Deliberately richer than a one-of-everything example: 2 heads across 5
// course offerings, 6 assistants spread unevenly (some offerings share more
// than one), ~50 students in varied states (active/left/unassigned),
// assignments in every status, mixed salary calc methods, several
// staffing-request states, and payment plans covering full/installment/
// discounted/overdue cases — so every role's tour has real scenario variety
// to walk through, not just a placeholder for each screen.
//
// Not idempotent by design: if the fixed-id org already exists, this exits
// without changes rather than duplicating rows — delete that org row first
// (cascades everything) if you want to reseed from scratch.
//
// Requires SUPABASE_SERVICE_ROLE_KEY. Run with: npm run seed:demo-org

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your environment (.env.local).");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Must match the constant hardcoded into start_onboarding_demo() in
// supabase/migrations/0059_add_onboarding_demo_tour.sql.
const DEMO_ORG_ID = "8cfc8e75-4211-427e-b1b7-09d3b786c1ac";
const DEMO_ORG_NAME = "ZAD-AMS Demo";

type ColleagueRole = "head" | "assistant" | "registration" | "finance" | "hr" | "admin";
type Colleague = { role: ColleagueRole; name: string; email: string; leftAt?: string };

// Permanent "coworker" profiles a tourer sees in their private clone — real
// auth accounts (profiles.id references auth.users(id)) but never signed
// into directly. Cloning per session re-links these into fresh
// offering_heads/offering_assistants rows rather than duplicating them.
const COLLEAGUES: Colleague[] = [
  { role: "head", name: "Nadia Farouk", email: "demo-head-1@demo.zadams.internal" },
  { role: "head", name: "Tariq Osei", email: "demo-head-2@demo.zadams.internal" },
  { role: "assistant", name: "Priya Nair", email: "demo-assistant-1@demo.zadams.internal" },
  { role: "assistant", name: "Sam Cohen", email: "demo-assistant-2@demo.zadams.internal" },
  { role: "assistant", name: "Fatima Khan", email: "demo-assistant-3@demo.zadams.internal" },
  { role: "assistant", name: "Diego Bauer", email: "demo-assistant-4@demo.zadams.internal" },
  { role: "assistant", name: "Grace Park", email: "demo-assistant-5@demo.zadams.internal" },
  { role: "assistant", name: "Omar Haddad", email: "demo-assistant-6@demo.zadams.internal" },
  {
    role: "assistant",
    name: "Yara Sayed",
    email: "demo-assistant-7-departed@demo.zadams.internal",
    leftAt: new Date(Date.now() - 45 * 86_400_000).toISOString(),
  },
  { role: "registration", name: "Lucy Brennan", email: "demo-registration@demo.zadams.internal" },
  { role: "finance", name: "Victor Ricci", email: "demo-finance@demo.zadams.internal" },
  { role: "hr", name: "Wendy Foster", email: "demo-hr@demo.zadams.internal" },
  { role: "admin", name: "Karim Adel", email: "demo-admin@demo.zadams.internal" },
];

const FIRST = [
  "Aria", "Ben", "Ethan", "Hana", "Liam", "Mei", "Noah", "Sofia", "Chloe", "Henry",
  "Isla", "Jack", "Lucy", "Marco", "Nadia", "Oscar", "Quinn", "Rana", "Tara", "Uma",
  "Victor", "Wendy", "Zack", "Amara", "Bilal", "Cara", "Dana", "Elan", "Farah", "Gio",
  "Hala", "Ivo", "Jana", "Kofi", "Leah", "Milo", "Nia", "Ola", "Petra", "Reza",
  "Sara", "Theo", "Uzo", "Vera", "Wyatt", "Xena", "Yusuf", "Zoe", "Alden", "Bea",
];
const LAST = [
  "Khan", "Cohen", "Park", "Kim", "Carter", "Wong", "Bauer", "Sayed", "Rossi", "Haddad",
  "Adeyemi", "Luna", "Zahra", "Owusu", "Walsh", "Murphy", "Lee", "Adel", "Brennan", "Ricci",
  "Petrov", "Reyes", "Menon", "Foster", "Saleh", "Okonkwo", "Vidal", "Desai", "Hugo", "Tan",
  "Farouk", "Osei", "Nair", "Bell", "Albright", "Reyes", "Chowdhury", "Ibrahim", "Novak", "Silva",
];

function nameFor(i: number) {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + 3) % LAST.length];
  return { first, last, full: `${first} ${last}`, initials: (first[0] + last[0]).toUpperCase() };
}

async function ensureColleague(c: Colleague): Promise<{ id: string; role: ColleagueRole }> {
  const { data: existing } = await supabase.from("profiles").select("id, role").eq("email", c.email).maybeSingle();
  if (existing) return existing as { id: string; role: ColleagueRole };

  const { data: created, error: createError } = await supabase.auth.admin.createUser({ email: c.email, email_confirm: true });
  if (createError || !created.user) throw new Error(`Couldn't create auth user for ${c.email}: ${createError?.message}`);

  const initials = c.name.split(" ").map((w) => w[0]).join("").toUpperCase();
  const { error: profileError } = await supabase.from("profiles").insert({
    id: created.user.id,
    org_id: DEMO_ORG_ID,
    role: c.role,
    full_name: c.name,
    initials,
    email: c.email,
    is_main_admin: c.role === "admin" ? true : undefined,
    left_at: c.leftAt ?? null,
  });
  if (profileError) throw new Error(`Couldn't create profile for ${c.email}: ${profileError.message}`);

  return { id: created.user.id, role: c.role };
}

async function main() {
  const { data: existingOrg } = await supabase.from("organizations").select("id").eq("id", DEMO_ORG_ID).maybeSingle();
  if (existingOrg) {
    console.log(`"${DEMO_ORG_NAME}" already exists (${DEMO_ORG_ID}) — not re-seeding. Delete that org row first to reseed from scratch.`);
    return;
  }

  console.log(`Creating "${DEMO_ORG_NAME}"...`);
  const { error: orgError } = await supabase.from("organizations").insert({
    id: DEMO_ORG_ID,
    name: DEMO_ORG_NAME,
    brand_name: "ZAD-AMS",
    logo_letter: "Z",
  });
  if (orgError) throw new Error(orgError.message);

  console.log("Creating colleague profiles...");
  const byEmail = new Map<string, { id: string; role: ColleagueRole }>();
  for (const c of COLLEAGUES) {
    byEmail.set(c.email, await ensureColleague(c));
  }
  const heads = COLLEAGUES.filter((c) => c.role === "head").map((c) => byEmail.get(c.email)!.id);
  const activeAssistants = COLLEAGUES.filter((c) => c.role === "assistant" && !c.leftAt).map((c) => byEmail.get(c.email)!.id);
  const [priya, sam, fatima, diego, grace, omar] = activeAssistants;

  console.log("Creating courses...");
  const courseNames = ["Physics", "Chemistry", "Biology"];
  const courseIds: Record<string, string> = {};
  for (const name of courseNames) {
    const { data, error } = await supabase.from("courses").insert({ org_id: DEMO_ORG_ID, name }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create course");
    courseIds[name] = data.id;
  }

  console.log("Creating weak-topic catalog entries...");
  const TOPIC_DEFS: Record<string, { label: string; materials: { kind: "video" | "notes" | "tricky_question"; label: string; link: string; duration: string }[] }[]> = {
    Physics: [
      {
        label: "Newton's laws of motion",
        materials: [
          { kind: "notes", label: "Summary sheet", link: "https://example.com/notes/newtons-laws", duration: "" },
          { kind: "video", label: "Worked examples", link: "https://example.com/video/newtons-laws", duration: "12 min" },
        ],
      },
      { label: "Circular motion", materials: [{ kind: "tricky_question", label: "Common exam trap", link: "https://example.com/q/circular-motion", duration: "" }] },
    ],
    Chemistry: [
      {
        label: "Balancing equations",
        materials: [{ kind: "notes", label: "Step-by-step method", link: "https://example.com/notes/balancing-equations", duration: "" }],
      },
    ],
    Biology: [
      {
        label: "Cell respiration",
        materials: [{ kind: "video", label: "Explainer video", link: "https://example.com/video/cell-respiration", duration: "9 min" }],
      },
    ],
  };
  for (const [courseName, topics] of Object.entries(TOPIC_DEFS)) {
    for (const t of topics) {
      const { data: topic, error } = await supabase
        .from("topic_catalog")
        .insert({ org_id: DEMO_ORG_ID, course_id: courseIds[courseName], label: t.label, created_by: heads[0] })
        .select("id")
        .single();
      if (error || !topic) throw new Error(error?.message ?? "Failed to create topic catalog entry");
      if (t.materials.length) {
        const { error: matError } = await supabase
          .from("topic_materials")
          .insert(t.materials.map((m, i) => ({ topic_id: topic.id, kind: m.kind, label: m.label, link: m.link, duration: m.duration || null, sort_order: i })));
        if (matError) throw new Error(`Failed to create topic materials: ${matError.message}`);
      }
    }
  }

  console.log("Creating course offerings...");
  const offeringDefs = [
    { course: "Physics", session: "June", unit: "Unit 1", head: heads[0], assistants: [priya, sam] },
    { course: "Physics", session: "June", unit: "Unit 2", head: heads[0], assistants: [priya] },
    { course: "Chemistry", session: "June", unit: "Unit 1", head: heads[0], assistants: [fatima, diego, grace] },
    { course: "Biology", session: "Nov", unit: "Unit 1", head: heads[1], assistants: [omar] },
    { course: "Physics", session: "Nov", unit: "Unit 1", head: heads[1], assistants: [sam, omar] },
  ];
  const offerings: { id: string; assistants: string[] }[] = [];
  for (const def of offeringDefs) {
    const { data, error } = await supabase
      .from("course_offerings")
      .insert({ org_id: DEMO_ORG_ID, course_id: courseIds[def.course], session: def.session, unit: def.unit })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create offering");
    await supabase.from("offering_heads").insert({ offering_id: data.id, head_id: def.head });
    await supabase.from("offering_assistants").insert(def.assistants.map((a) => ({ offering_id: data.id, assistant_id: a })));
    offerings.push({ id: data.id, assistants: def.assistants });
  }

  console.log("Creating ~50 students with varied enrollment states...");
  const studentIds: string[] = [];
  for (let i = 0; i < 50; i++) {
    const n = nameFor(i);
    const { data, error } = await supabase
      .from("students")
      .insert({
        org_id: DEMO_ORG_ID,
        name: n.full,
        initials: n.initials,
        guardian_name: `${n.first} ${n.last}'s guardian`,
        guardian_phone: `+44 7700 9${(10000 + i).toString().slice(-5)}`,
        phone: `+44 7900 1${(10000 + i).toString().slice(-5)}`,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create student");
    studentIds.push(data.id);
  }

  console.log("Enrolling students across offerings (mixed active / left / unassigned)...");
  let cursor = 0;
  for (const [idx, offering] of offerings.entries()) {
    const count = [22, 16, 20, 12, 14][idx] ?? 15;
    const rows = [];
    for (let k = 0; k < count; k++) {
      const studentId = studentIds[(cursor + k) % studentIds.length];
      const isLeft = k % 11 === 0; // a handful left mid-course
      const isUnassigned = !isLeft && k % 8 === 0; // a handful unassigned
      rows.push({
        student_id: studentId,
        offering_id: offering.id,
        assistant_id: isUnassigned ? null : offering.assistants[k % offering.assistants.length],
        left_at: isLeft ? new Date(Date.now() - (k + 1) * 86_400_000).toISOString() : null,
      });
    }
    cursor += count;
    const { error } = await supabase.from("enrollments").insert(rows);
    if (error) throw new Error(error.message);
  }

  console.log("Creating assignments with a full status mix...");
  const STATUSES = ["checked", "submitted", "late", "missing", "excused"] as const;
  const RECIPIENTS = ["parent", "student", null] as const;
  const { data: enrollmentRows } = await supabase.from("enrollments").select("student_id, offering_id").in(
    "offering_id",
    offerings.map((o) => o.id)
  );
  const enrollmentsByOffering = new Map<string, string[]>();
  for (const e of enrollmentRows ?? []) {
    const list = enrollmentsByOffering.get(e.offering_id) ?? [];
    list.push(e.student_id);
    enrollmentsByOffering.set(e.offering_id, list);
  }
  for (const offering of offerings) {
    const students = enrollmentsByOffering.get(offering.id) ?? [];
    for (const title of ["Paper 1 — Multiple Choice", "Paper 3 — Extended Response"]) {
      const { data: assignment, error } = await supabase
        .from("assignments")
        .insert({ offering_id: offering.id, title, max_marks: 100, created_by: heads.includes(offering.assistants[0]) ? heads[0] : heads[0] })
        .select("id")
        .single();
      if (error || !assignment) throw new Error(error?.message ?? "Failed to create assignment");
      const logs = students.map((studentId, i) => {
        const status = STATUSES[(i * 3 + title.length) % STATUSES.length];
        const hasGrade = status === "checked" || status === "submitted" || status === "late";
        const sent = i % 4 !== 0;
        return {
          assignment_id: assignment.id,
          student_id: studentId,
          status,
          grade: hasGrade ? String(48 + ((i * 7) % 50)) : null,
          comment: hasGrade ? "Good progress overall" : null,
          sent_at: sent ? new Date(Date.now() - i * 3_600_000).toISOString() : null,
          recipient: sent ? RECIPIENTS[i % 2] : null,
        };
      });
      if (logs.length) await supabase.from("assignment_logs").insert(logs);
    }
  }

  console.log("Creating attendance sessions + records...");
  for (const offering of offerings) {
    const students = enrollmentsByOffering.get(offering.id) ?? [];
    const { data: session, error } = await supabase
      .from("attendance_sessions")
      .insert({ offering_id: offering.id, title: "Weekly session", session_date: new Date().toISOString().slice(0, 10) })
      .select("id")
      .single();
    if (error || !session) throw new Error(error?.message ?? "Failed to create attendance session");
    const statuses = ["present", "present", "present", "late", "absent"];
    const records = students.map((studentId, i) => ({ session_id: session.id, student_id: studentId, status: statuses[i % statuses.length] }));
    if (records.length) await supabase.from("attendance_records").insert(records);
  }

  console.log("Creating staffing requests (pending / approved / declined)...");
  await supabase.from("staffing_requests").insert([
    { org_id: DEMO_ORG_ID, offering_id: offerings[2].id, kind: "add", candidate_name: "Layla Hassan", candidate_phone: "+44 7700 955001", reason: "Growing enrollment needs a third assistant", status: "pending", requested_by: heads[0] },
    { org_id: DEMO_ORG_ID, offering_id: offerings[0].id, kind: "replace", target_assistant_id: sam, candidate_name: "Ivo Novak", reason: "Sam is moving to the Nov offerings full-time", status: "approved", requested_by: heads[0] },
    { org_id: DEMO_ORG_ID, offering_id: offerings[3].id, kind: "remove", target_assistant_id: omar, reason: "Reducing headcount for this small cohort", status: "declined", requested_by: heads[1] },
  ]);

  console.log("Creating staffing log history...");
  await supabase.from("staffing_log").insert([
    { org_id: DEMO_ORG_ID, kind: "add", target_name: "Diego Bauer", target_role: "assistant", hire_date: new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10) },
    { org_id: DEMO_ORG_ID, kind: "add", target_name: "Grace Park", target_role: "assistant", hire_date: new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10) },
    { org_id: DEMO_ORG_ID, kind: "remove", target_name: "Yara Sayed", target_role: "assistant", leave_date: new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10) },
  ]);

  console.log("Creating salary lines (mixed calc methods, one pending period)...");
  const period = new Date().toISOString().slice(0, 7);
  const priorPeriod = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 7);
  const { error: salaryError } = await supabase.from("salary_lines").insert([
    { org_id: DEMO_ORG_ID, payee_id: priya, offering_id: offerings[0].id, period: priorPeriod, method: "Per paper", basis: "156 papers × $8", base: 1248, bonus: 100, bonus_reason: "Covered an extra weekend session", status: "paid", released_at: new Date().toISOString() },
    { org_id: DEMO_ORG_ID, payee_id: fatima, offering_id: offerings[2].id, period: priorPeriod, method: "Bracket", basis: "Bracket B (120-160 papers)", base: 980, deduction: 30, deduction_reason: "2 logs submitted late", status: "paid", released_at: new Date().toISOString() },
    { org_id: DEMO_ORG_ID, payee_id: heads[0], offering_id: offerings[0].id, period: priorPeriod, method: "Fixed", basis: "Head oversight stipend", base: 600, status: "paid", released_at: new Date().toISOString() },
    { org_id: DEMO_ORG_ID, payee_id: omar, offering_id: offerings[3].id, period, method: "Hourly", basis: "18 office hours × $22", base: 396, status: "pending" },
    { org_id: DEMO_ORG_ID, payee_id: diego, offering_id: offerings[2].id, period, method: "Per paper", basis: "88 papers × $8", base: 704, status: "pending" },
  ]);
  if (salaryError) throw new Error(`Failed to create salary lines: ${salaryError.message}`);

  console.log("Creating pay categories/brackets/other rates...");
  const { error: categoriesError } = await supabase.from("pay_categories").insert([
    { org_id: DEMO_ORG_ID, kind: "extra", label: "Weekend cover", mode: "fixed", rate: 100, sort_order: 0 },
    { org_id: DEMO_ORG_ID, kind: "deduction", label: "Late submission", mode: "fixed", rate: 15, sort_order: 1 },
  ]);
  if (categoriesError) throw new Error(`Failed to create pay categories: ${categoriesError.message}`);
  await supabase.from("pay_brackets").insert([
    { org_id: DEMO_ORG_ID, name: "Bracket A (under 120)", lo: 0, hi: 119, pay: 800, sort_order: 0 },
    { org_id: DEMO_ORG_ID, name: "Bracket B (120-160)", lo: 120, hi: 160, pay: 980, sort_order: 1 },
  ]);
  await supabase.from("other_rates").insert([{ org_id: DEMO_ORG_ID, label: "Office hours", unit: "per hour", rate: 22, sort_order: 0 }]);

  console.log("Creating payment plans (full / installments / discounted / overdue)...");
  const planStudents = studentIds.slice(0, 12);
  for (const [i, studentId] of planStudents.entries()) {
    const offering = offerings[i % offerings.length];
    const isFull = i % 3 === 0;
    const discountPct = i % 4 === 0 ? 10 : 0;
    const totalAmount = isFull ? 1200 : 1500;
    const installmentCount = isFull ? 1 : 3;
    const { data: plan, error } = await supabase
      .from("payment_plans")
      .insert({ student_id: studentId, offering_id: offering.id, plan_type: isFull ? "full" : "installments", total_amount: totalAmount, installment_count: installmentCount, discount_pct: discountPct })
      .select("id")
      .single();
    if (error || !plan) continue; // unique (student_id, offering_id) — skip on rare collision
    if (isFull) {
      await supabase.from("payment_installments").insert({ plan_id: plan.id, seq: 1, amount: totalAmount, due_date: new Date().toISOString().slice(0, 10), status: "paid", paid_at: new Date().toISOString() });
    } else {
      const per = Math.round((totalAmount / installmentCount) * 100) / 100;
      const overdue = i % 5 === 0;
      await supabase.from("payment_installments").insert([
        { plan_id: plan.id, seq: 1, amount: per, due_date: new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10), status: "paid", paid_at: new Date(Date.now() - 58 * 86_400_000).toISOString() },
        { plan_id: plan.id, seq: 2, amount: per, due_date: new Date(Date.now() - (overdue ? 10 : -20) * 86_400_000).toISOString().slice(0, 10), status: overdue ? "pending" : "paid", paid_at: overdue ? null : new Date().toISOString() },
        { plan_id: plan.id, seq: 3, amount: per, due_date: new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10), status: "pending", paid_at: null },
      ]);
    }
  }

  console.log(`\nDone — "${DEMO_ORG_NAME}" seeded (${DEMO_ORG_ID}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
