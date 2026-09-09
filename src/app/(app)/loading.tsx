import { SkeletonRow } from "@/components/ui/spinner";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonRow className="h-[120px]" style={{ animationDelay: "0ms" }} />
      <div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <SkeletonRow className="h-[92px]" style={{ animationDelay: "40ms" }} />
        <SkeletonRow className="h-[92px]" style={{ animationDelay: "70ms" }} />
        <SkeletonRow className="h-[92px]" style={{ animationDelay: "100ms" }} />
        <SkeletonRow className="h-[92px]" style={{ animationDelay: "130ms" }} />
      </div>
      <SkeletonRow className="h-[260px]" style={{ animationDelay: "160ms" }} />
    </div>
  );
}
