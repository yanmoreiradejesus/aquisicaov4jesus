import { useDraggable } from "@dnd-kit/core";
import { Calendar, GraduationCap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const NIVEL_CONSCIENCIA_LABEL: Record<string, string> = {
  saber: "Saber",
  ter: "Ter",
  executar: "Executar",
  potencializar: "Potencializar",
};

interface Props {
  account: any;
  onClick: () => void;
  overlay?: boolean;
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

export const OnboardingCard = ({ account, onClick, overlay = false }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: account.id,
    disabled: overlay,
  });

  const style: React.CSSProperties | undefined = overlay
    ? undefined
    : transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
      }
    : { opacity: isDragging ? 0 : 1 };

  const op = account.oportunidade;
  const lead = op?.lead;
  const titulo = account.cliente_nome || op?.nome_oportunidade || lead?.empresa || lead?.nome;
  const subtitulo = [lead?.empresa, lead?.nome].filter((v) => v && v !== titulo)[0];
  const valorTotal = (Number(op?.valor_ef) || 0) + (Number(op?.valor_fee) || 0);
  const valorFmt = valorTotal > 0 ? fmtBRL(valorTotal) : null;

  const gcAgendada = account.growth_class_data_agendada;
  const gcRealizada = account.growth_class_data_realizada;
  const isAtrasada = account.onboarding_status === "atrasada";
  const isChurn = account.onboarding_status === "churn_m0";

  // GC pendente se agendada está no passado e não foi realizada
  const gcPendente =
    gcAgendada && !gcRealizada && new Date(gcAgendada) < new Date();

  return (
    <div ref={overlay ? undefined : setNodeRef} style={style} {...(overlay ? {} : attributes)}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border bg-surface-1/80 backdrop-blur-sm",
          overlay
            ? "border-primary/50 shadow-ios-xl ring-1 ring-primary/30 rotate-[1.5deg] scale-[1.04] cursor-grabbing"
            : "border-border/50 card-lift shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80"
        )}
      >
        <span
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px]",
            isChurn
              ? "bg-red-500"
              : gcRealizada
              ? "bg-emerald-500"
              : isAtrasada || gcPendente
              ? "bg-amber-500"
              : "bg-blue-500"
          )}
        />

        <div
          {...(overlay ? {} : listeners)}
          onClick={overlay ? undefined : onClick}
          className={cn("pl-3.5 pr-3 py-3", overlay ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing")}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-[13px] leading-snug text-foreground truncate tracking-[-0.01em]">
                {titulo}
              </div>
              {subtitulo && (
                <p className="font-display font-normal text-[11px] text-muted-foreground truncate mt-0.5">
                  {subtitulo}
                </p>
              )}
            </div>
            {valorFmt && (
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground/90">
                {valorFmt}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {gcRealizada ? (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                <GraduationCap className="h-2.5 w-2.5" />
                GC {fmtDate(gcRealizada)}
              </span>
            ) : gcAgendada ? (
              <span
                className={cn(
                  "text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 tabular-nums",
                  gcPendente
                    ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                    : "bg-blue-500/10 text-blue-300 border-blue-500/30"
                )}
              >
                <Calendar className="h-2.5 w-2.5" />
                GC {fmtDate(gcAgendada)}
              </span>
            ) : null}
            {op?.nivel_consciencia && NIVEL_CONSCIENCIA_LABEL[op.nivel_consciencia] && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 bg-primary/10 text-primary border-primary/30">
                <Brain className="h-2.5 w-2.5" />
                {NIVEL_CONSCIENCIA_LABEL[op.nivel_consciencia]}
              </span>
            )}
            {account.data_inicio_contrato && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide inline-flex items-center gap-1 tabular-nums bg-foreground/5 text-foreground/70 border-border/40">
                <Calendar className="h-2.5 w-2.5" />
                Início {fmtDate(account.data_inicio_contrato)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
