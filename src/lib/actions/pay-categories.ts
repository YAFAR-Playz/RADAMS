"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";

export type CategoryMode = "number" | "dropdown" | "fixed";
export type CategoryOption = { id: string; label: string; amount: number };
export type PayCategory = { id: string; kind: "extra" | "deduction"; label: string; mode: CategoryMode; rate: number | null; options: CategoryOption[] };
export type CourseRate = { offeringId: string; label: string; rate: number; fixedSalary: number };
export type Bracket = { id: string; name: string; lo: number; hi: number; pay: number };
export type BracketSlot = { name: string; lo: number | null; hi: number | null; pay: number | null };

function offeringLabel(o: { session: string; unit: string | null; courses: { name: string } | { name: string }[] | null }) {
  const course = Array.isArray(o.courses) ? o.courses[0] : o.courses;
  return [course?.name, o.session, o.unit].filter(Boolean).join(" · ");
}

// offeringId, when passed, scopes the returned rate/options to that course:
// a per-course override (offering_id set, same org/kind/label) replaces the
// org-wide row's rate/options — used by the evaluation flow so a head's
// picks reflect that course's actual rates. Without it, only the org-wide
// rows (offering_id null) come back — the base definitions Finance manages.
export async function listPayCategories(offeringId?: string | null): Promise<PayCategory[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: cats } = await supabase
    .from("pay_categories")
    .select("id, kind, label, mode, rate")
    .eq("org_id", orgId)
    .is("offering_id", null)
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

  const base: PayCategory[] = cats.map((c) => ({
    id: c.id,
    kind: c.kind as "extra" | "deduction",
    label: c.label,
    mode: c.mode as CategoryMode,
    rate: c.rate != null ? Number(c.rate) : null,
    options: optionsByCat.get(c.id) ?? [],
  }));
  if (!offeringId) return base;

  const { data: overrides } = await supabase.from("pay_categories").select("id, kind, label, rate").eq("org_id", orgId).eq("offering_id", offeringId);
  if (!overrides || !overrides.length) return base;

  const overrideIds = overrides.map((o) => o.id);
  const { data: overrideOptions } = await supabase
    .from("pay_category_options")
    .select("category_id, label, amount")
    .in("category_id", overrideIds)
    .order("sort_order", { ascending: true });
  const overrideOptionsByCat = new Map<string, CategoryOption[]>();
  for (const o of overrideOptions ?? []) {
    const list = overrideOptionsByCat.get(o.category_id) ?? [];
    list.push({ id: o.category_id, label: o.label, amount: Number(o.amount) });
    overrideOptionsByCat.set(o.category_id, list);
  }
  const overrideByKey = new Map(overrides.map((o) => [`${o.kind}::${o.label}`, o]));

  return base.map((c) => {
    const ov = overrideByKey.get(`${c.kind}::${c.label}`);
    if (!ov) return c;
    return { ...c, rate: ov.rate != null ? Number(ov.rate) : c.rate, options: overrideOptionsByCat.get(ov.id) ?? c.options };
  });
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
    ? await supabase.from("per_paper_rates").select("offering_id, rate, fixed_salary").in("offering_id", offeringIds)
    : { data: [] as { offering_id: string; rate: number; fixed_salary: number }[] };
  const rateByOffering = new Map((rates ?? []).map((r) => [r.offering_id, { rate: Number(r.rate), fixedSalary: Number(r.fixed_salary) }]));

  return offerings.map((o) => {
    const r = rateByOffering.get(o.id);
    return { offeringId: o.id, label: offeringLabel(o), rate: r?.rate ?? 8, fixedSalary: r?.fixedSalary ?? 0 };
  });
}

