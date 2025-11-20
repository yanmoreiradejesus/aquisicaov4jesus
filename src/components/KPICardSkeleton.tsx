import { Skeleton } from "@/components/ui/skeleton";

const KPICardSkeleton = () => {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 animate-fade-in">
      <div className="relative z-10 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-primary/50 to-transparent opacity-50" />
    </div>
  );
};

export default KPICardSkeleton;
