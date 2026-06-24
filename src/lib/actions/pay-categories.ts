"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type CategoryMode = "number" | "dropdown" | "fixed";
export type CategoryOption = { id: string; label: string; amount: number };
export type PayCategory = { id: string; kind: "extra" | "deduction"; label: string; mode: CategoryMode; rate: number | null; options: CategoryOption[] };
export type CourseRate = { offeringId: string; label: string; rate: number };
export type Bracket = { id: string; name: string; lo: number; hi: number; pay: number };
export type OtherRate = { id: string; label: string; unit: string; rate: number };

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null }) {
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

export async function listPayCategories(): Promise<PayCategory[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: cats } = await supabase
    .from("pay_categories")
    .select("id, kind, label, mode, rate")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true });
  if (!cats) return [];

  const catIds = cats.map((c) => c.id);
  const { data: options } = catIds.length
    ? await supabase.from("pay_category_options").select("id, category_id, label, amount").in("category_id", catIds).order("sort_order", { ascending: true })
    : { data: [] as { id: string; category_id: string; label: string; amount: number }[] };

  const optionsByCat = new Map<string, CategoryOption[]>();
  for (const o of options ?? []) {
    const list = optionsByCat.get(o.category_id) ?? [];
    list.push({ id: o.id, label: o.label, amount: Number(o.amount) });
    optionsByCat.set(o.category_id, list);
  }

  return cats.map((c) => ({
    id: c.id,
    kind: c.kind as "extra" | "deduction",
    label: c.label,
    mode: c.mode as CategoryMode,
    rate: c.rate != null ? Number(c.rate) : null,
    options: optionsByCat.get(c.id) ?? [],
  }));
}

export async function addPayCategory(kind: "extra" | "deduction", label: string): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_categories")
    .insert({ org_id: profile.org.id, kind, label, mode: "number", rate: 1 })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add category");
  return { id: data.id };
}

export async function updatePayCategory(id: string, patch: { label?: string; mode?: CategoryMode; rate?: number | null }) {
  const supabase = await createClient();
  const { error } = await supabase.from("pay_categories").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deletePayCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pay_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function addCategoryOption(categoryId: string): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_category_options")
    .insert({ category_id: categoryId, label: "New option", amount: 0 })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add option");
  return { id: data.id };
}

export async function updateCategoryOption(id: string, patch: { label?: string; amount?: number }) {
  const supabase = await createClient();
  const { error } = await supabase.from("pay_category_options").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCategoryOption(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pay_category_options").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCourseRates(): Promise<CourseRate[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: offerings } = await supabase
    .from("course_offerings")
    .select("id, session, unit, courses(name)")
    .eq("org_id", orgId);
  if (!offerings) return [];

  const offeringIds = offerings.map((o) => o.id);
  const { data: rates } = offeringIds.length
    ? await supabase.from("per_paper_rates").select("offering_id, rate").in("offering_id", offeringIds)
    : { data: [] as { offering_id: string; rate: number }[] };
  const rateByOffering = new Map((rates ?? []).map((r) => [r.offering_id, Number(r.rate)]));

  return offerings.map((o) => ({ offeringId: o.id, label: offeringLabel(o), rate: rateByOffering.get(o.id) ?? 8 }));
}

export async function setCourseRate(offeringId: string, rate: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("per_paper_rates").upsert({ offering_id: offeringId, rate }, { onConflict: "offering_id" });
  if (error) throw new Error(error.message);
}

export async function listBrackets(): Promise<Bracket[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("pay_brackets").select("id, name, lo, hi, pay").eq("org_id", orgId).order("sort_order", { ascending: true });
  return (data ?? []).map((b) => ({ id: b.id, name: b.name, lo: b.lo, hi: b.hi, pay: Number(b.pay) }));
}

export async function addBracket(): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { count } = await supabase.from("pay_brackets").select("id", { count: "exact", head: true }).eq("org_id", profile.org.id);
  const name = `Bracket ${String.fromCharCode(65 + (count ?? 0))}`;
  const { data, error } = await supabase.from("pay_brackets").insert({ org_id: profile.org.id, name, lo: 0, hi: 0, pay: 0 }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add bracket");
  return { id: data.id };
}

export async function updateBracket(id: string, patch: { name?: string; lo?: number; hi?: number; pay?: number }) {
  const supabase = await createClient();
  const { error } = await supabase.from("pay_brackets").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteBracket(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("pay_brackets").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listOtherRates(): Promise<OtherRate[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("other_rates").select("id, label, unit, rate").eq("org_id", orgId).order("sort_order", { ascending: true });
  if (data && data.length) return data.map((r) => ({ id: r.id, label: r.label, unit: r.unit, rate: Number(r.rate) }));

  // Seed sensible defaults the first time Finance opens this org's rates.
  const defaults = [
    { label: "Office hour", unit: "per hour", rate: 15 },
    { label: "Per paper (default)", unit: "per paper", rate: 8 },
  ];
  const { data: inserted } = await supabase
    .from("other_rates")
    .insert(defaults.map((d) => ({ org_id: orgId, ...d })))
    .select("id, label, unit, rate");
  return (inserted ?? []).map((r) => ({ id: r.id, label: r.label, unit: r.unit, rate: Number(r.rate) }));
}

export async function updateOtherRate(id: string, rate: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("other_rates").update({ rate }).eq("id", id);
  if (error) throw new Error(error.message);
}
