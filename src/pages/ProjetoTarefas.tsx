import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { useTasks, TASK_STATUS_LABEL, TASK_STATUS_ORDER, TASK_PRIORIDADE_COLOR, TASK_PRIORIDADE_LABEL, type TaskRow, type TaskStatus } from "@/hooks/useTasks";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";

function useProjetos() {
  return useQuery({
    queryKey: ["projetos_lite_kanban"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_projetos")
        .select("id, nome, account:accounts(cliente_nome)")
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; account: { cliente_nome: string | null } | null }[];
    },
  });
}

export default function ProjetoTarefas() {
  const { projetoId } = useParams<{ projetoId: string }>();
  const { user } = useAuth();
  const { profiles } = useProfilesList({});
  const nameById = useMemo(() => new Map(profiles.map((p) => [p.id, profileLabel(p)])), [profiles]);

  const { data: projetos = [] } = useProjetos();
  const projeto = projetos.find((p) => p.id === projetoId);

  const { data: tasks = [], create, update } = useTasks({ projetoId });
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  // Project selector view when no projetoId
  if (!projetoId) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">Tarefas por projeto</h1>
              <p className="text-sm text-muted-foreground mt-1">Selecione um projeto para abrir o kanban.</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/tarefas"><ArrowLeft className="h-4 w-4 mr-2" /> Voltar</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projetos.map((p) => (
              <Link key={p.id} to={`/tarefas/projeto/${p.id}`}>
                <Card className="p-4 hover:border-primary/50 transition-colors">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{p.account?.cliente_nome || "—"}</div>
                  <div className="font-display font-semibold mt-1">{p.nome}</div>
                </Card>
              </Link>
            ))}
            {projetos.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full">Nenhum projeto cadastrado.</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  const byStatus: Record<TaskStatus, TaskRow[]> = {
    backlog: [], em_execucao: [], revisao: [], aprovado: [], concluido: [], cancelado: [],
  };
  tasks.forEach((t) => { byStatus[t.status]?.push(t); });

  const openTask = (id: string) => { setActiveTaskId(id); setSheetOpen(true); };

  const quickCreate = async (status: TaskStatus) => {
    const titulo = prompt("Título da tarefa:");
    if (!titulo?.trim()) return;
    const t = await create.mutateAsync({
      titulo: titulo.trim(),
      projeto_id: projetoId,
      status,
      responsavel_id: user?.id ?? null,
    });
    openTask(t.id);
  };

  const onDrop = (status: TaskStatus, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    setDragOverStatus(null);
    if (id) update.mutate({ id, patch: { status } });
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{projeto?.account?.cliente_nome || ""}</div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{projeto?.nome || "Projeto"}</h1>
          </div>
          <Button variant="outline" asChild>
            <Link to="/tarefas/projetos"><ArrowLeft className="h-4 w-4 mr-2" /> Trocar projeto</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {TASK_STATUS_ORDER.map((s) => (
            <div
              key={s}
              onDragOver={(e) => { e.preventDefault(); setDragOverStatus(s); }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => onDrop(s, e)}
              className={`rounded-2xl border p-3 min-h-[400px] flex flex-col transition-colors ${
                dragOverStatus === s ? "border-primary/60 bg-primary/5" : "border-border/40 bg-surface-1/40"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold">
                  {TASK_STATUS_LABEL[s]} <span className="text-muted-foreground font-normal">({byStatus[s].length})</span>
                </h3>
                <button onClick={() => quickCreate(s)} className="text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-2 flex-1">
                {byStatus[s].map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", t.id)}
                    onClick={() => openTask(t.id)}
                    className="rounded-xl border border-border/40 bg-background/60 p-2.5 space-y-1.5 hover:border-border cursor-pointer"
                  >
                    <p className="text-[13px] font-medium leading-snug">{t.titulo}</p>
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <Badge variant="outline" className={`${TASK_PRIORIDADE_COLOR[t.prioridade]} text-[10px]`}>
                        {TASK_PRIORIDADE_LABEL[t.prioridade]}
                      </Badge>
                      {t.responsavel_id && (
                        <span className="text-[10px] text-muted-foreground">{nameById.get(t.responsavel_id) ?? ""}</span>
                      )}
                      {t.prazo && (
                        <span className="text-[10px] text-muted-foreground ml-auto">{new Date(t.prazo).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <TaskDetailSheet taskId={activeTaskId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
