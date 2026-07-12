import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { useTasks, TASK_STATUS_LABEL, TASK_PRIORIDADE_COLOR, TASK_PRIORIDADE_LABEL, type TaskRow, type TaskStatus } from "@/hooks/useTasks";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { Link } from "react-router-dom";
import { Plus, Folder } from "lucide-react";

interface ProjetoLite {
  id: string;
  nome: string;
  account: { cliente_nome: string | null } | null;
}

function useProjetosLite() {
  return useQuery({
    queryKey: ["projetos_lite"],
    queryFn: async (): Promise<ProjetoLite[]> => {
      const { data, error } = await (supabase as any)
        .from("crm_projetos")
        .select("id, nome, account:accounts(cliente_nome)")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ProjetoLite[];
    },
  });
}

const STATUS_TONE: Record<TaskStatus, string> = {
  backlog: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  em_execucao: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  revisao: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  aprovado: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  concluido: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  cancelado: "bg-red-500/10 text-red-300 border-red-500/30",
};

export default function Tarefas() {
  const { user } = useAuth();
  const { profiles } = useProfilesList({});
  const [filterResp, setFilterResp] = useState<string>("me");
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const responsavelId = filterResp === "me" ? user?.id : filterResp === "all" ? null : filterResp;
  const { data: tasks = [], create } = useTasks({ responsavelId });
  const { data: projetos = [] } = useProjetosLite();
  const projMap = useMemo(() => new Map(projetos.map((p) => [p.id, p])), [projetos]);
  const nameById = useMemo(() => new Map(profiles.map((p) => [p.id, profileLabel(p)])), [profiles]);

  const filtered = tasks.filter((t) => {
    if (filterStatus === "open" && (t.status === "concluido" || t.status === "cancelado")) return false;
    if (filterStatus !== "open" && filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search && !t.titulo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openTask = (id: string) => {
    setActiveTaskId(id);
    setSheetOpen(true);
  };

  const quickCreate = async () => {
    const titulo = prompt("Título da tarefa:");
    if (!titulo?.trim()) return;
    const t = await create.mutateAsync({ titulo: titulo.trim(), responsavel_id: user?.id ?? null });
    openTask(t.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-foreground">Tarefas</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestor nativo de tarefas e fluxos de produção.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/tarefas/projetos"><Folder className="h-4 w-4 mr-2" /> Por projeto</Link>
            </Button>
            <Button onClick={quickCreate}><Plus className="h-4 w-4 mr-2" /> Nova tarefa</Button>
          </div>
        </div>

        <Card className="p-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground">Responsável</label>
            <Select value={filterResp} onValueChange={setFilterResp}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Minhas tarefas</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Em aberto</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="em_execucao">Em execução</SelectItem>
                <SelectItem value="revisao">Revisão</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <Input className="mt-1" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título…" />
          </div>
        </Card>

        <div className="rounded-2xl border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-1/40 text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Tarefa</th>
                <th className="text-left px-3 py-2">Projeto</th>
                <th className="text-left px-3 py-2">Responsável</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Prioridade</th>
                <th className="text-left px-3 py-2">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma tarefa encontrada.</td></tr>
              )}
              {filtered.map((t) => {
                const p = t.projeto_id ? projMap.get(t.projeto_id) : null;
                return (
                  <tr key={t.id} onClick={() => openTask(t.id)} className="border-t border-border/30 hover:bg-surface-1/30 cursor-pointer">
                    <td className="px-3 py-2 font-medium">{t.titulo}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p ? (p.account?.cliente_nome || p.nome) : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.responsavel_id ? (nameById.get(t.responsavel_id) ?? "—") : "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={STATUS_TONE[t.status]}>{TASK_STATUS_LABEL[t.status]}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={TASK_PRIORIDADE_COLOR[t.prioridade]}>{TASK_PRIORIDADE_LABEL[t.prioridade]}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.prazo ? new Date(t.prazo).toLocaleDateString("pt-BR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      <TaskDetailSheet taskId={activeTaskId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
