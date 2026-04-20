import { useState } from "react";
import { Loader2, Search, RefreshCw, AlertCircle, Lightbulb, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PreQualItem {
  titulo: string;
  descricao: string;
}

export interface PreQualification {
  status?: "pending" | "generating" | "ready" | "error";
  contexto?: string;
  insights?: PreQualItem[];
  desafios?: PreQualItem[];
  generated_at?: string;
  error?: string;
  model?: string;
}

interface Props {
  leadId: string | null | undefined;
  pesquisa: PreQualification | null | undefined;
  readOnly?: boolean;
}

export const PreQualificationPanel = ({ leadId, pesquisa, readOnly }: Props) => {
  const [invoking, setInvoking] = useState(false);
  const { toast } = useToast();

  const status = pesquisa?.status;
  const isGenerating = status === "generating" || invoking;
  const isReady =
    status === "ready" &&
    !!pesquisa?.contexto &&
    (pesquisa?.insights?.length ?? 0) > 0;
  const isError = status === "error";
  const isEmpty = !pesquisa || (!isGenerating && !isReady && !isError);

  const trigger = async (force = false) => {
    if (!leadId) return;
    setInvoking(true);
    try {
      const { error } = await supabase.functions.invoke("generate-pre-qualification", {
        body: { lead_id: leadId, force },
      });
      if (error) throw error;
      toast({ title: "Pesquisa solicitada", description: "Gerando pesquisa de pré-qualificação…" });
    } catch (e: any) {
      toast({
        title: "Erro ao gerar pesquisa",
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
          <Search className="h-4 w-4 text-primary" />
          <p className="text-[11px] font-semibold tracking-widest uppercase text-foreground">
            Pesquisa Pré-Qualificação · IA
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
            Pesquisa rápida de contexto e possíveis desafios para preparar a primeira tentativa de contato.
          </p>
          {!readOnly && (
            <Button size="sm" onClick={() => trigger(false)} disabled={!leadId || isGenerating}>
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Gerar pesquisa
            </Button>
          )}
        </div>
      )}

      {isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Gerando pesquisa rápida… (alguns segundos)
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {isError && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Falha ao gerar pesquisa: {pesquisa?.error ?? "erro desconhecido"}</span>
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
          {pesquisa?.contexto && (
            <div className="rounded-md bg-muted/20 border border-border/30 px-3 py-2.5">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1">
                Contexto
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {pesquisa.contexto}
              </p>
            </div>
          )}

          {(pesquisa?.insights?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" />
                Insights de mercado
              </p>
              {pesquisa!.insights!.map((it, i) => (
                <div
                  key={`ins-${i}`}
                  className="rounded-md border border-border/40 bg-background/40 p-3 space-y-1"
                >
                  <p className="text-sm font-semibold text-foreground leading-snug">{it.titulo}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{it.descricao}</p>
                </div>
              ))}
            </div>
          )}

          {(pesquisa?.desafios?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                Possíveis desafios
              </p>
              {pesquisa!.desafios!.map((it, i) => (
                <div
                  key={`des-${i}`}
                  className="rounded-md border border-border/40 bg-background/40 p-3 space-y-1"
                >
                  <p className="text-sm font-semibold text-foreground leading-snug">{it.titulo}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{it.descricao}</p>
                </div>
              ))}
            </div>
          )}

          {pesquisa?.generated_at && (
            <p className="text-[10px] text-muted-foreground/70">
              Gerado em {new Date(pesquisa.generated_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
