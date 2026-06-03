import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivitiesPeriod {
  startISO: string;
  endISO: string;
  pipe?: "all" | "inbound" | "outbound";
}

/**
 * Busca métricas agregadas da tela de Atividades.
 * Toda a contagem é feita no banco via RPC — não trazemos linhas brutas.
 */
export function useCrmActivities({ startISO, endISO, pipe = "all" }: ActivitiesPeriod) {
  return useQuery({
    queryKey: ["crm_activities", startISO, endISO, pipe],
    queryFn: async () => {
      const [sdrRes, sdrTotalsRes, closerRes] = await Promise.all([
        supabase.rpc("get_sdr_activity_stats" as any, {
          p_start: startISO,
          p_end: endISO,
          p_pipe: pipe,
        }),
        supabase.rpc("get_sdr_activity_totals" as any, {
          p_start: startISO,
          p_end: endISO,
          p_pipe: pipe,
        }),
        supabase.rpc("get_closer_activity_stats" as any, {
          p_start: startISO,
          p_end: endISO,
          p_pipe: pipe,
        }),
      ]);

      if (sdrRes.error) throw sdrRes.error;
      if (sdrTotalsRes.error) throw sdrTotalsRes.error;
      if (closerRes.error) throw closerRes.error;

      const sdrTotals = ((sdrTotalsRes.data ?? []) as Array<{
        ligacoes: number;
        contato_realizado: number;
        reunioes_agendadas: number;
        reunioes_realizadas: number;
        no_show: number;
        conversoes: number;
      }>)[0];

      return {
        sdrTotals,
        sdrRows: (sdrRes.data ?? []) as Array<{
          user_id: string;
          ligacoes: number;
          contato_realizado: number;
          reunioes_agendadas: number;
          reunioes_realizadas: number;
          no_show: number;
          conversoes: number;
        }>,
        closerRows: (closerRes.data ?? []) as Array<{
          user_id: string;
          reunioes_realizadas: number;
          propostas: number;
          followups: number;
          fechamentos_ganhos: number;
          fechamentos_perdidos: number;
          receita_total: number;
        }>,
      };
    },
    refetchOnWindowFocus: false,
  });
}

