import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCrmOportunidades } from "@/hooks/useCrmOportunidades";
import { OportunidadeDetailSheet } from "@/components/crm/OportunidadeDetailSheet";
import { MotivoPerdaDialog } from "@/components/crm/MotivoPerdaDialog";
import { OportunidadeAvancarDialog, computeNeededSteps } from "@/components/crm/OportunidadeAvancarDialog";
import WinCelebration from "@/components/celebrations/WinCelebration";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const WORKFLOW_ETAPAS = new Set(["negociacao", "contrato", "follow_infinito", "fechado_ganho"]);

const OportunidadeDetailPage = () => {
  const { oportunidadeId } = useParams<{ oportunidadeId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: oportunidades = [], isLoading, upsert, updateEtapa, remove } = useCrmOportunidades();

  const [perdaOpen, setPerdaOpen] = useState(false);
  const [pendingPerda, setPendingPerda] = useState<any | null>(null);
  const [avancarOpen, setAvancarOpen] = useState(false);
  const [pendingAvanco, setPendingAvanco] = useState<{ op: any; etapa: string } | null>(null);
  const [celebration, setCelebration] = useState<{ nome_oportunidade: string; valor_total?: number } | null>(null);

  const op = useMemo(() => oportunidades.find((o: any) => o.id === oportunidadeId), [oportunidades, oportunidadeId]);

  useEffect(() => {
    if (!isLoading && oportunidadeId && !op) {
      toast({ title: "Oportunidade não encontrada", variant: "destructive" });
      navigate("/comercial/oportunidades", { replace: true });
    }
  }, [isLoading, oportunidadeId, op, navigate, toast]);

  if (isLoading || !op) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const moveOp = (
    id: string,
    etapa: string,
    extras: any = {},
  ) => {
    updateEtapa.mutate(
      { id, etapa, ...extras },
      {
        onSuccess: () => {
          if (etapa === "fechado_ganho") {
            setCelebration({
              nome_oportunidade: op?.nome_oportunidade ?? "Oportunidade",
              valor_total: extras.valor_fee != null || extras.valor_ef != null
                ? Number(extras.valor_fee ?? op?.valor_fee ?? 0) + Number(extras.valor_ef ?? op?.valor_ef ?? 0)
                : op?.valor_total,
            });
            toast({ title: "Oportunidade ganha! 🎉", description: "Cliente e cobranças criados automaticamente." });
          } else if (etapa === "fechado_perdido") {
            toast({ title: "Oportunidade marcada como perdida" });
          } else {
            toast({ title: "Etapa atualizada" });
          }
        },
        onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
      }
    );
  };

  const dispatchEtapa = async (target: any, destino: string) => {
    if (target.etapa === destino) return;
    if (destino === "fechado_perdido") {
      setPendingPerda(target);
      setPerdaOpen(true);
      return;
    }
    const isWorkflow = (target.etapa === "proposta" && destino === "negociacao") || WORKFLOW_ETAPAS.has(destino);
    if (!isWorkflow) {
      moveOp(target.id, destino);
      return;
    }
    const { data: tarefas } = await supabase
      .from("crm_atividades" as any)
      .select("id")
      .eq("oportunidade_id", target.id)
      .eq("tipo", "tarefa")
      .eq("concluida", false);
    const tarefasCount = (tarefas as any[] | null)?.length ?? 0;
    const needs = computeNeededSteps(target, destino, tarefasCount);
    if (!needs.any) { moveOp(target.id, destino); return; }
    setPendingAvanco({ op: target, etapa: destino });
    setAvancarOpen(true);
  };

  const handleConfirmPerda = async (motivo: string) => {
    if (!pendingPerda) return;
    moveOp(pendingPerda.id, "fechado_perdido", { motivo_perda: motivo });
    setPendingPerda(null);
  };

  const handleConfirmAvanco = async (payload: any) => {
    if (!pendingAvanco) return;
    await new Promise<void>((resolve, reject) => {
      updateEtapa.mutate(
        {
          id: pendingAvanco.op.id,
          etapa: pendingAvanco.etapa,
          ...payload,
          ...(payload.ganho ?? {}),
        },
        {
          onSuccess: () => {
            if (pendingAvanco.etapa === "fechado_ganho") {
              setCelebration({
                nome_oportunidade: pendingAvanco.op?.nome_oportunidade ?? "Oportunidade",
                valor_total: (Number(payload.valor_fee ?? pendingAvanco.op?.valor_fee ?? 0) + Number(payload.valor_ef ?? pendingAvanco.op?.valor_ef ?? 0)) || pendingAvanco.op?.valor_total,
              });
              toast({ title: "Oportunidade ganha! 🎉" });
            } else {
              toast({ title: "Etapa atualizada" });
            }
            resolve();
          },
          onError: (err: any) => { toast({ title: "Erro", description: err.message, variant: "destructive" }); reject(err); },
        }
      );
    });
    setPendingAvanco(null);
  };

  const handleSave = async (o: any) => { await upsert.mutateAsync(o); };
  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast({ title: "Oportunidade excluída" });
      navigate("/comercial/oportunidades", { replace: true });
    } catch (err: any) {
      const msg = err?.message || "";
      const friendly = msg.includes("row-level security") || msg.includes("permission")
        ? "Você não tem permissão para excluir oportunidades."
        : msg || "Não foi possível excluir.";
      toast({ title: "Erro ao excluir", description: friendly, variant: "destructive" });
    }
  };

  return (
    <>
      <OportunidadeDetailSheet
        fullPage
        backTo="/comercial/oportunidades"
        open={true}
        onOpenChange={(v) => { if (!v) navigate("/comercial/oportunidades"); }}
        oportunidade={op}
        onSave={handleSave}
        onDelete={handleDelete}
        onChangeEtapa={(_id, destino, target) => dispatchEtapa(target, destino)}
      />
      <MotivoPerdaDialog
        open={perdaOpen}
        onOpenChange={(v) => { setPerdaOpen(v); if (!v) setPendingPerda(null); }}
        onConfirm={handleConfirmPerda}
      />
      <OportunidadeAvancarDialog
        open={avancarOpen}
        onOpenChange={(v) => { setAvancarOpen(v); if (!v) setPendingAvanco(null); }}
        oportunidade={pendingAvanco?.op ?? null}
        etapaDestino={pendingAvanco?.etapa ?? ""}
        onConfirm={handleConfirmAvanco}
      />
      {celebration && (
        <WinCelebration oportunidade={celebration} onComplete={() => setCelebration(null)} />
      )}
    </>
  );
};

export default OportunidadeDetailPage;