export async function setCourseRate(offeringId: string, rate: number, fixedSalary: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("per_paper_rates")
    .upsert({ offering_id: offeringId, rate, fixed_salary: fixedSalary }, { onConflict: "offering_id" });
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

export type OfficeHourOrgDefault = { id: string; rate: number };

// The org-wide fallback office-hour rate — what a course uses when Finance
// hasn't set a per-course override for it (see listOfficeHourRatesByOffering
// below). This is the only place that rate is editable.
export async function getOfficeHourOrgDefault(): Promise<OfficeHourOrgDefault> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return { id: "", rate: 15 };
  const supabase = await createClient();

  const { data } = await supabase
    .from("other_rates")
    .select("id, rate")
    .eq("org_id", orgId)
    .eq("label", "Office hour")
    .is("offering_id", null)
    .maybeSingle();
  if (data) return { id: data.id, rate: Number(data.rate) };

  // Seed the default the first time Finance opens this org's rates.
  const { data: inserted } = await supabase
    .from("other_rates")
    .insert({ org_id: orgId, label: "Office hour", unit: "per hour", rate: 15 })
    .select("id, rate")
    .single();
  return inserted ? { id: inserted.id, rate: Number(inserted.rate) } : { id: "", rate: 15 };
}

export async function setOfficeHourOrgDefault(id: string, rate: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("other_rates").update({ rate }).eq("id", id);
  if (error) throw new Error(error.message);
}

export type OfficeHourCourseRate = { offeringId: string; label: string; rate: number; isOverride: boolean };

// One row per active course: its own office-hour rate if Finance has set an
// override for it, otherwise the org-wide default — mirrors how per-paper
// rates already work, since different courses can reasonably pay assistants
// different amounts per office hour.
export async function listOfficeHourRatesByOffering(): Promise<OfficeHourCourseRate[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const [{ data: offerings }, { data: defaultRow }, { data: overrides }] = await Promise.all([
    supabase.from("course_offerings").select("id, session, unit, courses(name)").eq("org_id", orgId).eq("active", true),
    supabase.from("other_rates").select("rate").eq("org_id", orgId).eq("label", "Office hour").is("offering_id", null).maybeSingle(),
    supabase.from("other_rates").select("offering_id, rate").eq("org_id", orgId).eq("label", "Office hour").not("offering_id", "is", null),
  ]);
  if (!offerings) return [];

  const defaultRate = defaultRow ? Number(defaultRow.rate) : 15;
  const overrideByOffering = new Map((overrides ?? []).map((r) => [r.offering_id as string, Number(r.rate)]));

  return offerings.map((o) => ({
    offeringId: o.id,
    label: offeringLabel(o),
    rate: overrideByOffering.get(o.id) ?? defaultRate,
    isOverride: overrideByOffering.has(o.id),
  }));
}

export async function setOfficeHourRateForOffering(offeringId: string, rate: number) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("other_rates")
    .select("id")
    .eq("org_id", profile.org.id)
    .eq("label", "Office hour")
    .eq("offering_id", offeringId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("other_rates").update({ rate }).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("other_rates")
      .insert({ org_id: profile.org.id, offering_id: offeringId, label: "Office hour", unit: "per hour", rate });
    if (error) throw new Error(error.message);
  }
}

// Removes a course's override so it falls back to the org-wide default rate.
export async function clearOfficeHourRateOverride(offeringId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase
    .from("other_rates")
    .delete()
    .eq("org_id", profile.org.id)
    .eq("label", "Office hour")
    .eq("offering_id", offeringId);
  if (error) throw new Error(error.message);
}

export type CategoryOfferingRate = {
  offeringId: string;
  offeringLabel: string;
  categoryId: string;
  kind: "extra" | "deduction";
  label: string;
  mode: CategoryMode;
  rate: number | null;
  options: CategoryOption[];
  isOverride: boolean;
};

