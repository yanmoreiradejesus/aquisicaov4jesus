import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { OportunidadeCard } from "./OportunidadeCard";
import { cn } from "@/lib/utils";

interface Props {
  id: string;
  label: string;
  color: string;
  oportunidades: any[];
  onEdit: (op: any) => void;
  defaultCollapsed?: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

export const OportunidadeColumn = ({
  id,
  label,
  color,
  oportunidades,
  onEdit,
  defaultCollapsed = false,
}: Props) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const totalEf = oportunidades.reduce((s, o) => s + (Number(o.valor_ef) || 0), 0);
  const totalFee = oportunidades.reduce((s, o) => s + (Number(o.valor_fee) || 0), 0);

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
            {oportunidades.length}
          </span>
        </button>
        <div
          ref={setNodeRef}
          className={cn(
            "flex-1 min-h-[240px] flex items-start justify-center pt-4 rounded-b-xl border border-t-0 border-border/40 transition-colors duration-300 ease-ios",
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
          {oportunidades.length}
        </span>
      </div>

      {(totalEf + totalFee) > 0 && (
        <div className={cn("px-3 py-1.5 border-x border-border/40 bg-surface-1/40 flex items-center justify-end text-[10px] tabular-nums")}>
          <span className="text-foreground/80 font-semibold">{fmtBRL(totalEf + totalFee)}</span>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={cn(
          "relative flex-1 min-h-[240px] p-2 space-y-2 rounded-b-xl border border-t-0 border-border/40 transition-colors duration-300 ease-ios overflow-hidden",
          isOver
            ? "bg-primary/8 ring-1 ring-primary/40 ring-inset"
            : "bg-surface-1/40"
        )}
      >
        {oportunidades.map((op) => (
          <OportunidadeCard key={op.id} oportunidade={op} onClick={() => onEdit(op)} />
        ))}
        {oportunidades.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-[11px] text-muted-foreground/50 py-12 select-none">
            <div className="h-10 w-10 rounded-full bg-muted/30 mb-2 flex items-center justify-center text-base">
              ∅
            </div>
            Sem oportunidades
          </div>
        )}
      </div>
    </div>
  );
};
