import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isPast, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, Circle, AlertTriangle, Calendar as CalendarIcon, ArrowRight, ChevronDown, Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TaskRow {
  id: string;
  oportunidade_id: string | null;
  titulo: string | null;
  descricao: string | null;
  data_agendada: string | null;
  data_conclusao: string | null;
  concluida: boolean;
  op_nome?: string | null;
  lead_nome?: string | null;
  lead_empresa?: string | null;
}

interface Props {
  onOpenOportunidade?: (oportunidadeId: string) => void;
}

type SectionKey = "atrasadas" | "hoje" | "amanha" | "proximos" | "concluidas";

const CONCLUIDAS_LIMIT = 20;

export function OportunidadeTasksOverview({ onOpenOportunidade }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [hidden, setHidden] = useState<Record<SectionKey, boolean>>({
    atrasadas: false,
    hoje: false,
    amanha: false,
    proximos: false,
    concluidas: false,
  });
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    atrasadas: true,
    hoje: true,
    amanha: false,
    proximos: false,
    concluidas: false,
  });
  const [showAllConcluidas, setShowAllConcluidas] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm_atividades_oport_overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("id, oportunidade_id, titulo, descricao, data_agendada, data_conclusao, concluida, crm_oportunidades!inner(nome_oportunidade, crm_leads(nome, empresa))")
        .eq("tipo", "tarefa")
        .not("oportunidade_id", "is", null)
        .not("data_agendada", "is", null)
        .order("data_agendada", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        oportunidade_id: r.oportunidade_id,
        titulo: r.titulo,
        descricao: r.descricao,
        data_agendada: r.data_agendada,
        data_conclusao: r.data_conclusao,
        concluida: r.concluida,
        op_nome: r.crm_oportunidades?.nome_oportunidade,
        lead_nome: r.crm_oportunidades?.crm_leads?.nome,
        lead_empresa: r.crm_oportunidades?.crm_leads?.empresa,
      })) as TaskRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .update({
          concluida,
          data_conclusao: concluida ? new Date().toISOString() : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm_atividades_oport_overview"] });
      qc.invalidateQueries({ queryKey: ["crm_atividades"] });
      toast({ title: vars.concluida ? "Tarefa concluída" : "Tarefa reaberta" });
    },
  });

  const removeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_atividades_oport_overview"] });
      qc.invalidateQueries({ queryKey: ["crm_atividades"] });
      toast({ title: "Tarefa excluída" });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao excluir tarefa",
        description: err?.message || "Não foi possível excluir a tarefa.",
        variant: "destructive",
      });
    },
  });

  const groups = useMemo(() => {
    const atrasadas: TaskRow[] = [];
    const hoje: TaskRow[] = [];
    const amanha: TaskRow[] = [];
    const proximos: TaskRow[] = [];
    const concluidas: TaskRow[] = [];
    const limiteProx = endOfDay(addDays(new Date(), 7));

    tasks.forEach((t) => {
      if (t.concluida) {
        concluidas.push(t);
        return;
      }
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

  const TaskItem = ({ t }: { t: TaskRow }) => {
    const d = t.data_agendada ? new Date(t.data_agendada) : null;
    const ref = t.lead_empresa || t.lead_nome || t.op_nome;

    const handleDelete = () => {
      if (!confirm("Excluir esta tarefa?")) return;
      removeTask.mutate(t.id);
    };

    return (
      <li
        className={cn(
          "group flex items-center gap-3 rounded-xl border border-border bg-surface-1/60 hover:bg-surface-2/70 px-4 py-3 transition-colors",
          t.concluida && "opacity-70"
        )}
      >
        <button
          onClick={() => toggle.mutate({ id: t.id, concluida: !t.concluida })}
          className={cn(
            "transition-colors shrink-0",
            t.concluida
              ? "text-emerald-400 hover:text-muted-foreground"
              : "text-muted-foreground hover:text-emerald-400"
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
          </span>
        )}
        {ref && (
          <button
            onClick={() => {
              if (t.oportunidade_id && onOpenOportunidade) onOpenOportunidade(t.oportunidade_id);
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <span className="truncate max-w-[180px]">{ref}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={removeTask.isPending}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-40"
          title="Excluir tarefa"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </li>
    );
  };

  const Section = ({
    sectionKey,
    title,
    icon: Icon,
    items,
    tone,
    isConcluidas,
  }: {
    sectionKey: SectionKey;
    title: string;
    icon: any;
    items: TaskRow[];
    tone: "danger" | "primary" | "warning" | "muted" | "success";
    isConcluidas?: boolean;
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
      <Collapsible
        open={isOpen}
        onOpenChange={(v) => setOpen((o) => ({ ...o, [sectionKey]: v }))}
        className="glass rounded-2xl shadow-ios-sm overflow-hidden"
      >
        <div className="flex items-center gap-2 p-3">
          <CollapsibleTrigger
            disabled={isHidden}
            className="flex-1 flex items-center gap-3 text-left disabled:cursor-not-allowed group"
          >
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center border", toneClasses)}>
              <Icon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform ml-auto",
              isOpen && "rotate-180"
            )} />
          </CollapsibleTrigger>
          <button
            onClick={() => setHidden((h) => ({ ...h, [sectionKey]: !h[sectionKey] }))}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-surface-2"
            title={isHidden ? "Mostrar tarefas" : "Ocultar tarefas"}
          >
            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t border-border/60">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma tarefa</p>
            ) : (
              <>
                <ul className="space-y-2 pt-3">
                  {visibleItems.map((t) => <TaskItem key={t.id} t={t} />)}
                </ul>
                {isConcluidas && items.length > CONCLUIDAS_LIMIT && (
                  <button
                    onClick={() => setShowAllConcluidas((v) => !v)}
                    className="w-full mt-3 text-xs text-primary hover:text-primary/80 transition-colors py-2"
                  >
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
    </div>
  );
}
