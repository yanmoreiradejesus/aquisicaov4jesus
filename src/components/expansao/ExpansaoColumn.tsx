import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { ExpansaoCard } from "./ExpansaoCard";
import type { ExpansaoRow } from "@/hooks/useExpansoes";

interface Props {
  id: string;
  label: string;
  color: string;
  expansoes: ExpansaoRow[];
  onEdit: (e: ExpansaoRow) => void;
  responsaveis?: Record<string, string>;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

export const ExpansaoColumn = ({ id, label, color, expansoes, onEdit, responsaveis }: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  const total = expansoes.reduce((s, e) => {
    if (e.etapa === "ganho") {
      return s + (Number(e.valor_aumento_fee) || 0) + (Number(e.valor_escopo_fechado) || 0);
    }
    return s + (Number(e.valor_estimado) || 0);
  }, 0);

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between px-3 py-2.5 rounded-t-xl border glass",
          color
        )}
      >
        <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] truncate">{label}</span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-foreground/10 tabular-nums min-w-[22px] text-center">
          {expansoes.length}
        </span>
      </div>

      {total > 0 && (
        <div className="px-3 py-1.5 border-x border-border/40 bg-surface-1/40 flex items-center justify-end text-[10px] tabular-nums">
          <span className="text-foreground/80 font-semibold">{fmtBRL(total)}</span>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 min-h-[240px] p-2 space-y-2 rounded-b-xl border border-t-0 border-border/40 transition-colors",
          isOver ? "bg-primary/8 ring-1 ring-primary/40 ring-inset" : "bg-surface-1/40"
        )}
      >
        {expansoes.map((e) => (
          <ExpansaoCard
            key={e.id}
            expansao={e}
            onClick={() => onEdit(e)}
            responsavelNome={e.responsavel_id ? responsaveis?.[e.responsavel_id] : null}
          />
        ))}
        {expansoes.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-[11px] text-muted-foreground/50 py-12 select-none">
            <div className="h-10 w-10 rounded-full bg-muted/30 mb-2 flex items-center justify-center text-base">∅</div>
            Sem oportunidades
          </div>
        )}
      </div>
    </div>
  );
};
