import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { ExpansaoRow } from "@/hooks/useExpansoes";
import { Clock } from "lucide-react";

interface Props {
  expansao: ExpansaoRow;
  onClick: () => void;
  overlay?: boolean;
  responsavelNome?: string | null;
}

const fmtBRL = (v?: number | null) => {
  if (v == null) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v));
};

const daysSince = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
};

export const ExpansaoCard = ({ expansao, onClick, overlay = false, responsavelNome }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: expansao.id,
    disabled: overlay,
  });

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};

  const valor = expansao.etapa === "ganho"
    ? (expansao.valor_aumento_fee ?? 0) + (expansao.valor_escopo_fechado ?? 0)
    : expansao.valor_estimado;
  const dias = daysSince(expansao.created_at);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (overlay) return;
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "group relative rounded-xl border border-border/50 bg-surface-2/60 backdrop-blur-sm p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-border transition-colors",
        isDragging && "opacity-40",
        overlay && "shadow-2xl ring-1 ring-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-[13px] leading-snug text-foreground truncate tracking-[-0.01em]">
            {expansao.titulo}
          </div>
        </div>
        {expansao.etapa === "ganho" && expansao.tipo_ganho && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            {expansao.tipo_ganho === "aumento_fee" ? "Fee" : expansao.tipo_ganho === "escopo_fechado" ? "EF" : "Fee + EF"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-sm tabular-nums font-semibold text-foreground/90">
          {fmtBRL(valor) ?? <span className="text-muted-foreground/60 text-xs font-normal">—</span>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="tabular-nums">Dia {dias}</span>
        </div>
      </div>

      {responsavelNome && (
        <div className="text-[11px] text-muted-foreground truncate border-t border-border/40 pt-1.5">
          {responsavelNome}
        </div>
      )}
    </div>
  );
};
