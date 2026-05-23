import { ExternalLink, Link2, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type OnboardingCardMenuAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
};

export function buildOnboardingMenuActions(opts: {
  onOpenInNewTab: () => void;
  onCopyLink: () => void;
}): OnboardingCardMenuAction[] {
  return [
    { id: "open", label: "Abrir em nova aba", icon: ExternalLink, onSelect: opts.onOpenInNewTab },
    { id: "copy", label: "Copiar link", icon: Link2, onSelect: opts.onCopyLink },
  ];
}

/**
 * iOS-style list renderer. Used both inside the bottom Sheet (mobile)
 * and the Popover (desktop). Variant controls density.
 */
export function OnboardingCardMenuList({
  actions,
  variant,
  onAfterSelect,
}: {
  actions: OnboardingCardMenuAction[];
  variant: "sheet" | "popover";
  onAfterSelect: () => void;
}) {
  const isSheet = variant === "sheet";
  return (
    <ul
      className={cn(
        "flex flex-col",
        isSheet
          ? "rounded-2xl bg-surface-2/60 overflow-hidden divide-y divide-border/40"
          : "p-1 gap-0.5"
      )}
    >
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => {
                a.onSelect();
                onAfterSelect();
              }}
              className={cn(
                "w-full flex items-center gap-3 text-left transition-colors",
                "active:bg-foreground/10",
                isSheet
                  ? "px-4 h-[52px] text-[15px] font-medium hover:bg-foreground/[0.04]"
                  : "px-2.5 h-9 rounded-md text-[13px] hover:bg-foreground/[0.06]",
                a.destructive ? "text-red-400" : "text-foreground"
              )}
            >
              <Icon
                className={cn(
                  isSheet ? "h-[18px] w-[18px]" : "h-3.5 w-3.5",
                  a.destructive ? "text-red-400" : "text-muted-foreground"
                )}
              />
              <span className="flex-1 truncate">{a.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
