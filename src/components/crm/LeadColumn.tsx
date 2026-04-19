import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./LeadCard";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  label: string;
  color: string;
  leads: any[];
  onEdit: (lead: any) => void;
}

export const LeadColumn = ({ id, label, color, leads, onEdit }: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col w-72 shrink-0 animate-fade-in">
      {/* Sticky header — frosted */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 rounded-t-xl border glass",
          color
        )}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em]">
          {label}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-foreground/10 backdrop-blur-sm tabular-nums min-w-[22px] text-center">
          {leads.length}
        </span>
      </div>

      {/* Body with scroll fade affordance */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 min-h-[240px] p-2 space-y-2 rounded-b-xl border border-t-0 border-border/40 transition-colors duration-300 ease-ios overflow-hidden",
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
