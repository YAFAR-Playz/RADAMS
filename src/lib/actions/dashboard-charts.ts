"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { currencySymbol } from "@/lib/currency";

const MONTH_LABEL = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short" });
};

function lastNPeriods(n: number, endingAt?: Date): string[] {
  const end = endingAt ?? new Date();
  const periods: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return periods;
}

export type PayrollTrendPoint = { period: string; label: string; total: number };

// Payroll runs in arrears (see currentPeriod() in dashboard.ts), so the most
// recent point here is last calendar month's payroll, not the one still in
// progress — matching what the Finance KPI tile above it already shows.
export async function getFinancePayrollTrend(months = 6): Promise<{ points: PayrollTrendPoint[]; currencySymbol: string }> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return { points: [], currencySymbol: "£" };
  const supabase = await createClient();

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const periods = lastNPeriods(months, lastMonth);

  const [{ data: org }, { data: lines }] = await Promise.all([
    supabase.from("organizations").select("currency").eq("id", orgId).single(),
    supabase.from("salary_lines").select("period, base, bonus, deduction").eq("org_id", orgId).in("period", periods),
  ]);

  const totalByPeriod = new Map<string, number>();
  for (const l of lines ?? []) {
    const subtotal = Number(l.base) + Number(l.bonus) - Number(l.deduction);
    totalByPeriod.set(l.period, (totalByPeriod.get(l.period) ?? 0) + subtotal);
  }

  const points = periods.map((p) => ({ period: p, label: MONTH_LABEL(p), total: Math.round(totalByPeriod.get(p) ?? 0) }));
  return { points, currencySymbol: currencySymbol(org?.currency) };
}

export type EnrollmentTrendPoint = { date: string; label: string; count: number };

export async function getRegistrationEnrollmentTrend(days = 14): Promise<EnrollmentTrendPoint[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const { data: offeringRows } = await supabase.from("course_offerings").select("id").eq("org_id", orgId);
  const offeringIds = (offeringRows ?? []).map((o) => o.id);
  if (!offeringIds.length) return [];

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data: rows } = await supabase
    .from("enrollments")
    .select("created_at")
    .in("offering_id", offeringIds)
    .gte("created_at", since.toISOString());

  const countByDate = new Map<string, number>();
  for (const r of rows ?? []) {
    const day = r.created_at.slice(0, 10);
    countByDate.set(day, (countByDate.get(day) ?? 0) + 1);
  }

  const points: EnrollmentTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(since);
    d.setDate(since.getDate() + (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    points.push({ date: key, label: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }), count: countByDate.get(key) ?? 0 });
  }
  return points;
}

export type StaffingTrendPoint = { month: string; label: string; added: number; removed: number };

export async function getStaffingTrend(months = 6): Promise<StaffingTrendPoint[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();

  const periods = lastNPeriods(months);
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data: rows } = await supabase.from("staffing_log").select("kind, created_at").eq("org_id", orgId).gte("created_at", since.toISOString());

  const addedByMonth = new Map<string, number>();
  const removedByMonth = new Map<string, number>();
  for (const r of rows ?? []) {
    const month = r.created_at.slice(0, 7);
    if (r.kind === "add") addedByMonth.set(month, (addedByMonth.get(month) ?? 0) + 1);
    else removedByMonth.set(month, (removedByMonth.get(month) ?? 0) + 1);
  }

  return periods.map((p) => ({ month: p, label: MONTH_LABEL(p), added: addedByMonth.get(p) ?? 0, removed: removedByMonth.get(p) ?? 0 }));
}

export type RatingSlice = { rating: string; label: string; count: number };

const RATING_LABEL: Record<string, string> = { outstanding: "Outstanding", exceeds: "Exceeds", meets: "Meets", below: "Below" };
const RATING_ORDER = ["outstanding", "exceeds", "meets", "below"];

function toRatingSlices(rows: { rating: string | null }[]): RatingSlice[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.rating) continue;
    counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
  }
  return RATING_ORDER.map((r) => ({ rating: r, label: RATING_LABEL[r] ?? r, count: counts.get(r) ?? 0 })).filter((s) => s.count > 0);
}

// Every rating a head has given, across every course and period they've
// ever run — not scoped to the current period, since a single month rarely
// has enough evaluations to make a distribution meaningful.
export async function getMyRatingDistribution(): Promise<RatingSlice[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("evaluations").select("rating").eq("head_id", profile.id);
  return toRatingSlices(data ?? []);
}

// Org-wide rating distribution across every head's evaluations — for
// Finance/HR, who oversee payroll/staffing but don't author evaluations
// themselves.
export async function getOrgRatingDistribution(): Promise<RatingSlice[]> {
  const profile = await getCurrentProfile();
  const orgId = profile?.org?.id;
  if (!orgId) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("evaluations").select("rating").eq("org_id", orgId);
  return toRatingSlices(data ?? []);
}
