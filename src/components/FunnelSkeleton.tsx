import { Skeleton } from "@/components/ui/skeleton";

const FunnelSkeleton = () => {
  return (
    <div className="relative grid grid-cols-[1fr_4fr_1fr] gap-6 animate-fade-in opacity-100">
      {/* Left Side - MQL to VENDA Skeleton */}
      <div className="flex items-center justify-center animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
        <div className="text-center space-y-2">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-12 w-20 mx-auto" />
        </div>
      </div>

      {/* Center - Funnel Stages Skeleton */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-5 animate-fade-in"
            style={{ animationDelay: `${index * 100 + 100}ms`, animationFillMode: 'backwards' }}
          >
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-8 w-16" />
            </div>

            {/* Progress Bar Skeleton */}
            <div className="mb-3">
              <Skeleton className="h-2 w-full rounded-full" />
            </div>

            {/* Metrics Skeleton */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Right Side - Conversion Rates Skeleton */}
      <div className="space-y-8">
        {[1, 2, 3, 4].map((index) => (
          <div key={index} className="text-center space-y-2 pt-6 animate-fade-in" style={{ animationDelay: `${index * 100 + 200}ms`, animationFillMode: 'backwards' }}>
            <Skeleton className="h-3 w-20 mx-auto" />
            <Skeleton className="h-7 w-16 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default FunnelSkeleton;
