import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HubBentoWidget } from "../HubBentoWidget";
import { useAuth } from "@/hooks/useAuth";

interface PendenciasWidgetProps {
  onCount?: (n: number) => void;
}

export function PendenciasWidget({ onCount }: PendenciasWidgetProps) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["hub-pendencias", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("id, data_agendada")
        .eq("usuario_id", user!.id)
        .eq("concluida", false)
        .not("data_agendada", "is", null);

      if (error) throw error;
      const all = (data ?? []) as any[];
      const now = Date.now();
      const overdue = all.filter(
        (a) => a.data_agendada && new Date(a.data_agendada).getTime() < now
      ).length;
      return { total: all.length, overdue };
    },
  });

  const total = data?.total ?? 0;
  const overdue = data?.overdue ?? 0;
  if (onCount) onCount(total);

  return (
    <HubBentoWidget
      eyebrow="Pendências"
      title="ABERTAS"
      loading={isLoading}
      empty={!isLoading && total === 0}
      emptyLabel="Nenhuma pendência. Tudo em dia."
    >
      <div className="flex items-baseline gap-4">
        <span className="font-heading text-5xl lg:text-6xl text-foreground tabular-nums leading-none">
          {total}
        </span>
        <div className="flex flex-col text-sm">
          <span className="text-muted-foreground">
            {total === 1 ? "tarefa em aberto" : "tarefas em aberto"}
          </span>
          {overdue > 0 && (
            <span className="text-destructive font-medium">
              {overdue} {overdue === 1 ? "atrasada" : "atrasadas"}
            </span>
          )}
        </div>
      </div>
    </HubBentoWidget>
  );
}
