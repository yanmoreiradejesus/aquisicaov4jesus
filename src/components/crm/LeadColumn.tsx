import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { LeadCard } from "./LeadCard";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  label: string;
  color: string;
  leads: any[];
  onEdit: (lead: any) => void;
  defaultCollapsed?: boolean;
  onPhoneInteract?: (lead: any) => void;
}

export const LeadColumn = ({
  id,
  label,
  color,
  leads,
  onEdit,
  defaultCollapsed = false,
  onPhoneInteract,
}: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (collapsed) {
    return (
      <div className="flex flex-col w-12 shrink-0 animate-fade-in">
        <button
          onClick={() => setCollapsed(false)}
          className={cn(
            "flex flex-col items-center gap-2 px-2 py-3 rounded-t-xl border glass hover:bg-foreground/5 transition-colors",
            color
          )}
          aria-label={`Expandir ${label}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-foreground/10 backdrop-blur-sm tabular-nums min-w-[22px] text-center">
            {leads.length}
          </span>
        </button>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 min-h-[240px] flex items-start justify-center pt-4 rounded-b-xl border border-t-0 border-border/40 transition-colors duration-300 ease-ios overflow-hidden",
            isOver ? "bg-primary/8 ring-1 ring-primary/40 ring-inset" : "bg-surface-1/40"
          )}
        >
          <span
            className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground select-none"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-72 shrink-0 animate-fade-in">
      {/* Sticky header — frosted */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 rounded-t-xl border glass",
          color
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={() => setCollapsed(true)}
            className="p-0.5 rounded hover:bg-foreground/10 transition-colors shrink-0"
            aria-label={`Colapsar ${label}`}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] truncate">
            {label}
          </span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-foreground/10 backdrop-blur-sm tabular-nums min-w-[22px] text-center">
          {leads.length}
        </span>
      </div>

      {/* Body with scroll fade affordance */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 min-h-[240px] p-2 space-y-2 rounded-b-xl border border-t-0 border-border/40 transition-colors duration-300 ease-ios",
          isOver
            ? "bg-primary/8 ring-1 ring-primary/40 ring-inset"
            : "bg-surface-1/40"
        )}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onEdit(lead)}
            showAge={id === "entrada"}
            showStageDays={id === "tentativa_contato"}
            onPhoneInteract={onPhoneInteract ? () => onPhoneInteract(lead) : undefined}
          />
        ))}
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-[11px] text-muted-foreground/50 py-12 select-none">
            <div className="h-10 w-10 rounded-full bg-muted/30 mb-2 flex items-center justify-center text-base">
              ∅
            </div>
            Sem leads
          </div>
        )}
      </div>
    </div>
  );
};
