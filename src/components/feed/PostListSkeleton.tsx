// 피드 로딩 스켈레톤
import { Skeleton } from "@/components/ui/Skeleton";

export function PostListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-4 md:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
          <div className="mt-3 space-y-2 pl-[52px]">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
            <Skeleton className="h-3 w-3/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
