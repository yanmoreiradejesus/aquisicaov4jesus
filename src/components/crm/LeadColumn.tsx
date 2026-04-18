import { useDroppable } from "@dnd-kit/core";
import { LeadCard } from "./LeadCard";

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
    <div className="flex flex-col w-72 shrink-0">
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border ${color}`}>
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <span className="text-xs font-mono opacity-70">{leads.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] p-2 space-y-2 rounded-b-lg border border-t-0 border-border/40 transition-colors ${
          isOver ? "bg-primary/5" : "bg-muted/20"
        }`}
      >
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={() => onEdit(lead)} />
        ))}
        {leads.length === 0 && (
          <div className="text-center text-xs text-muted-foreground/50 py-8">
            Sem leads
          </div>
        )}
      </div>
    </div>
  );
};
