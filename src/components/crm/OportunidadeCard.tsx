import { useEffect, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Calendar, DollarSign, Flame, Thermometer, Snowflake, ListTodo, Copy, MessageCircle } from "lucide-react";
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

// Tag estilo "etiqueta de reunião" (oportunidade) — usada nas demais colunas
const TEMP_META: Record<string, { icon: any; color: string; accent: string; label: string }> = {
  quente: { icon: Flame, color: "bg-red-500/10 text-red-400 border-red-500/30", accent: "bg-temp-hot", label: "Quente" },
  morno: { icon: Thermometer, color: "bg-amber-500/10 text-amber-400 border-amber-500/30", accent: "bg-temp-warm", label: "Morno" },
  frio: { icon: Snowflake, color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30", accent: "bg-temp-cold", label: "Frio" },
};

// Pílula no padrão LeadCard (label vindo do CRM Leads — "Quente", "Morno", "Frio")
const LEAD_TEMP_PILL: Record<string, { emoji: string; cls: string; accent: string }> = {
  Quente: { emoji: "🔥", cls: "bg-temp-hot/15 text-temp-hot border-temp-hot/40", accent: "bg-temp-hot" },
  Morno: { emoji: "🌤️", cls: "bg-temp-warm/15 text-temp-warm border-temp-warm/40", accent: "bg-temp-warm" },
  Frio: { emoji: "❄️", cls: "bg-temp-cold/15 text-temp-cold border-temp-cold/40", accent: "bg-temp-cold" },
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

  // ===== MODO PROPOSTA: card no estilo do CRM Leads, com a temperatura herdada do lead =====
  if (isProposta && lead) {
    const leadTemp = lead.temperatura ? LEAD_TEMP_PILL[lead.temperatura] : null;
    const accent = leadTemp?.accent ?? "bg-border/60";
    const phone = lead.telefone as string | undefined;
    const phoneFmt = formatPhone(phone);
    const wa = whatsappNumber(phone);

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
              : "border-border/50 card-lift shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80",
          )}
        >
          {/* Accent strip (igual LeadCard) */}
          <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accent)} />

          <div
            {...(overlay ? {} : listeners)}
            onClick={overlay ? undefined : onClick}
            className={cn("pl-3.5 pr-3 py-3", overlay ? "cursor-grabbing" : "cursor-grab active:cursor-grabbing")}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold text-[13px] leading-snug text-foreground truncate tracking-[-0.01em]">
                  {lead.empresa || lead.nome}
                </div>
                {lead.empresa && (
                  <p className="font-display font-normal text-[11px] text-muted-foreground truncate mt-0.5">
                    {lead.nome}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {leadTemp && (
                <span
                  className={cn(
                    "text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide",
                    leadTemp.cls,
                  )}
                >
                  {leadTemp.emoji} {lead.temperatura}
                </span>
              )}
              {tarefasPendentes > 0 && (
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-primary/10 text-primary border-primary/30 inline-flex items-center gap-1 tabular-nums">
                  <ListTodo className="h-2.5 w-2.5" />{tarefasPendentes}
                </span>
              )}
            </div>
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
  }

  // ===== DEMAIS COLUNAS: visual atual com a etiqueta de temperatura definida na aba Reunião =====
  const titulo = oportunidade.nome_oportunidade;
  const subtitulo = lead?.empresa || lead?.nome;
  const valorTotalNum = (Number(oportunidade.valor_ef) || 0) + (Number(oportunidade.valor_fee) || 0);
  const valorTotal = valorTotalNum > 0 ? fmtBRL(valorTotalNum) : null;
  const dataPrev = fmtDate(oportunidade.data_fechamento_previsto);
  const tempMeta = oportunidade.temperatura ? TEMP_META[oportunidade.temperatura] : null;
  const TempIcon = tempMeta?.icon;

  return (
    <div ref={overlay ? undefined : setNodeRef} style={style} {...(overlay ? {} : attributes)}>
      <div
        {...(overlay ? {} : listeners)}
        onClick={overlay ? undefined : onClick}
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border/50 bg-surface-1/80 backdrop-blur-sm px-3 py-3",
          overlay
            ? "shadow-ios-xl ring-1 ring-primary/30 border-primary/50 rotate-[1.5deg] scale-[1.04] cursor-grabbing"
            : "card-lift cursor-grab active:cursor-grabbing shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80"
        )}
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
          {tempMeta && TempIcon && (
            <span
              className={cn(
                "shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md border",
                tempMeta.color
              )}
              title={`Temperatura: ${tempMeta.label}`}
            >
              <TempIcon className="h-3 w-3" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {valorTotal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold tracking-wide text-foreground/90 tabular-nums">
              {valorTotal}
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
    </div>
  );
};
