import { useDraggable } from "@dnd-kit/core";
import { Calendar, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  oportunidade: any;
  onClick: () => void;
}

const fmtBRL = (v?: number | null) => {
  if (!v) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(v));
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

export const OportunidadeCard = ({ oportunidade, onClick }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: oportunidade.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${
          isDragging ? "1.5deg" : "0deg"
        })`,
        zIndex: 50,
      }
    : undefined;

  const lead = oportunidade.lead;
  const titulo = oportunidade.nome_oportunidade;
  const subtitulo = lead?.empresa || lead?.nome;
  const valorEf = fmtBRL(oportunidade.valor_ef);
  const valorFee = fmtBRL(oportunidade.valor_fee);
  const dataPrev = fmtDate(oportunidade.data_fechamento_previsto);

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        {...listeners}
        onClick={onClick}
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border/50 bg-surface-1/80 backdrop-blur-sm card-lift cursor-grab active:cursor-grabbing px-3 py-3",
          isDragging
            ? "opacity-60 shadow-ios-xl scale-[1.02]"
            : "shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80"
        )}
      >
        <div className="font-display font-semibold text-[13px] leading-snug text-foreground truncate tracking-[-0.01em]">
          {titulo}
        </div>
        {subtitulo && (
          <p className="font-display font-normal text-[11px] text-muted-foreground truncate mt-0.5">
            {subtitulo}
          </p>
        )}

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {valorEf && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-emerald-500/10 text-emerald-400 border-emerald-500/30 inline-flex items-center gap-1">
              <DollarSign className="h-2.5 w-2.5" />EF {valorEf}
            </span>
          )}
          {valorFee && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-blue-500/10 text-blue-400 border-blue-500/30 inline-flex items-center gap-1">
              <DollarSign className="h-2.5 w-2.5" />Fee {valorFee}
            </span>
          )}
          {dataPrev && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-amber-500/10 text-amber-300 border-amber-500/30 inline-flex items-center gap-1 tabular-nums">
              <Calendar className="h-2.5 w-2.5" />{dataPrev}
            </span>
          )}
        </div>

        {oportunidade.etapa === "fechado_perdido" && oportunidade.motivo_perda && (
          <p className="text-[10px] text-red-400/80 mt-2 truncate" title={oportunidade.motivo_perda}>
            ✗ {oportunidade.motivo_perda}
          </p>
        )}
      </div>
    </div>
  );
};
