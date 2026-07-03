"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { findNavItem } from "@/lib/roles";

export type SearchResult = { id: string; kind: "student" | "staff" | "course"; label: string; subtitle: string; href: string };

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null }) {
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function globalSearch(rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim();
  if (q.length < 2) return [];
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) return [];
  const orgId = profile.org.id;
  const supabase = await createClient();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const results: SearchResult[] = [];

  const studentsNav = findNavItem(profile.role, "students");
  if (studentsNav) {
    let allowedStudentIds: Set<string> | null = null;
    if (profile.role === "assistant") {
      const { data } = await supabase.from("enrollments").select("student_id").eq("assistant_id", profile.id);
      allowedStudentIds = new Set((data ?? []).map((e) => e.student_id));
    } else if (profile.role === "head") {
      const { data: heads } = await supabase.from("offering_heads").select("offering_id").eq("head_id", profile.id);
      const offeringIds = (heads ?? []).map((h) => h.offering_id);
      const { data } = offeringIds.length
        ? await supabase.from("enrollments").select("student_id").in("offering_id", offeringIds)
        : { data: [] as { student_id: string }[] };
      allowedStudentIds = new Set((data ?? []).map((e) => e.student_id));
    }

    const { data: students } = await supabase
      .from("students")
      .select("id, name, student_code, phone")
      .eq("org_id", orgId)
      .or(`name.ilike.${like},student_code.ilike.${like},phone.ilike.${like}`)
      .limit(allowedStudentIds ? 50 : 6);

    for (const s of students ?? []) {
      if (allowedStudentIds && !allowedStudentIds.has(s.id)) continue;
      results.push({ id: s.id, kind: "student", label: s.name, subtitle: `Student · ${s.student_code}`, href: `/${studentsNav.key}` });
      if (results.filter((r) => r.kind === "student").length >= 6) break;
    }
  }

  if (profile.role === "admin" || profile.role === "hr") {
    const staffNav = findNavItem(profile.role, "staff");
    if (staffNav) {
      let query = supabase
        .from("profiles")
        .select("id, full_name, role, email")
        .eq("org_id", orgId)
        .is("left_at", null)
        .or(`full_name.ilike.${like},email.ilike.${like}`)
        .limit(6);
      if (profile.role === "hr") query = query.not("role", "in", '("admin","owner")');
      const { data: staff } = await query;
      for (const s of staff ?? []) {
        results.push({ id: s.id, kind: "staff", label: s.full_name, subtitle: `Staff · ${s.role}`, href: `/${staffNav.key}` });
      }
    }
  }

  if (profile.role === "finance") {
    const { data: assistants } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("org_id", orgId)
      .eq("role", "assistant")
      .ilike("full_name", like)
      .limit(6);
    for (const a of assistants ?? []) {
      results.push({ id: a.id, kind: "staff", label: a.full_name, subtitle: "Assistant · Salaries", href: "/salaries" });
    }
  }

  if (profile.role === "admin") {
    const coursesNav = findNavItem(profile.role, "courses");
    if (coursesNav) {
      const { data: offerings } = await supabase
        .from("course_offerings")
        .select("id, session, unit, courses(name)")
        .eq("org_id", orgId)
        .limit(50);
      for (const o of offerings ?? []) {
        const label = offeringLabel(o);
        if (!label.toLowerCase().includes(q.toLowerCase())) continue;
        results.push({ id: o.id, kind: "course", label, subtitle: "Course offering", href: `/${coursesNav.key}` });
        if (results.filter((r) => r.kind === "course").length >= 6) break;
      }
    }
  }

  return results;
}
