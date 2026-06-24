import { SkeletonRow } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonRow className="h-[120px]" />
      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <SkeletonRow className="h-[92px]" />
        <SkeletonRow className="h-[92px]" />
        <SkeletonRow className="h-[92px]" />
        <SkeletonRow className="h-[92px]" />
      </div>
      <SkeletonRow className="h-[260px]" />
    </div>
  );
}
