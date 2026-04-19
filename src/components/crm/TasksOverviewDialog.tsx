import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, isToday, isTomorrow, isPast, startOfDay, endOfDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, Circle, AlertTriangle, Calendar as CalendarIcon, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TaskRow {
  id: string;
  lead_id: string | null;
  titulo: string | null;
  descricao: string | null;
  data_agendada: string | null;
  concluida: boolean;
  lead_nome?: string | null;
  lead_empresa?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenLead?: (leadId: string) => void;
}

export function TasksOverviewDialog({ open, onOpenChange, onOpenLead }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm_atividades_overview"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("id, lead_id, titulo, descricao, data_agendada, concluida, crm_leads!inner(nome, empresa)")
        .eq("tipo", "tarefa")
        .eq("concluida", false)
        .not("data_agendada", "is", null)
        .order("data_agendada", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        lead_id: r.lead_id,
        titulo: r.titulo,
        descricao: r.descricao,
        data_agendada: r.data_agendada,
        concluida: r.concluida,
        lead_nome: r.crm_leads?.nome,
        lead_empresa: r.crm_leads?.empresa,
      })) as TaskRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .update({ concluida: true, data_conclusao: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_atividades_overview"] });
      qc.invalidateQueries({ queryKey: ["crm_atividades"] });
      toast({ title: "Tarefa concluída" });
    },
  });

  const groups = useMemo(() => {
    const atrasadas: TaskRow[] = [];
    const hoje: TaskRow[] = [];
    const amanha: TaskRow[] = [];
    const proximos: TaskRow[] = [];
    const limiteProx = endOfDay(addDays(new Date(), 7));

    tasks.forEach((t) => {
      if (!t.data_agendada) return;
      const d = new Date(t.data_agendada);
      if (isPast(d) && !isToday(d)) atrasadas.push(t);
      else if (isToday(d)) hoje.push(t);
      else if (isTomorrow(d)) amanha.push(t);
      else if (d <= limiteProx) proximos.push(t);
      else proximos.push(t);
    });
    return { atrasadas, hoje, amanha, proximos };
  }, [tasks]);

  const total = tasks.length;

  const Section = ({
    title,
    icon: Icon,
    items,
    tone,
  }: {
    title: string;
    icon: any;
    items: TaskRow[];
    tone: "danger" | "primary" | "warning" | "muted";
  }) => {
    const toneClasses = {
      danger: "text-red-400 border-red-500/30 bg-red-500/10",
      primary: "text-primary border-primary/30 bg-primary/10",
      warning: "text-amber-400 border-amber-500/30 bg-amber-500/10",
      muted: "text-muted-foreground border-border bg-surface-2/50",
    }[tone];

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center border", toneClasses)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{items.length}</Badge>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-9">Nenhuma tarefa</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((t) => {
              const d = t.data_agendada ? new Date(t.data_agendada) : null;
              return (
                <li
                  key={t.id}
                  className="group flex items-start gap-2 rounded-xl border border-border bg-surface-1/60 hover:bg-surface-2/60 p-2.5 transition-colors"
                >
                  <button
                    onClick={() => toggle.mutate(t.id)}
                    className="mt-0.5 text-muted-foreground hover:text-emerald-400 transition-colors"
                    title="Marcar como concluída"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-tight truncate">
                      {t.titulo || t.descricao || "Tarefa"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                      {d && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {format(d, "dd/MM HH'h'mm", { locale: ptBR })}
                        </span>
                      )}
                      {t.lead_nome && (
                        <button
                          onClick={() => {
                            if (t.lead_id && onOpenLead) {
                              onOpenChange(false);
                              onOpenLead(t.lead_id);
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                        >
                          <span className="truncate max-w-[180px]">
                            {t.lead_empresa || t.lead_nome}
                          </span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Visão geral de tarefas
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{total}</Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 py-4 space-y-5">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : total === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-60" />
                <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente. Bom trabalho!</p>
              </div>
            ) : (
              <>
                <Section title="Atrasadas" icon={AlertTriangle} items={groups.atrasadas} tone="danger" />
                <Section title="De hoje" icon={CalendarClock} items={groups.hoje} tone="primary" />
                <Section title="De amanhã" icon={CalendarIcon} items={groups.amanha} tone="warning" />
                <Section title="Próximos dias" icon={CalendarIcon} items={groups.proximos} tone="muted" />
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
