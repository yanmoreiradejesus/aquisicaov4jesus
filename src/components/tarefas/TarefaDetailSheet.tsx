import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Clock, User as UserIcon, Calendar, Play } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTarefa, useConcluirEtapa, useUpdateTarefa, ESCOPO_LABEL, PRIORIDADE_LABEL, STATUS_LABEL, type TarefaEtapa } from "@/hooks/useTarefas";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  tarefaId: string | null;
  onOpenChange: (v: boolean) => void;
}

const statusToneCls: Record<string, string> = {
  a_fazer: "bg-muted text-muted-foreground",
  em_execucao: "bg-primary/10 text-primary border-primary/30",
  bloqueada: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  concluida: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  cancelada: "bg-red-500/10 text-red-300 border-red-500/30",
};

export function TarefaDetailSheet({ tarefaId, onOpenChange }: Props) {
  const { data: tarefa, isLoading } = useTarefa(tarefaId || undefined);
  const { profiles } = useProfilesList({});
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, profileLabel(p)));
    return m;
  }, [profiles]);
  const concluirEtapa = useConcluirEtapa();
  const updateTarefa = useUpdateTarefa();
  const { toast } = useToast();

  const fmtDate = (iso?: string | null) =>
    iso ? format(new Date(iso), "dd/MM/yy", { locale: ptBR }) : "—";

  const handleConcluir = async (etapaId: string) => {
    try {
      await concluirEtapa.mutateAsync({ etapa_id: etapaId });
      toast({ title: "Etapa concluída — próxima em execução" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const cancelar = async () => {
    if (!tarefa) return;
    if (!confirm("Cancelar esta tarefa?")) return;
    await updateTarefa.mutateAsync({ id: tarefa.id, patch: { status: "cancelada" } });
    toast({ title: "Tarefa cancelada" });
  };

  return (
    <Sheet open={!!tarefaId} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {isLoading || !tarefa ? (
          <p className="text-sm text-muted-foreground mt-8">Carregando...</p>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-left">{tarefa.titulo}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={statusToneCls[tarefa.status]}>
                  {STATUS_LABEL[tarefa.status]}
                </Badge>
                <Badge variant="outline">{PRIORIDADE_LABEL[tarefa.prioridade]}</Badge>
                {tarefa.escopo && <Badge variant="outline">{ESCOPO_LABEL[tarefa.escopo]}</Badge>}
                {tarefa.prazo_final && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" /> {fmtDate(tarefa.prazo_final)}
                  </Badge>
                )}
              </div>

              {tarefa.descricao && (
                <div className="rounded-lg border border-border/40 bg-background/40 p-3">
                  <p className="text-sm text-foreground/85 whitespace-pre-wrap">{tarefa.descricao}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2">Fluxo</h3>
                <div className="space-y-2">
                  {tarefa.etapas?.map((e: TarefaEtapa) => {
                    const isAtual = e.id === tarefa.etapa_atual_id;
                    return (
                      <div
                        key={e.id}
                        className={cn(
                          "rounded-lg border p-3 space-y-1",
                          isAtual ? "border-primary/50 bg-primary/5" : "border-border/40 bg-background/30",
                          e.status === "concluida" && "opacity-70",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {e.status === "concluida" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : e.status === "em_execucao" ? (
                            <Play className="h-4 w-4 text-primary" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">#{e.ordem}</span>
                          <span className={cn("text-sm font-medium flex-1", e.status === "concluida" && "line-through")}>
                            {e.nome}
                          </span>
                          {isAtual && tarefa.status !== "concluida" && tarefa.status !== "cancelada" && (
                            <Button size="sm" onClick={() => handleConcluir(e.id)} disabled={concluirEtapa.isPending}>
                              Concluir
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground pl-6">
                          {e.funcao && <span>{e.funcao}</span>}
                          {e.responsavel_id && (
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" />
                              {nameById.get(e.responsavel_id) ?? "—"}
                            </span>
                          )}
                          {e.prazo && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {fmtDate(e.prazo)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {tarefa.status !== "concluida" && tarefa.status !== "cancelada" && (
                <Button variant="ghost" className="text-red-400 hover:text-red-500" onClick={cancelar}>
                  Cancelar tarefa
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