// One row per (selected course, extra/deduction category): the course's own
// rate/options if Finance has overridden them, else the org-wide default —
// same shadowing pattern as listOfficeHourRatesByOffering.
export async function listCategoryRatesByOffering(offeringIds: string[]): Promise<CategoryOfferingRate[]> {
  if (!offeringIds.length) return [];
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const base = await listPayCategories();
  if (!base.length) return [];

  const { data: offerings } = await supabase.from("course_offerings").select("id, session, unit, courses(name)").in("id", offeringIds);
  if (!offerings) return [];
  const offeringById = new Map(offerings.map((o) => [o.id, o]));

  const { data: overrides } = await supabase
    .from("pay_categories")
    .select("id, kind, label, rate, offering_id")
    .eq("org_id", orgId)
    .in("offering_id", offeringIds);
  const overrideIds = (overrides ?? []).map((o) => o.id);
  const { data: overrideOptions } = overrideIds.length
    ? await supabase.from("pay_category_options").select("category_id, label, amount").in("category_id", overrideIds).order("sort_order", { ascending: true })
    : { data: [] as { category_id: string; label: string; amount: number }[] };
  const optionsByOverrideId = new Map<string, CategoryOption[]>();
  for (const o of overrideOptions ?? []) {
    const list = optionsByOverrideId.get(o.category_id) ?? [];
    list.push({ id: o.category_id, label: o.label, amount: Number(o.amount) });
    optionsByOverrideId.set(o.category_id, list);
  }
  const overrideByKey = new Map((overrides ?? []).map((o) => [`${o.offering_id}::${o.kind}::${o.label}`, o]));

  const rows: CategoryOfferingRate[] = [];
  for (const offeringId of offeringIds) {
    const o = offeringById.get(offeringId);
    if (!o) continue;
    for (const c of base) {
      const ov = overrideByKey.get(`${offeringId}::${c.kind}::${c.label}`);
      rows.push({
        offeringId,
        offeringLabel: offeringLabel(o),
        categoryId: c.id,
        kind: c.kind,
        label: c.label,
        mode: c.mode,
        rate: ov ? (ov.rate != null ? Number(ov.rate) : null) : c.rate,
        options: ov ? optionsByOverrideId.get(ov.id) ?? [] : c.options,
        isOverride: !!ov,
      });
    }
  }
  return rows;
}

// Creates/updates this course's override row for a category (matched by
// kind+label, since the id passed in belongs to the org-wide row). For
// dropdown mode, `options` replaces the override row's whole option set —
// callers must pass the complete set (defaults included), not just the
// edited option.
export async function setCategoryRateForOffering(
  offeringId: string,
  kind: "extra" | "deduction",
  label: string,
  mode: CategoryMode,
  rate: number | null,
  options: { label: string; amount: number }[] | null
) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pay_categories")
    .select("id")
    .eq("org_id", profile.org.id)
    .eq("kind", kind)
    .eq("label", label)
    .eq("offering_id", offeringId)
    .maybeSingle();

  let categoryId: string;
  if (existing) {
    categoryId = existing.id;
    const { error } = await supabase.from("pay_categories").update({ rate }).eq("id", categoryId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from("pay_categories")
      .insert({ org_id: profile.org.id, offering_id: offeringId, kind, label, mode, rate })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to save override");
    categoryId = data.id;
  }

  if (mode === "dropdown" && options) {
    await supabase.from("pay_category_options").delete().eq("category_id", categoryId);
    if (options.length) {
      const { error } = await supabase
        .from("pay_category_options")
        .insert(options.map((o, i) => ({ category_id: categoryId, label: o.label, amount: o.amount, sort_order: i })));
      if (error) throw new Error(error.message);
    }
  }
}

// Removes a course's override so the category falls back to the org-wide
// rate/options.
export async function clearCategoryOverrideForOffering(offeringId: string, kind: "extra" | "deduction", label: string) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase
    .from("pay_categories")
    .delete()
    .eq("org_id", profile.org.id)
    .eq("kind", kind)
    .eq("label", label)
    .eq("offering_id", offeringId);
  if (error) throw new Error(error.message);
}

export type AssistantOfficeHoursDefault = { assistantId: string; name: string; hours: number | null };

// A standing monthly office-hours figure Finance can assign an assistant for
// a specific course, so it doesn't need retyping in Salaries every period —
// generateSalariesForPeriod uses this to auto-create/refresh that line.
export async function listAssistantOfficeHoursDefaults(offeringId: string): Promise<AssistantOfficeHoursDefault[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("offering_assistants")
    .select("assistant_id, default_office_hours, profiles(full_name)")
    .eq("offering_id", offeringId);
  if (!data) return [];
  return data
    .map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      if (!p) return null;
      return { assistantId: r.assistant_id, name: p.full_name, hours: r.default_office_hours != null ? Number(r.default_office_hours) : null };
    })
    .filter((x): x is AssistantOfficeHoursDefault => !!x)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function setAssistantOfficeHoursDefault(offeringId: string, assistantId: string, hours: number | null) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();
  const { error } = await supabase
    .from("offering_assistants")
    .update({ default_office_hours: hours })
    .eq("offering_id", offeringId)
    .eq("assistant_id", assistantId);
  if (error) throw new Error(error.message);
}
