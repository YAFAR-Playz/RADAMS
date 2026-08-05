import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import { findNavItem } from "@/lib/roles";
import { Icon } from "@/components/icons";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { AssignmentsContent } from "@/components/assignments/assignments-content";
import { OversightContent } from "@/components/oversight/oversight-content";
import { HeadAssignmentsContent } from "@/components/head-assignments/head-assignments-content";
import { StudentsContent } from "@/components/students/students-content";
import { AttendanceContent } from "@/components/attendance/attendance-content";
import { MyPayContent } from "@/components/pay/my-pay-content";
import { AssistantsContent } from "@/components/assistants/assistants-content";
import { ImportContent } from "@/components/import/import-content";
import { RegistrationsContent } from "@/components/registrations/registrations-content";
import { StaffContent } from "@/components/staff/staff-content";
import { CoursesContent } from "@/components/courses/courses-content";
import { PayrollSettingsContent } from "@/components/payroll-settings/payroll-settings-content";
import { TemplatesContent } from "@/components/templates/templates-content";
import { BrandingContent } from "@/components/branding/branding-content";
import { EvaluationsContent } from "@/components/evaluations/evaluations-content";
import { InstallmentsContent } from "@/components/installments/installments-content";
import { StaffPaymentsContent } from "@/components/staff-payments/staff-payments-content";
import { PayCategoriesContent } from "@/components/pay-categories/pay-categories-content";
import { FinanceSalariesContent } from "@/components/finance-salaries/finance-salaries-content";
import { HrRequestsContent } from "@/components/hr-requests/hr-requests-content";
import { HiringContent } from "@/components/hiring/hiring-content";
import { HeadCheckingContent } from "@/components/head-checking/head-checking-content";
import { OwnerOrgsContent } from "@/components/owner-orgs/owner-orgs-content";
import { OwnerBrandingContent } from "@/components/owner-branding/owner-branding-content";
import { SettingsContent } from "@/components/settings/settings-content";
import { OwnerUsersContent } from "@/components/owner-users/owner-users-content";
import { OwnerSystemContent } from "@/components/owner-system/owner-system-content";
import { HistoryContent } from "@/components/history/history-content";
import { AcademicReportContent } from "@/components/academic-report/academic-report-content";
import { AssistantReportContent } from "@/components/assistant-report/assistant-report-content";
import { WeakTopicsContent } from "@/components/weak-topics/weak-topics-content";
import { ChatContent } from "@/components/chat/chat-content";

// Delivering monthly reports to Drive (academic-report-content.tsx) waits
// on one Apps Script call that generates every student's PDF in a single
// execution — a large course can take well past Next.js/Vercel's default
// function timeout. Every server action dispatched from this shared route
// gets the same higher ceiling; it only raises the cap, not the actual
// runtime of fast actions. Note: Vercel's Hobby plan hard-caps functions at
// 60s regardless of this setting — very large courses may still need a
// paid plan or a future chunked-delivery approach.
export const maxDuration = 300;

export default async function AppPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  if (key === "dashboard") {
    const firstName = profile.fullName.split(" ")[0];
    return <DashboardContent role={profile.role} orgName={profile.org?.name ?? null} firstName={firstName} />;
  }

  if (key === "settings") {
    return <SettingsContent />;
  }

  if (key === "assignments" && profile.role === "head") {
    return <HeadAssignmentsContent />;
  }

  if (key === "assignments" && profile.role === "assistant") {
    return <AssignmentsContent />;
  }

  if (key === "oversight" && profile.role === "head") {
    return <OversightContent />;
  }

  if (key === "checking" && profile.role === "head") {
    return <HeadCheckingContent />;
  }

  if (key === "orgs" && profile.role === "owner") {
    return <OwnerOrgsContent />;
  }

  if (key === "users" && profile.role === "owner") {
    return <OwnerUsersContent />;
  }

  if (key === "system" && profile.role === "owner") {
    return <OwnerSystemContent />;
  }

  if (key === "students" && (profile.role === "admin" || profile.role === "head" || profile.role === "assistant" || profile.role === "registration")) {
    return <StudentsContent role={profile.role} />;
  }

  if (key === "attendance" && (profile.role === "head" || profile.role === "assistant" || profile.role === "registration")) {
    return <AttendanceContent role={profile.role} />;
  }

  if (key === "mypay" && (profile.role === "head" || profile.role === "assistant")) {
    return <MyPayContent />;
  }

  if (key === "assistants" && profile.role === "head") {
    return <AssistantsContent />;
  }

  if (key === "import" && profile.role === "registration") {
    return <ImportContent />;
  }

  if (key === "registrations" && profile.role === "registration") {
    return <RegistrationsContent />;
  }

  if (key === "staff" && (profile.role === "admin" || profile.role === "hr")) {
    return <StaffContent viewerRole={profile.role} />;
  }

  if (key === "requests" && profile.role === "hr") {
    return <HrRequestsContent />;
  }

  if (key === "hiring" && profile.role === "hr") {
    return <HiringContent />;
  }

  if (key === "courses" && profile.role === "admin") {
    return <CoursesContent />;
  }

  if (key === "payroll" && (profile.role === "admin" || profile.role === "finance")) {
    return <PayrollSettingsContent />;
  }

  if (key === "templates" && profile.role === "admin") {
    return <TemplatesContent />;
  }

  if (key === "templates" && profile.role === "owner") {
    return <TemplatesContent scope="platform" />;
  }

  if (key === "branding" && profile.role === "admin") {
    return <BrandingContent />;
  }

  if (key === "branding" && profile.role === "owner") {
    return <OwnerBrandingContent />;
  }

  if (key === "history" && profile.role === "admin") {
    return <HistoryContent />;
  }

  if (key === "report" && (profile.role === "admin" || profile.role === "head")) {
    return <AcademicReportContent />;
  }

  if (key === "report" && profile.role === "assistant") {
    return <AssistantReportContent />;
  }

  if (key === "evaluations" && profile.role === "head") {
    return <EvaluationsContent />;
  }

  if (key === "weak-topics" && (profile.role === "head" || profile.role === "assistant")) {
    return <WeakTopicsContent role={profile.role} />;
  }

  if (key === "installments" && profile.role === "registration") {
    return <InstallmentsContent />;
  }

  if (key === "salaries" && (profile.role === "finance" || profile.role === "admin")) {
    return <FinanceSalariesContent />;
  }

  if (key === "payments" && profile.role === "finance") {
    return <StaffPaymentsContent />;
  }

  if (key === "categories" && profile.role === "finance") {
    return <PayCategoriesContent />;
  }

  if (key === "chat" && profile.role !== "owner") {
    return <ChatContent role={profile.role} />;
  }

  const item = findNavItem(profile.role, key);
  if (!item) notFound();

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-[70px] text-center">
      <div className="flex h-[62px] w-[62px] items-center justify-center rounded-[16px] bg-[var(--surface2)] text-[var(--muted)]">
        <Icon name={item.icon} size={28} />
      </div>
      <div>
        <h2 className="m-0 mb-[6px] text-[20px] font-semibold tracking-[-0.01em] text-[var(--text)]">{item.label}</h2>
        <p className="m-0 max-w-[360px] text-[14px] leading-[1.55] text-[var(--muted)]">
          This section is part of the next design round — the navigation, shell and theming are wired and ready for it.
        </p>
      </div>
    </div>
  );
}
