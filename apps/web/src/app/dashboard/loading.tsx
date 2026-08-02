import { Skeleton, SkeletonTitle, SkeletonCard, SkeletonTableRow } from '@techfusion/ui';

export default function DashboardLoading() {
  return (
    <div className="command-center">
      <div className="cmd-content space-y-8" aria-busy="true" aria-label="Loading Command Center">
        <div>
          <SkeletonTitle />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
        <div className="space-y-6">
          <SkeletonCard />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <SkeletonTableRow columns={4} />
          <SkeletonTableRow columns={4} />
        </div>
      </div>
    </div>
  );
}
