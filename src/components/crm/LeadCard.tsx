import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Copy, MessageCircle, Clock } from "lucide-react";
import { formatPhone, whatsappNumber, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";

interface Props {
  lead: any;
  onClick: () => void;
  showAge?: boolean;
}

export const LeadCard = ({ lead, onClick, showAge }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const { toast } = useToast();

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  const phone = lead.telefone as string | undefined;
  const phoneFmt = formatPhone(phone);
  const wa = whatsappNumber(phone);
  const since = lead.data_criacao_origem || lead.data_aquisicao || lead.created_at;
  const tempMeta: Record<string, { label: string; emoji: string; cls: string }> = {
    Quente: { label: "Quente", emoji: "🔥", cls: "bg-red-500/15 text-red-300 border-red-500/40" },
    Morno: { label: "Morno", emoji: "🌤️", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
    Frio: { label: "Frio", emoji: "❄️", cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  };
  const temp = lead.temperatura ? tempMeta[lead.temperatura] : null;

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const copyPhone = (e: React.MouseEvent) => {
    stop(e);
    if (!phoneFmt) return;
    navigator.clipboard.writeText(phoneFmt);
    toast({ title: "Telefone copiado", description: phoneFmt });
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={`p-3 bg-card hover:border-primary/40 transition-colors ${
          isDragging ? "opacity-40 shadow-2xl" : ""
        }`}
      >
        {/* Área draggable / clicável */}
        <div
          {...listeners}
          onClick={onClick}
          className="space-y-1.5 cursor-grab active:cursor-grabbing"
        >
          {lead.empresa && (
            <h4 className="font-semibold text-sm text-foreground line-clamp-1">
              {lead.empresa}
            </h4>
          )}
          <p className={`text-xs ${lead.empresa ? "text-muted-foreground" : "font-semibold text-foreground"} line-clamp-1`}>
            {lead.nome}
          </p>

          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {temp && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${temp.cls}`}>
                {temp.emoji} {temp.label}
              </span>
            )}
            {showAge && since && (
              <div className="flex items-center gap-1 text-[11px] text-amber-400">
                <Clock className="h-3 w-3" />
                <span>{timeAgo(since)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Ações de telefone (fora do listener para não disparar drag) */}
        {phoneFmt && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
            <button
              onClick={copyPhone}
              onPointerDown={stop}
              className="flex-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1 rounded hover:bg-muted/50 min-w-0"
              title="Copiar telefone"
            >
              <Copy className="h-3 w-3 shrink-0" />
              <span className="truncate">{phoneFmt}</span>
            </button>
            {wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stop}
                onPointerDown={stop}
                className="flex items-center justify-center h-7 w-7 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
                title="Abrir WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
