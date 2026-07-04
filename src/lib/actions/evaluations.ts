"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { resolveCategoryDefs, categoryAmount } from "@/lib/evaluation-categories";
import { listPayCategories } from "@/lib/actions/pay-categories";

export type EvalLine = { id: string; kind: "extra" | "deduction"; category: string; note: string; qty: string; sub: string };
export type EvalRating = "outstanding" | "exceeds" | "meets" | "below";

export type Evaluation = {
  id: string | null;
  baseAmount: number;
  notes: string;
  rating: EvalRating | null;
  status: "draft" | "submitted";
  lines: EvalLine[];
};

export type AssistantOption = { id: string; name: string; initials: string };

export async function listMyAssistants(): Promise<AssistantOption[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data: offerings } = await supabase.from("offering_heads").select("offering_id").eq("head_id", profile.id);
  const offeringIds = (offerings ?? []).map((o) => o.offering_id);
  if (!offeringIds.length) return [];
  const { data } = await supabase
    .from("offering_assistants")
    .select("profiles(id, full_name, initials)")
    .in("offering_id", offeringIds);
  const seen = new Map<string, AssistantOption>();
  for (const row of data ?? []) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (p) seen.set(p.id, { id: p.id, name: p.full_name, initials: p.initials });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function countCheckedPapers(assistantId: string, offeringId: string): Promise<number> {
  const supabase = await createClient();
  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("id")
    .eq("offering_id", offeringId)
    .eq("counts_salary", true);
  const assignmentIds = (assignmentRows ?? []).map((a) => a.id);
  if (!assignmentIds.length) return 0;

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("offering_id", offeringId)
    .eq("assistant_id", assistantId);
  const studentIds = (enrollments ?? []).map((e) => e.student_id);
  if (!studentIds.length) return 0;

  // Only count entries the assistant logged themselves — a head's
  // correction/override on one of their students must not count toward
  // that assistant's salary-relevant paper count.
  const { count } = await supabase
    .from("assignment_logs")
    .select("id", { count: "exact", head: true })
    .in("assignment_id", assignmentIds)
    .in("student_id", studentIds)
    .eq("status", "checked")
    .eq("logged_by", assistantId);
  return count ?? 0;
}

export async function getOrCreateEvaluation(assistantId: string, offeringId: string, period: string): Promise<Evaluation> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("evaluations")
    .select("id, base_amount, notes, rating, status")
    .eq("head_id", profile.id)
    .eq("assistant_id", assistantId)
    .eq("offering_id", offeringId)
    .eq("period", period)
    .maybeSingle();

  if (!existing) {
    return { id: null, baseAmount: 0, notes: "", rating: null, status: "draft", lines: [] };
  }

  const { data: lines } = await supabase
    .from("evaluation_lines")
    .select("id, kind, category, note, qty, sub")
    .eq("evaluation_id", existing.id);

  return {
    id: existing.id,
    baseAmount: Number(existing.base_amount),
    notes: existing.notes ?? "",
    rating: existing.rating as EvalRating | null,
    status: existing.status as "draft" | "submitted",
    lines: (lines ?? []).map((l) => ({ id: l.id, kind: l.kind as "extra" | "deduction", category: l.category, note: l.note ?? "", qty: l.qty ?? "", sub: l.sub ?? "" })),
  };
}

export async function saveEvaluation(input: {
  id: string | null;
  assistantId: string;
  offeringId: string;
  period: string;
  baseAmount: number;
  notes: string;
  rating: EvalRating | null;
  status: "draft" | "submitted";
  lines: { kind: "extra" | "deduction"; category: string; note: string; qty: string; sub: string }[];
}): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const payload = {
    org_id: profile.org.id,
    head_id: profile.id,
    assistant_id: input.assistantId,
    offering_id: input.offeringId,
    period: input.period,
    base_amount: input.baseAmount,
    notes: input.notes || null,
    rating: input.rating,
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  let evalId: string;
  if (input.id) {
    const { error } = await supabase.from("evaluations").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    evalId = input.id;
    await supabase.from("evaluation_lines").delete().eq("evaluation_id", evalId);
  } else {
    const { data, error } = await supabase.from("evaluations").insert(payload).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Failed to save evaluation");
    evalId = data.id;
  }

  if (input.lines.length) {
    const payCategories = await listPayCategories();
    const cats = (kind: "extra" | "deduction") => resolveCategoryDefs(payCategories, kind);
    const { error } = await supabase.from("evaluation_lines").insert(
      input.lines.map((l) => {
        const cfg = cats(l.kind).find((c) => c.label === l.category) ?? cats(l.kind)[0];
        return {
          evaluation_id: evalId,
          kind: l.kind,
          category: l.category,
          note: l.note || null,
          qty: l.qty || null,
          sub: l.sub || null,
          amount: categoryAmount(cfg, l.qty, l.sub),
        };
      })
    );
    if (error) throw new Error(error.message);
  }

  return { id: evalId };
}

export type FinanceEvalLine = EvalLine & { amount: number };
export type FinanceEvaluation = {
  id: string | null;
  headName: string | null;
  status: "draft" | "submitted";
  rating: EvalRating | null;
  notes: string;
  lines: FinanceEvalLine[];
};

