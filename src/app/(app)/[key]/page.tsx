import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-profile";
import { findNavItem } from "@/lib/roles";
import { Icon } from "@/components/icons";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { AssignmentsContent } from "@/components/assignments/assignments-content";
import { OversightContent } from "@/components/oversight/oversight-content";
import { HeadAssignmentsContent } from "@/components/head-assignments/head-assignments-content";

export default async function AppPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const profile = await getCurrentProfile();
  if (!profile) notFound();

  if (key === "dashboard") {
    const firstName = profile.fullName.split(" ")[0];
    return <DashboardContent role={profile.role} orgName={profile.org?.name ?? null} firstName={firstName} />;
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
