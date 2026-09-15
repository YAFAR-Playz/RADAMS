import { SkeletonRow } from "@/components/ui/spinner";

// Without this, navigating here (e.g. clicking "Sign in" from the landing
// page) shows nothing at all while the server fetches platform branding —
// a real, unexplained freeze rather than a page that's visibly loading.
export default function Loading() {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[var(--bg)]">
      <div className="hidden w-1/2 flex-col justify-between border-r border-[var(--border)] p-[54px] lg:flex">
        <SkeletonRow className="h-11 w-11 rounded-[13px]" />
        <div className="flex flex-col gap-[14px]">
          <SkeletonRow className="h-[28px] w-[85%]" />
          <SkeletonRow className="h-[14px] w-[70%]" />
        </div>
      </div>
      <div className="flex w-full flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px]">
          <SkeletonRow className="h-[260px] w-full rounded-[20px]" />
        </div>
      </div>
    </div>
  );
}
