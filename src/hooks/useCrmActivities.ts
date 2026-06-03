import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ActivitiesPeriod {
  startISO: string;
  endISO: string;
}

/**
 * Busca dados brutos do CRM no período, em paralelo.
 * Os cálculos por usuário (SDR/Closer) ficam em utils/atividadesCalculator.
 */
export function useCrmActivities({ startISO, endISO }: ActivitiesPeriod) {
  return useQuery({
    queryKey: ["crm_activities", startISO, endISO],
    queryFn: async () => {
      const [callsRes, atividadesRes, leadsRes, opsRes, voipRes] = await Promise.all([
        supabase
          .from("crm_call_events" as any)
          .select("id, user_id, operador, duracao_seg, status, created_at, lead_id")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .limit(10000),
        supabase
          .from("crm_atividades" as any)
          .select("id, tipo, descricao, usuario_id, lead_id, oportunidade_id, created_at, data_agendada, data_conclusao, concluida")
          .gte("created_at", startISO)
          .lte("created_at", endISO)
          .limit(10000),
        supabase
          .from("crm_leads" as any)
          .select("id, responsavel_id, closer_id, etapa, pipe, data_reuniao_agendada, data_reuniao_realizada, created_at, updated_at")
          .limit(10000),
        supabase
          .from("crm_oportunidades" as any)
          .select("id, lead_id, closer_id, responsavel_id, etapa, valor_ef, valor_fee, data_proposta, data_fechamento_real, created_at, updated_at")
          .limit(10000),
        supabase
          .from("voip_accounts" as any)
          .select("user_id, operador_id, provider, ativo"),
      ]);

      if (callsRes.error) throw callsRes.error;
      if (atividadesRes.error) throw atividadesRes.error;
      if (leadsRes.error) throw leadsRes.error;
      if (opsRes.error) throw opsRes.error;
      if (voipRes.error) throw voipRes.error;

      return {
        calls: (callsRes.data ?? []) as any[],
        atividades: (atividadesRes.data ?? []) as any[],
        leads: (leadsRes.data ?? []) as any[],
        oportunidades: (opsRes.data ?? []) as any[],
        voip: (voipRes.data ?? []) as any[],
      };
    },
    refetchOnWindowFocus: false,
  });
}
