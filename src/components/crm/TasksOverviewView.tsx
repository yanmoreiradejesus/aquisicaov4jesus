import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isPast, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, Circle, AlertTriangle, Calendar as CalendarIcon, ArrowRight, ChevronDown, Eye, EyeOff, Trash2, Pencil, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { cn } from "@/lib/utils";
import { TaskEditDialog, TaskEditValue } from "./TaskEditDialog";

interface TaskRow {
  id: string;
  lead_id: string | null;
  titulo: string | null;
  descricao: string | null;
  data_agendada: string | null;
  data_conclusao: string | null;
  concluida: boolean;
  google_event_id: string | null;
  google_sync_status: string | null;
  google_sync_error: string | null;
  lead_nome?: string | null;
  lead_empresa?: string | null;
}

interface Props {
  onOpenLead?: (leadId: string) => void;
}

type SectionKey = "atrasadas" | "hoje" | "amanha" | "proximos" | "concluidas";

const CONCLUIDAS_LIMIT = 20;

function fireSync(atividade_id: string, action: "upsert" | "delete", google_event_id?: string | null) {
  supabase.functions
    .invoke("sync-task-to-google", { body: { atividade_id, action, google_event_id } })
    .catch((err) => console.warn("[sync-task-to-google]", err));
}

export function TasksOverviewView({ onOpenLead }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { isConnected: googleConnected } = useGoogleCalendar();
  const [editTask, setEditTask] = useState<TaskEditValue | null>(null);
  const [hidden, setHidden] = useState<Record<SectionKey, boolean>>({
    atrasadas: false, hoje: false, amanha: false, proximos: false, concluidas: false,
  });
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    atrasadas: true, hoje: true, amanha: false, proximos: false, concluidas: false,
  });
  const [showAllConcluidas, setShowAllConcluidas] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm_atividades_overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("id, lead_id, titulo, descricao, data_agendada, data_conclusao, concluida, google_event_id, google_sync_status, google_sync_error, crm_leads!inner(nome, empresa)")
        .eq("tipo", "tarefa")
        .not("data_agendada", "is", null)
        .order("data_agendada", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        lead_id: r.lead_id,
        titulo: r.titulo,
        descricao: r.descricao,
        data_agendada: r.data_agendada,
        data_conclusao: r.data_conclusao,
        concluida: r.concluida,
        google_event_id: r.google_event_id,
        google_sync_status: r.google_sync_status,
        google_sync_error: r.google_sync_error,
        lead_nome: r.crm_leads?.nome,
        lead_empresa: r.crm_leads?.empresa,
      })) as TaskRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm_atividades_overview"] });
    qc.invalidateQueries({ queryKey: ["crm_atividades"] });
  };

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .update({ concluida, data_conclusao: concluida ? new Date().toISOString() : null, google_sync_status: "pending" })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id, vars) => {
      invalidate();
      fireSync(id, "upsert");
      toast({ title: vars.concluida ? "Tarefa concluída" : "Tarefa reaberta" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, titulo, data_agendada }: { id: string; titulo: string; data_agendada: string }) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .update({ titulo, descricao: titulo, data_agendada, google_sync_status: "pending" })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      invalidate();
      fireSync(id, "upsert");
      toast({ title: "Tarefa atualizada" });
      setEditTask(null);
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const removeTask = useMutation({
    mutationFn: async (task: TaskRow) => {
      const { error } = await supabase.from("crm_atividades" as any).delete().eq("id", task.id);
      if (error) throw error;
      return task;
    },
    onSuccess: (task) => {
      invalidate();
      if (task.google_event_id) fireSync(task.id, "delete", task.google_event_id);
      toast({ title: "Tarefa excluída" });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const groups = useMemo(() => {
    const atrasadas: TaskRow[] = [];
    const hoje: TaskRow[] = [];
    const amanha: TaskRow[] = [];
    const proximos: TaskRow[] = [];
    const concluidas: TaskRow[] = [];
    const limiteProx = endOfDay(addDays(new Date(), 7));

    tasks.forEach((t) => {
      if (t.concluida) { concluidas.push(t); return; }
      if (!t.data_agendada) return;
      const d = new Date(t.data_agendada);
      if (isPast(d) && !isToday(d)) atrasadas.push(t);
      else if (isToday(d)) hoje.push(t);
      else if (isTomorrow(d)) amanha.push(t);
      else if (d <= limiteProx) proximos.push(t);
      else proximos.push(t);
    });
    concluidas.sort((a, b) => {
      const ad = a.data_conclusao ? new Date(a.data_conclusao).getTime() : 0;
      const bd = b.data_conclusao ? new Date(b.data_conclusao).getTime() : 0;
      return bd - ad;
    });
    return { atrasadas, hoje, amanha, proximos, concluidas };
  }, [tasks]);

  const total = tasks.length;

  const SyncIcon = ({ t }: { t: TaskRow }) => {
    if (t.google_sync_status === "synced" && t.google_event_id) {
      return (
        <TooltipProvider><Tooltip>
          <TooltipTrigger asChild>
            <CalendarIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          </TooltipTrigger>
          <TooltipContent>Sincronizado com Google Calendar (15min)</TooltipContent>
        </Tooltip></TooltipProvider>
      );
    }
    if (t.google_sync_status === "error") {
      return (
        <TooltipProvider><Tooltip>
          <TooltipTrigger asChild>
            <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          </TooltipTrigger>
          <TooltipContent>Erro ao sincronizar: {t.google_sync_error || "desconhecido"}</TooltipContent>
        </Tooltip></TooltipProvider>
      );
    }
    return null;
  };

  const TaskItem = ({ t }: { t: TaskRow }) => {
    const d = t.data_agendada ? new Date(t.data_agendada) : null;
    return (
      <li className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-surface-1/60 hover:bg-surface-2/70 px-4 py-3 transition-colors",
        t.concluida && "opacity-70"
      )}>
        <button
          onClick={() => toggle.mutate({ id: t.id, concluida: !t.concluida })}
          className={cn(
            "transition-colors shrink-0",
            t.concluida ? "text-emerald-400 hover:text-muted-foreground" : "text-muted-foreground hover:text-emerald-400"
          )}
          title={t.concluida ? "Reabrir tarefa" : "Marcar como concluída"}
        >
          {t.concluida ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
        </button>
        <p className={cn(
          "flex-1 min-w-0 text-sm text-foreground leading-snug break-words",
          t.concluida && "line-through text-muted-foreground"
        )}>
          {t.titulo || t.descricao || "Tarefa"}
        </p>
        {d && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <CalendarClock className="h-3.5 w-3.5" />
            {format(d, "dd/MM HH'h'mm", { locale: ptBR })}
            <SyncIcon t={t} />
          </span>
        )}
        {t.lead_nome && (
          <button
            onClick={() => { if (t.lead_id && onOpenLead) onOpenLead(t.lead_id); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <span className="truncate max-w-[180px]">{t.lead_empresa || t.lead_nome}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
        {!t.concluida && (
          <button
            onClick={() => setEditTask({ id: t.id, titulo: t.titulo || t.descricao || "", data_agendada: t.data_agendada || "" })}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all shrink-0 p-1 rounded-md hover:bg-primary/10"
            title="Editar tarefa"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => { if (confirm("Excluir esta tarefa?")) removeTask.mutate(t); }}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0 p-1 rounded-md hover:bg-destructive/10"
          title="Excluir tarefa"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </li>
    );
  };

  const Section = ({ sectionKey, title, icon: Icon, items, tone, isConcluidas }: {
    sectionKey: SectionKey; title: string; icon: any; items: TaskRow[];
    tone: "danger" | "primary" | "warning" | "muted" | "success"; isConcluidas?: boolean;
  }) => {
    const toneClasses = {
      danger: "text-red-400 border-red-500/30 bg-red-500/10",
      primary: "text-primary border-primary/30 bg-primary/10",
      warning: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      muted: "text-muted-foreground border-border bg-surface-2/50",
      success: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    }[tone];

    const isHidden = hidden[sectionKey];
    const isOpen = open[sectionKey] && !isHidden;
    const visibleItems = isConcluidas && !showAllConcluidas ? items.slice(0, CONCLUIDAS_LIMIT) : items;

    return (
      <Collapsible open={isOpen} onOpenChange={(v) => setOpen((o) => ({ ...o, [sectionKey]: v }))} className="glass rounded-2xl shadow-ios-sm overflow-hidden">
        <div className="flex items-center gap-2 p-3">
          <CollapsibleTrigger disabled={isHidden} className="flex-1 flex items-center gap-3 text-left disabled:cursor-not-allowed group">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center border", toneClasses)}><Icon className="h-4 w-4" /></div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform ml-auto", isOpen && "rotate-180")} />
          </CollapsibleTrigger>
          <button onClick={() => setHidden((h) => ({ ...h, [sectionKey]: !h[sectionKey] }))} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-surface-2" title={isHidden ? "Mostrar tarefas" : "Ocultar tarefas"}>
            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t border-border/60">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma tarefa</p>
            ) : (
              <>
                <ul className="space-y-2 pt-3">{visibleItems.map((t) => <TaskItem key={t.id} t={t} />)}</ul>
                {isConcluidas && items.length > CONCLUIDAS_LIMIT && (
                  <button onClick={() => setShowAllConcluidas((v) => !v)} className="w-full mt-3 text-xs text-primary hover:text-primary/80 transition-colors py-2">
                    {showAllConcluidas ? "Mostrar menos" : `Ver mais (${items.length - CONCLUIDAS_LIMIT})`}
                  </button>
                )}
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="animate-fade-in">
      {googleConnected === false && (
        <div className="max-w-4xl mx-auto mb-3 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Conecte sua conta Google em <a href="/perfil" className="underline font-medium">/perfil</a> para sincronizar tarefas automaticamente com o Google Calendar (eventos de 15min).</p>
        </div>
      )}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : total === 0 ? (
        <div className="text-center py-20 glass rounded-2xl">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3 opacity-60" />
          <p className="text-base text-muted-foreground">Nenhuma tarefa. Bom trabalho!</p>
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl mx-auto">
          <Section sectionKey="atrasadas" title="Atrasadas" icon={AlertTriangle} items={groups.atrasadas} tone="danger" />
          <Section sectionKey="hoje" title="De hoje" icon={CalendarClock} items={groups.hoje} tone="primary" />
          <Section sectionKey="amanha" title="De amanhã" icon={CalendarIcon} items={groups.amanha} tone="warning" />
          <Section sectionKey="proximos" title="Próximos dias" icon={CalendarIcon} items={groups.proximos} tone="muted" />
          <Section sectionKey="concluidas" title="Concluídas" icon={CheckCircle2} items={groups.concluidas} tone="success" isConcluidas />
        </div>
      )}
      <TaskEditDialog
        open={!!editTask}
        onOpenChange={(v) => { if (!v) setEditTask(null); }}
        task={editTask}
        onSave={(p) => updateTask.mutate(p)}
        saving={updateTask.isPending}
      />
    </div>
  );
}
