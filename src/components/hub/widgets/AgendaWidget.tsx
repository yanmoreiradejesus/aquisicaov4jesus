import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HubBentoWidget } from "../HubBentoWidget";
import { useAuth } from "@/hooks/useAuth";

interface AgendaWidgetProps {
  onCount?: (n: number) => void;
}

export function AgendaWidget({ onCount }: AgendaWidgetProps) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["hub-agenda", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("id, titulo, descricao, tipo, data_agendada, lead_id, oportunidade_id")
        .eq("usuario_id", user!.id)
        .eq("concluida", false)
        .gte("data_agendada", now.toISOString())
        .lte("data_agendada", endOfDay.toISOString())
        .order("data_agendada", { ascending: true })
        .limit(3);

      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const items = data ?? [];
  if (onCount) onCount(items.length);

  return (
    <HubBentoWidget
      eyebrow="Agenda"
      title="HOJE"
      loading={isLoading}
      empty={!isLoading && items.length === 0}
      emptyLabel="Sem compromissos para hoje."
    >
      <ul className="space-y-3">
        {items.map((it) => {
          const time = it.data_agendada
            ? new Date(it.data_agendada).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "--:--";
          return (
            <li key={it.id} className="flex items-start gap-3">
              <span className="font-heading text-base text-primary tabular-nums shrink-0 w-12">
                {time}
              </span>
              <span className="text-sm text-foreground/90 line-clamp-2">
                {it.titulo || it.descricao || "Compromisso"}
              </span>
            </li>
          );
        })}
      </ul>
    </HubBentoWidget>
  );
}
