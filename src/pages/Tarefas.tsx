import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Calendar, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NovaTarefaDialog } from "@/components/tarefas/NovaTarefaDialog";
import { TarefaDetailSheet } from "@/components/tarefas/TarefaDetailSheet";
import { useTarefas, STATUS_LABEL, ESCOPO_LABEL, PRIORIDADE_LABEL, type TarefaStatus } from "@/hooks/useTarefas";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { useProjetos } from "@/hooks/useProjetos";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const statusToneCls: Record<TarefaStatus, string> = {
  a_fazer: "bg-muted text-muted-foreground",
  em_execucao: "bg-primary/10 text-primary border-primary/30",
  bloqueada: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  concluida: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  cancelada: "bg-red-500/10 text-red-300 border-red-500/30",
};

const prioridadeCls: Record<string, string> = {
  baixa: "text-muted-foreground",
  media: "text-foreground/80",
  alta: "text-amber-300",
  urgente: "text-red-400",
};

export default function Tarefas() {
  const { user } = useAuth();
  const [novaOpen, setNovaOpen] = useState(false);
  const [openTarefa, setOpenTarefa] = useState<string | null>(null);
  const [tab, setTab] = useState<"minhas" | "todas">("minhas");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TarefaStatus | "all">("all");
  const [projetoFilter, setProjetoFilter] = useState<string>("all");
  const [executorFilter, setExecutorFilter] = useState<string>("all");

  const { data: tarefas = [], isLoading } = useTarefas({
    responsavelId: tab === "minhas" ? user?.id : (executorFilter !== "all" ? executorFilter : undefined),
    projetoId: projetoFilter !== "all" ? projetoFilter : undefined,
  });
  const { profiles } = useProfilesList({});
  const { data: projetos = [] } = useProjetos();
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, profileLabel(p)));
    return m;
  }, [profiles]);

  const filtered = tarefas.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search && !t.titulo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const fmtDate = (iso?: string | null) =>
    iso ? format(new Date(iso), "dd/MM", { locale: ptBR }) : "—";

  return (
    <div className="min-h-screen bg-background pt-20 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">PE&amp;G</p>
            <h1 className="font-display text-[28px] lg:text-[34px] font-semibold tracking-[-0.02em] text-foreground">Tarefas</h1>
          </div>
          <Button onClick={() => setNovaOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Nova tarefa
          </Button>
        </div>

        <div className="flex items-center gap-2 border-b border-border/40">
          {(["minhas", "todas"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === k
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {k === "minhas" ? "Minhas tarefas" : "Todas"}
            </button>
          ))}
          <a href="/peg/tarefas/squad" className="ml-auto text-xs text-primary hover:underline">Visão de squad →</a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefa..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {(Object.keys(STATUS_LABEL) as TarefaStatus[]).map((k) => (
                <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projetoFilter} onValueChange={setProjetoFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Projeto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos projetos</SelectItem>
              {projetos.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.nome || p.account?.cliente_nome || "—"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tab === "todas" && (
            <Select value={executorFilter} onValueChange={setExecutorFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Executor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos executores</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-surface-1/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Tarefa</th>
                  <th className="text-left px-4 py-2 font-medium">Etapa atual</th>
                  <th className="text-left px-4 py-2 font-medium">Responsável</th>
                  <th className="text-left px-4 py-2 font-medium">Prioridade</th>
                  <th className="text-left px-4 py-2 font-medium">Prazo</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setOpenTarefa(t.id)}
                    className="border-b border-border/20 hover:bg-surface-2/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="text-foreground font-medium">{t.titulo}</div>
                      {t.escopo && <div className="text-[11px] text-muted-foreground mt-0.5">{ESCOPO_LABEL[t.escopo]}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground/85">{t.etapa_atual?.nome ?? "—"}</span>
                      {t.etapa_atual?.funcao && (
                        <div className="text-[11px] text-muted-foreground">{t.etapa_atual.funcao}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {t.etapa_atual?.responsavel_id ? (
                        <span className="inline-flex items-center gap-1 text-foreground/85">
                          <UserIcon className="h-3 w-3" /> {nameById.get(t.etapa_atual.responsavel_id) ?? "—"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className={cn("px-4 py-3", prioridadeCls[t.prioridade])}>
                      {PRIORIDADE_LABEL[t.prioridade]}
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {t.prazo_final ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {fmtDate(t.prazo_final)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusToneCls[t.status]}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NovaTarefaDialog open={novaOpen} onOpenChange={setNovaOpen} />
      <TarefaDetailSheet tarefaId={openTarefa} onOpenChange={(v) => !v && setOpenTarefa(null)} />
    </div>
  );
}
