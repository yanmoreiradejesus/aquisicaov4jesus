import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface HubBentoWidgetProps {
  eyebrow: string;
  title?: string;
  href?: string;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Neutral, domain-agnostic widget shell for the Hub bento grid.
 * Reusable by any future module (financial, ops, HR, etc.).
 */
export function HubBentoWidget({
  eyebrow,
  title,
  href,
  loading,
  empty,
  emptyLabel = "Nada por aqui agora.",
  className,
  children,
}: HubBentoWidgetProps) {
  const inner = (
    <div
      className={cn(
        "group relative h-full rounded-xl border border-border/60 bg-[hsl(var(--surface-1))] p-6 lg:p-7 transition-all duration-300",
        href && "hover:border-primary/40 hover:bg-[hsl(var(--surface-2))] cursor-pointer",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] lg:text-xs font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {eyebrow}
        </p>
        {title && (
          <span className="font-heading text-lg lg:text-xl text-foreground/90">{title}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : empty ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        children
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}