function requireFinanceOrAdmin(role: string | undefined) {
  if (role !== "finance" && role !== "admin") throw new Error("Not authorized");
}

// Finance previously only ever saw the aggregated extra/deduction totals a
// head's evaluation produced — not which categories were actually picked.
// This surfaces the real evaluation_lines (and lets Finance edit or add to
// them) without disturbing head_id, which getOrCreateEvaluation/saveEvaluation
// use to scope a head to their own evaluations — Finance isn't a head, so it
// can't go through those.
export async function getEvaluationForFinance(assistantId: string, offeringId: string, period: string): Promise<FinanceEvaluation> {
  const profile = await getCurrentProfile();
  requireFinanceOrAdmin(profile?.role);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("evaluations")
    .select("id, head_id, notes, rating, status")
    .eq("assistant_id", assistantId)
    .eq("offering_id", offeringId)
    .eq("period", period)
    .maybeSingle();

  if (!existing) return { id: null, headName: null, status: "draft", rating: null, notes: "", lines: [] };

  const [{ data: lines }, { data: head }] = await Promise.all([
    supabase.from("evaluation_lines").select("id, kind, category, note, qty, sub, amount").eq("evaluation_id", existing.id),
    supabase.from("profiles").select("full_name").eq("id", existing.head_id).maybeSingle(),
  ]);

  return {
    id: existing.id,
    headName: head?.full_name ?? null,
    status: existing.status as "draft" | "submitted",
    rating: existing.rating as EvalRating | null,
    notes: existing.notes ?? "",
    lines: (lines ?? []).map((l) => ({
      id: l.id,
      kind: l.kind as "extra" | "deduction",
      category: l.category,
      note: l.note ?? "",
      qty: l.qty ?? "",
      sub: l.sub ?? "",
      amount: Number(l.amount),
    })),
  };
}

async function ensureEvaluationForFinance(assistantId: string, offeringId: string, period: string): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.org) throw new Error("Not authenticated");
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("evaluations")
    .select("id")
    .eq("assistant_id", assistantId)
    .eq("offering_id", offeringId)
    .eq("period", period)
    .maybeSingle();
  if (existing) return existing.id;

  // evaluations.head_id is required even when Finance is the one creating
  // the row — attribute it to the course's actual head rather than Finance
  // itself so authorship stays meaningful.
  const { data: headLink } = await supabase.from("offering_heads").select("head_id").eq("offering_id", offeringId).limit(1).maybeSingle();
  const headId = headLink?.head_id ?? profile.id;

  const { data, error } = await supabase
    .from("evaluations")
    .insert({ org_id: profile.org.id, head_id: headId, assistant_id: assistantId, offering_id: offeringId, period, base_amount: 0, status: "submitted" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create evaluation");
  return data.id;
}

export async function addFinanceEvaluationLine(assistantId: string, offeringId: string, period: string, kind: "extra" | "deduction"): Promise<{ id: string }> {
  const profile = await getCurrentProfile();
  requireFinanceOrAdmin(profile?.role);
  const supabase = await createClient();
  const evalId = await ensureEvaluationForFinance(assistantId, offeringId, period);

  const payCategories = await listPayCategories();
  const cfg = resolveCategoryDefs(payCategories, kind)[0];
  const sub = cfg.subs?.[0]?.[0] ?? "";
  const { data, error } = await supabase
    .from("evaluation_lines")
    .insert({ evaluation_id: evalId, kind, category: cfg.label, note: null, qty: "", sub, amount: categoryAmount(cfg, "", sub) })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add line");
  return { id: data.id };
}

export async function updateFinanceEvaluationLine(
  lineId: string,
  patch: { category?: string; qty?: string; sub?: string; note?: string; kind?: "extra" | "deduction" }
) {
  const profile = await getCurrentProfile();
  requireFinanceOrAdmin(profile?.role);
  const supabase = await createClient();

  const { data: line } = await supabase.from("evaluation_lines").select("kind, category, qty, sub, note").eq("id", lineId).single();
  if (!line) throw new Error("Line not found");

  const kind = patch.kind ?? (line.kind as "extra" | "deduction");
  const category = patch.category ?? line.category;
  const qty = patch.qty ?? line.qty ?? "";
  const sub = patch.sub ?? line.sub ?? "";
  const note = patch.note ?? line.note;

  const payCategories = await listPayCategories();
  const cfg = resolveCategoryDefs(payCategories, kind).find((c) => c.label === category) ?? resolveCategoryDefs(payCategories, kind)[0];
  const amount = categoryAmount(cfg, qty, sub);

  const { error } = await supabase.from("evaluation_lines").update({ kind, category: cfg.label, qty, sub, note: note || null, amount }).eq("id", lineId);
  if (error) throw new Error(error.message);
}

export async function deleteFinanceEvaluationLine(lineId: string) {
  const profile = await getCurrentProfile();
  requireFinanceOrAdmin(profile?.role);
  const supabase = await createClient();
  const { error } = await supabase.from("evaluation_lines").delete().eq("id", lineId);
  if (error) throw new Error(error.message);
}
