import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, Calendar, AlertTriangle, Workflow } from "lucide-react";

type EkyteTask = {
  id_local: string;
  ekyte_id: number;
  title: string | null;
  situation: number | null;
  phase: string | null;
  executor: string | null;
  current_due_date: string | null;
  resolved_date: string | null;
  creation_date: string | null;
};

type Period = "30" | "90" | "all";

const fmtDate = (iso?: string | null) =>
  !iso ? "—" : new Date(iso).toLocaleDateString("pt-BR");

const daysBetween = (a: Date, b: Date) =>
  Math.floor((a.getTime() - b.getTime()) / 86_400_000);

interface Props {
  workspaceId: number | null | undefined;
  tenantId: string | null | undefined;
}

export function AccountEkyteTasks({ workspaceId, tenantId }: Props) {
  const [period, setPeriod] = useState<Period>("90");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["ekyte-tasks", workspaceId, tenantId, period],
    enabled: !!workspaceId && !!tenantId,
    queryFn: async () => {
      let q = supabase
        .from("ekyte_tasks")
        .select("id_local,ekyte_id,title,situation,phase,executor,current_due_date,resolved_date,creation_date")
        .eq("tenant_id", tenantId!)
        .eq("workspace_ekyte_id", workspaceId!)
        .limit(1000);

      if (period !== "all") {
        const days = period === "30" ? 30 : 90;
        const since = new Date();
        since.setDate(since.getDate() - days);
        const iso = since.toISOString();
        q = q.or(`creation_date.gte.${iso},resolved_date.gte.${iso}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EkyteTask[];
    },
  });

  const { concluidas, atrasadas, andamento } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const concluidas: EkyteTask[] = [];
    const atrasadas: EkyteTask[] = [];
    const andamento: EkyteTask[] = [];

    for (const t of tasks) {
      if (t.situation === 40) continue;
      if (t.situation === 30) {
        concluidas.push(t);
        continue;
      }
      const due = t.current_due_date ? new Date(t.current_due_date) : null;
      if (due) due.setHours(0, 0, 0, 0);
      if (due && due < today) atrasadas.push(t);
      else andamento.push(t);
    }
    return { concluidas, atrasadas, andamento };
  }, [tasks]);

  if (!workspaceId) {
    return (
      <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Esta conta ainda não está vinculada a um workspace do eKyte.
        </p>
      </div>
    );
  }

  const TaskCard = ({ t, overdueDays }: { t: EkyteTask; overdueDays?: number }) => (
    <div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-1.5 hover:border-border transition-colors">
      <p className="text-[13px] font-medium text-foreground/95 leading-snug">{t.title ?? "—"}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {t.executor && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" /> {t.executor}
          </span>
        )}
        {t.phase && (
          <span className="inline-flex items-center gap-1">
            <Workflow className="h-3 w-3" /> {t.phase}
          </span>
        )}
        {t.current_due_date && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {fmtDate(t.current_due_date)}
          </span>
        )}
      </div>
      {overdueDays != null && overdueDays > 0 && (
        <div className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          <AlertTriangle className="h-3 w-3" /> {overdueDays} {overdueDays === 1 ? "dia" : "dias"} de atraso
        </div>
      )}
    </div>
  );

  const Column = ({
    title,
    items,
    tone,
    overdue,
  }: {
    title: string;
    items: EkyteTask[];
    tone: "default" | "danger" | "success";
    overdue?: boolean;
  }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toneCls =
      tone === "danger"
        ? "text-destructive"
        : tone === "success"
          ? "text-emerald-400"
          : "text-foreground/90";
    return (
      <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-4 flex flex-col min-h-[200px]">
        <div className="flex items-center justify-between mb-3">
          <h4 className={`text-[13px] font-semibold ${toneCls}`}>
            {title} <span className="text-muted-foreground font-normal">({items.length})</span>
          </h4>
        </div>
        <div className="space-y-2 flex-1">
          {items.length === 0 ? (
            <p className="text-[12px] text-muted-foreground py-2">Nenhuma tarefa.</p>
          ) : (
            items.map((t) => {
              const od = overdue && t.current_due_date
                ? daysBetween(today, new Date(t.current_due_date))
                : undefined;
              return <TaskCard key={t.id_local} t={t} overdueDays={od} />;
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground/90">
          Tarefas (eKyte)
        </h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando tarefas...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Column title="Em andamento" items={andamento} tone="default" />
          <Column title="Atrasada" items={atrasadas} tone="danger" overdue />
          <Column title="Concluída" items={concluidas} tone="success" />
        </div>
      )}
    </section>
  );
}
