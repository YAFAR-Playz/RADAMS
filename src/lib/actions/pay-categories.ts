"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type CategoryMode = "number" | "dropdown" | "fixed";
export type CategoryOption = { id: string; label: string; amount: number };
export type PayCategory = { id: string; kind: "extra" | "deduction"; label: string; mode: CategoryMode; rate: number | null; options: CategoryOption[] };
export type CourseRate = { offeringId: string; label: string; rate: number };
export type Bracket = { id: string; name: string; lo: number; hi: number; pay: number };
export type BracketSlot = { name: string; lo: number | null; hi: number | null; pay: number | null };
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
    .eq("org_id", orgId)
    .eq("active", true);
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

// Brackets are stored per course offering. When several courses are
// selected at once, a "slot" (identified by name) only shows a value for
// lo/hi/pay if every selected course currently agrees on that field —
// otherwise it's left blank so editing it doesn't silently overwrite
// courses that intentionally differ. Saving a blank field leaves every
// course's existing value alone; saving a filled field applies it to
// every selected course (creating the slot for any course that didn't
// have it yet).
export async function getBracketSlots(offeringIds: string[]): Promise<BracketSlot[]> {
  if (!offeringIds.length) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("pay_brackets")
    .select("name, lo, hi, pay, offering_id")
    .in("offering_id", offeringIds)
    .order("sort_order", { ascending: true });

  const byName = new Map<string, { lo: number; hi: number; pay: number; offeringId: string }[]>();
  for (const r of data ?? []) {
    const list = byName.get(r.name) ?? [];
    list.push({ lo: r.lo, hi: r.hi, pay: Number(r.pay), offeringId: r.offering_id });
    byName.set(r.name, list);
  }

  const slots: BracketSlot[] = [];
  for (const [name, rows] of byName) {
    const allHave = offeringIds.every((id) => rows.some((r) => r.offeringId === id));
    const agree = <T,>(sel: (r: (typeof rows)[number]) => T): T | null =>
      allHave && rows.every((r) => sel(r) === sel(rows[0])) ? sel(rows[0]) : null;
    slots.push({ name, lo: agree((r) => r.lo), hi: agree((r) => r.hi), pay: agree((r) => r.pay) });
  }
  return slots;
}

export async function addBracketSlot(offeringIds: string[]): Promise<{ name: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  if (!offeringIds.length) throw new Error("Select at least one course first");
  const supabase = await createClient();

  const { data: existing } = await supabase.from("pay_brackets").select("name").in("offering_id", offeringIds);
  const count = new Set((existing ?? []).map((r) => r.name)).size;
  const name = `Bracket ${String.fromCharCode(65 + count)}`;

  const { error } = await supabase
    .from("pay_brackets")
    .insert(offeringIds.map((offeringId) => ({ org_id: profile.org!.id, offering_id: offeringId, name, lo: 0, hi: 0, pay: 0 })));
  if (error) throw new Error(error.message);
  return { name };
}

export async function saveBracketSlot(offeringIds: string[], currentName: string, patch: { name?: string; lo?: number; hi?: number; pay?: number }) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  if (!offeringIds.length) return;
  const supabase = await createClient();

  const { data: existing } = await supabase.from("pay_brackets").select("id, offering_id").eq("name", currentName).in("offering_id", offeringIds);
  const rowByOffering = new Map((existing ?? []).map((r) => [r.offering_id, r.id]));

  for (const offeringId of offeringIds) {
    const rowId = rowByOffering.get(offeringId);
    if (rowId) {
      const { error } = await supabase.from("pay_brackets").update(patch).eq("id", rowId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("pay_brackets").insert({
        org_id: profile.org.id,
        offering_id: offeringId,
        name: patch.name ?? currentName,
        lo: patch.lo ?? 0,
        hi: patch.hi ?? 0,
        pay: patch.pay ?? 0,
      });
      if (error) throw new Error(error.message);
    }
  }
}

export async function deleteBracketSlot(offeringIds: string[], name: string) {
  if (!offeringIds.length) return;
  const supabase = await createClient();
  const { error } = await supabase.from("pay_brackets").delete().eq("name", name).in("offering_id", offeringIds);
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
