import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Copy, MessageCircle, Clock, ExternalLink } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { formatPhone, whatsappNumber, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface Props {
  lead: any;
  onClick: () => void;
  showAge?: boolean;
  showStageDays?: boolean;
  onPhoneInteract?: () => void;
  onOpenInNewTab?: () => void;
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

const daysSince = (iso?: string | null) => {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
};

export const LeadCard = ({
  lead,
  onClick,
  showAge,
  showStageDays,
  onPhoneInteract,
  onOpenInNewTab,
  overlay = false,
}: Props & { overlay?: boolean }) => {
  const clickTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
  }, []);

  const handleCardClick = (e: React.MouseEvent) => {
    if (overlay) return;
    if ((e.metaKey || e.ctrlKey) && onOpenInNewTab) {
      e.preventDefault();
      onOpenInNewTab();
      return;
    }
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onOpenInNewTab?.();
      return;
    }
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      onClick();
    }, 220);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (overlay) return;
    if (e.button === 1 && onOpenInNewTab) {
      e.preventDefault();
      onOpenInNewTab();
    }
  };

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: overlay,
  });
  const { toast } = useToast();

  // Hide the original card while dragging — the DragOverlay clone is what the user sees
  const style: React.CSSProperties | undefined = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
      };

  const phone = lead.telefone as string | undefined;
  const phoneFmt = formatPhone(phone);
  const wa = whatsappNumber(phone);
  const since = lead.data_criacao_origem || lead.data_aquisicao || lead.created_at;
  const temp = lead.temperatura ? tempPill[lead.temperatura] : null;
  const accent = lead.temperatura ? tempAccent[lead.temperatura] : "bg-border/60";
  const stageDays = showStageDays ? daysSince(lead.updated_at) : 0;

  const stopHard = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const copyPhone = (e: React.MouseEvent) => {
    stopHard(e);
    if (!phoneFmt) return;
    navigator.clipboard.writeText(phoneFmt);
    toast({ title: "Telefone copiado", description: phoneFmt });
    onPhoneInteract?.();
  };

  const handleWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPhoneInteract?.();
  };

  const cardInner = (
    <div ref={overlay ? undefined : setNodeRef} style={style} {...(overlay ? {} : attributes)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-surface-1/80 backdrop-blur-sm",
          overlay
            ? "border-primary/50 shadow-ios-xl ring-1 ring-primary/30 rotate-[1.5deg] scale-[1.04] cursor-grabbing"
            : "border-border/50 card-lift shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80"
        )}
      >
        {/* Accent strip */}
        <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accent)} />

        <div
          {...(overlay ? {} : listeners)}
          onClick={overlay ? undefined : handleCardClick}
          onAuxClick={overlay ? undefined : handleAuxClick}
          title={overlay ? undefined : "Clique para abrir · Duplo-clique (ou Ctrl/Cmd+clique) para abrir em nova aba"}
          className={cn("pl-3.5 pr-3 py-3", overlay ? "" : "cursor-grab active:cursor-grabbing")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-[13px] leading-snug text-foreground truncate tracking-[-0.01em] normal-case">
                {lead.empresa || lead.nome}
              </div>
              {lead.empresa && (
                <p className="font-display font-normal text-[11px] text-muted-foreground truncate mt-0.5 tracking-[-0.005em] normal-case">
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

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {temp && (
              <span
                className={cn(
                  "text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide",
                  temp.cls,
                )}
              >
                {temp.emoji} {lead.temperatura}
              </span>
            )}
            {showStageDays && stageDays > 0 && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-amber-500/10 text-amber-300 border-amber-500/30 tabular-nums">
                Dia {stageDays}
              </span>
            )}
          </div>
        </div>

        {/* Actions row: phone + whatsapp */}
        {phoneFmt && (
          <div className="flex items-center gap-1 px-3 pb-2.5 pt-1.5 border-t border-border/30">
            <button
              onClick={copyPhone}
              onPointerDown={(e) => e.stopPropagation()}
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
                onClick={handleWhatsapp}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center justify-center h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-105 transition-all shrink-0"
                title="Abrir WhatsApp"
                aria-label="Abrir WhatsApp"
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
