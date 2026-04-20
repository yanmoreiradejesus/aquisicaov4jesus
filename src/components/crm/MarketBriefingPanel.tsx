import { useState } from "react";
import { Loader2, Sparkles, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MarketBriefingHighlight {
  topico: string;
  resumo: string;
  fonte_url: string;
  fonte_nome: string;
}

export interface MarketBriefing {
  status?: "pending" | "generating" | "ready" | "error";
  resumo?: string;
  highlights?: MarketBriefingHighlight[];
  generated_at?: string;
  error?: string;
  model?: string;
}

interface Props {
  leadId: string | null | undefined;
  briefing: MarketBriefing | null | undefined;
  readOnly?: boolean;
}

export const MarketBriefingPanel = ({ leadId, briefing, readOnly }: Props) => {
  const [invoking, setInvoking] = useState(false);
  const { toast } = useToast();

  const status = briefing?.status;
  const isGenerating = status === "generating" || invoking;
  const isReady = status === "ready" && (briefing?.highlights?.length ?? 0) > 0;
  const isError = status === "error";
  const isEmpty = !briefing || (!isGenerating && !isReady && !isError);

  const trigger = async (force = false) => {
    if (!leadId) return;
    setInvoking(true);
    try {
      const { error } = await supabase.functions.invoke("generate-market-briefing", {
        body: { lead_id: leadId, force },
      });
      if (error) throw error;
      toast({ title: "Briefing solicitado", description: "Claude está pesquisando o mercado…" });
    } catch (e: any) {
      toast({
        title: "Erro ao gerar briefing",
        description: e?.message ?? "Falha desconhecida",
        variant: "destructive",
      });
    } finally {
      setInvoking(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/40 bg-background/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-[11px] font-semibold tracking-widest uppercase text-foreground">
            Briefing de Mercado · IA
          </p>
        </div>
        {!readOnly && isReady && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => trigger(true)}
            disabled={isGenerating}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${isGenerating ? "animate-spin" : ""}`} />
            Regenerar
          </Button>
        )}
      </div>

      {isEmpty && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Gere um briefing de mercado com fontes reais sobre o segmento e modelo de negócio do lead.
          </p>
          {!readOnly && (
            <Button size="sm" onClick={() => trigger(false)} disabled={!leadId || isGenerating}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Gerar briefing
            </Button>
          )}
        </div>
      )}

      {isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Claude está pesquisando o mercado… (pode levar 30–60s)
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {isError && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Falha ao gerar briefing: {briefing?.error ?? "erro desconhecido"}</span>
          </div>
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={() => trigger(true)} disabled={isGenerating}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {isReady && (
        <div className="space-y-3">
          {briefing?.resumo && (
            <div className="rounded-md bg-muted/20 border border-border/30 px-3 py-2.5">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1">
                Resumo do mercado / modelo
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {briefing.resumo}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Highlights ({briefing?.highlights?.length ?? 0})
            </p>
            {(briefing?.highlights ?? []).map((h, i) => (
              <div
                key={i}
                className="rounded-md border border-border/40 bg-background/40 p-3 space-y-1.5"
              >
                <p className="text-sm font-semibold text-foreground leading-snug">{h.topico}</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{h.resumo}</p>
                {h.fonte_url && (
                  <a
                    href={h.fonte_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {h.fonte_nome || "Fonte"}
                  </a>
                )}
              </div>
            ))}
          </div>

          {briefing?.generated_at && (
            <p className="text-[10px] text-muted-foreground/70">
              Gerado em {new Date(briefing.generated_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
