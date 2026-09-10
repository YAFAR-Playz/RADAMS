"use server";

// The Dashboard is the single most-visited page for every role, and each
// role's tab used to fetch its data via a CLIENT-side Promise.all of 2-3
// separately-exported Server Actions — which looks parallel but isn't: each
// Server Function dispatches as its own request, so the client was really
// making 2-3 sequential round trips before anything could render. Bundling
// each role's set into one action here means the underlying queries still
// run concurrently (via Promise.all, same as before) but as a single round
// trip from the client.
import { getAdminDashboard, getHeadDashboard, getRegistrationDashboard, getFinanceDashboard, type AdminDashboard, type HeadDashboard, type RegistrationDashboard, type FinanceDashboard } from "@/lib/actions/dashboard";
import {
  getFinancePayrollTrend,
  getRegistrationEnrollmentTrend,
  getStaffingTrend,
  getMyRatingDistribution,
  getOrgRatingDistribution,
  type PayrollTrendPoint,
  type EnrollmentTrendPoint,
  type StaffingTrendPoint,
  type RatingSlice,
} from "@/lib/actions/dashboard-charts";
import { getHrDashboard, type HrDashboard } from "@/lib/actions/hr";
import { getOwnerDashboard, listOrgsOverview, type OwnerDashboard, type OrgOverview } from "@/lib/actions/owner";
import { listRecentActivityAcrossOrgs, type PlatformActivityRow } from "@/lib/actions/activity-log";

export async function getAdminDashboardBootstrap(): Promise<{ dash: AdminDashboard; staffing: StaffingTrendPoint[] }> {
  const [dash, staffing] = await Promise.all([getAdminDashboard(), getStaffingTrend()]);
  return { dash, staffing };
}

export async function getHeadDashboardBootstrap(): Promise<{ dash: HeadDashboard; ratings: RatingSlice[] }> {
  const [dash, ratings] = await Promise.all([getHeadDashboard(), getMyRatingDistribution()]);
  return { dash, ratings };
}

export async function getRegistrationDashboardBootstrap(): Promise<{ dash: RegistrationDashboard; trend: EnrollmentTrendPoint[] }> {
  const [dash, trend] = await Promise.all([getRegistrationDashboard(), getRegistrationEnrollmentTrend()]);
  return { dash, trend };
}

export async function getFinanceDashboardBootstrap(): Promise<{
  dash: FinanceDashboard;
  trend: { points: PayrollTrendPoint[]; currencySymbol: string };
  ratings: RatingSlice[];
}> {
  const [dash, trend, ratings] = await Promise.all([getFinanceDashboard(), getFinancePayrollTrend(), getOrgRatingDistribution()]);
  return { dash, trend, ratings };
}

export async function getHrDashboardBootstrap(): Promise<{ dash: HrDashboard; staffing: StaffingTrendPoint[] }> {
  const [dash, staffing] = await Promise.all([getHrDashboard(), getStaffingTrend()]);
  return { dash, staffing };
}

export async function getOwnerDashboardBootstrap(): Promise<{ dash: OwnerDashboard; orgs: OrgOverview[]; activity: PlatformActivityRow[] }> {
  const [dash, orgs, activity] = await Promise.all([getOwnerDashboard(), listOrgsOverview(), listRecentActivityAcrossOrgs()]);
  return { dash, orgs, activity };
}
