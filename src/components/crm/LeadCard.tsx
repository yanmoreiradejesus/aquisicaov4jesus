import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Building2, Mail, Phone, User } from "lucide-react";

interface Props {
  lead: any;
  onClick: () => void;
}

export const LeadCard = ({ lead, onClick }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={`p-3 cursor-grab active:cursor-grabbing bg-card hover:border-primary/40 transition-colors ${
          isDragging ? "opacity-40 shadow-2xl" : ""
        }`}
      >
        <div {...listeners} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm text-foreground line-clamp-1">{lead.nome}</h4>
            {lead.tier && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wider shrink-0">
                {lead.tier}
              </span>
            )}
          </div>
          {lead.empresa && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{lead.empresa}</span>
            </div>
          )}
          {lead.email && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{lead.email}</span>
            </div>
          )}
          {lead.telefone && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{lead.telefone}</span>
            </div>
          )}
          {lead.origem && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{lead.origem}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClick}
          className="mt-2 w-full text-[11px] text-primary hover:underline text-left"
        >
          Editar →
        </button>
      </Card>
    </div>
  );
};
