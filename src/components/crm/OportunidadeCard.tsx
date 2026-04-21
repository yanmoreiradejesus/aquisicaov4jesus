import { useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Calendar, ListTodo, Copy, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, whatsappNumber } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";

interface Props {
  oportunidade: any;
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

// Pílula única no padrão LeadCard. Aceita rótulos do lead (Quente/Morno/Frio)
// ou da oportunidade (quente/morno/frio) — normaliza para o mesmo visual.
const TEMP_PILL: Record<string, { emoji: string; label: string; cls: string; accent: string }> = {
  quente: { emoji: "🔥", label: "Quente", cls: "bg-temp-hot/15 text-temp-hot border-temp-hot/40", accent: "bg-temp-hot" },
  morno: { emoji: "🌤️", label: "Morno", cls: "bg-temp-warm/15 text-temp-warm border-temp-warm/40", accent: "bg-temp-warm" },
  frio: { emoji: "❄️", label: "Frio", cls: "bg-temp-cold/15 text-temp-cold border-temp-cold/40", accent: "bg-temp-cold" },
};

const resolveTemp = (raw?: string | null) => {
  if (!raw) return null;
  return TEMP_PILL[raw.toLowerCase()] ?? null;
};

export const OportunidadeCard = ({ oportunidade, onClick, overlay = false }: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: oportunidade.id,
    disabled: overlay,
  });
  const { toast } = useToast();

  const [tarefasPendentes, setTarefasPendentes] = useState<number>(0);

  useEffect(() => {
    let active = true;
    supabase
      .from("crm_atividades" as any)
      .select("id", { count: "exact", head: true })
      .eq("oportunidade_id", oportunidade.id)
      .eq("tipo", "tarefa")
      .eq("concluida", false)
      .then(({ count }) => {
        if (active) setTarefasPendentes(count ?? 0);
      });
    return () => {
      active = false;
    };
  }, [oportunidade.id, oportunidade.updated_at]);

  const style: React.CSSProperties | undefined = overlay
    ? undefined
    : transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0 : 1,
      }
    : { opacity: isDragging ? 0 : 1 };

  const lead = oportunidade.lead;
  const isProposta = oportunidade.etapa === "proposta";
  const isGanho = oportunidade.etapa === "fechado_ganho";
  const isPerdido = oportunidade.etapa === "fechado_perdido";
  const isFollowInfinito = oportunidade.etapa === "follow_infinito";
  // Etapas terminais não mostram temperatura (lead já fechou ou já saiu do funil ativo).
  const hideTemp = isGanho || isPerdido || isFollowInfinito;

  // Em "Proposta": temperatura herdada do lead (CRM Leads).
  // Demais colunas: temperatura definida no avanço da oportunidade.
  const temp = hideTemp
    ? null
    : isProposta
    ? resolveTemp(lead?.temperatura)
    : resolveTemp(oportunidade.temperatura);
  const accent = temp?.accent ?? (isGanho ? "bg-emerald-500" : "bg-border/60");

  // Prioriza o nome_oportunidade (que pode ter sido editado pelo usuário).
  // Fallback para empresa/nome do lead caso esteja vazio.
  const titulo = oportunidade.nome_oportunidade || lead?.empresa || lead?.nome;
  // Subtítulo só aparece se for diferente do título (evita repetir).
  const possiveisSub = [lead?.empresa, lead?.nome].filter(Boolean) as string[];
  const subtitulo = possiveisSub.find((v) => v !== titulo) ?? null;

  const phone = lead?.telefone as string | undefined;
  const phoneFmt = formatPhone(phone);
  const wa = whatsappNumber(phone);

  const valorTotalNum = (Number(oportunidade.valor_ef) || 0) + (Number(oportunidade.valor_fee) || 0);
  const valorTotal = valorTotalNum > 0 ? fmtBRL(valorTotalNum) : null;
  const dataPrev = isGanho
    ? fmtDate(oportunidade.data_fechamento_real)
    : !isProposta
    ? fmtDate(oportunidade.data_fechamento_previsto)
    : null;

  const stopHard = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  const copyPhone = (e: React.MouseEvent) => {
    stopHard(e);
    if (!phoneFmt) return;
    navigator.clipboard.writeText(phoneFmt);
    toast({ title: "Telefone copiado", description: phoneFmt });
  };

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
        {/* Accent strip */}
        <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accent)} />

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
            {valorTotal && (
              <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground/90">
                {valorTotal}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {temp && (
              <span
                className={cn(
                  "text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide",
                  temp.cls
                )}
              >
                {temp.emoji} {temp.label}
              </span>
            )}
            {dataPrev && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-amber-500/10 text-amber-300 border-amber-500/30 inline-flex items-center gap-1 tabular-nums">
                <Calendar className="h-2.5 w-2.5" />{dataPrev}
              </span>
            )}
            {tarefasPendentes > 0 && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-primary/10 text-primary border-primary/30 inline-flex items-center gap-1 tabular-nums">
                <ListTodo className="h-2.5 w-2.5" />{tarefasPendentes}
              </span>
            )}
          </div>

          {oportunidade.etapa === "fechado_perdido" && oportunidade.motivo_perda && (
            <p className="text-[10px] text-red-400/80 mt-2 truncate" title={oportunidade.motivo_perda}>
              ✗ {oportunidade.motivo_perda}
            </p>
          )}
        </div>

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
                onClick={(e) => e.stopPropagation()}
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
