import { useDraggable } from "@dnd-kit/core";
import { Copy, MessageCircle, Clock } from "lucide-react";
import { formatPhone, whatsappNumber, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  lead: any;
  onClick: () => void;
  showAge?: boolean;
}

const tempAccent: Record<string, string> = {
  Quente: "bg-temp-hot",
  Morno: "bg-temp-warm",
  Frio: "bg-temp-cold",
};

const tempPill: Record<string, { emoji: string; cls: string }> = {
  Quente: { emoji: "🔥", cls: "bg-temp-hot/15 text-temp-hot border-temp-hot/40" },
  Morno: { emoji: "🌤️", cls: "bg-temp-warm/15 text-temp-warm border-temp-warm/40" },
  Frio: { emoji: "❄️", cls: "bg-temp-cold/15 text-temp-cold border-temp-cold/40" },
};

export const LeadCard = ({ lead, onClick, showAge }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const { toast } = useToast();

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${
          isDragging ? "1.5deg" : "0deg"
        })`,
        zIndex: 50,
      }
    : undefined;

  const phone = lead.telefone as string | undefined;
  const phoneFmt = formatPhone(phone);
  const wa = whatsappNumber(phone);
  const since = lead.data_criacao_origem || lead.data_aquisicao || lead.created_at;
  const temp = lead.temperatura ? tempPill[lead.temperatura] : null;
  const accent = lead.temperatura ? tempAccent[lead.temperatura] : "bg-border/60";

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
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border/50 bg-surface-1/80 backdrop-blur-sm card-lift",
          isDragging
            ? "opacity-60 shadow-ios-xl scale-[1.02]"
            : "shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80"
        )}
      >
        {/* Accent strip */}
        <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accent)} />

        <div
          {...listeners}
          onClick={onClick}
          className="pl-3.5 pr-3 py-3 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-semibold text-[13.5px] leading-tight text-foreground line-clamp-1 tracking-tight">
                {lead.empresa || lead.nome}
              </h4>
              {lead.empresa && (
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                  {lead.nome}
                </p>
              )}
            </div>
            {showAge && since && (
              <div className="flex items-center gap-0.5 text-[10px] text-temp-warm font-medium shrink-0 tabular-nums">
                <Clock className="h-2.5 w-2.5" />
                <span>{timeAgo(since)}</span>
              </div>
            )}
          </div>

          {temp && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className={cn(
                  "text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide",
                  temp.cls
                )}
              >
                {temp.emoji} {lead.temperatura}
              </span>
            </div>
          )}
        </div>

        {phoneFmt && (
          <div className="flex items-center gap-1 px-3 pb-2.5 pt-1.5 border-t border-border/30">
            <button
              onClick={copyPhone}
              onPointerDown={stop}
              className="flex-1 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-muted/40 min-w-0"
              title="Copiar telefone"
            >
              <Copy className="h-3 w-3 shrink-0" />
              <span className="truncate tabular-nums">{phoneFmt}</span>
            </button>
            {wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stop}
                onPointerDown={stop}
                className="flex items-center justify-center h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-105 transition-all shrink-0"
                title="Abrir WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
