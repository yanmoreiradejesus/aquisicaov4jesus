import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CallEvent {
  id: string;
  lead_id: string | null;
  provider: string;
  event_type: string;
  call_id: string | null;
  telefone: string | null;
  telefone_normalizado: string | null;
  operador: string | null;
  duracao_seg: number | null;
  status: string | null;
  gravacao_url: string | null;
  raw_payload: any;
  created_at: string;
  transcricao: string | null;
  transcricao_status: string | null;
  transcricao_error: string | null;
}

export function useLeadCallEvents(
  leadId?: string | null,
  userId?: string | "all" | null,
) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_call_events", leadId, userId ?? "all"],
    queryFn: async () => {
      if (!leadId) return [] as CallEvent[];
      let q = supabase
        .from("crm_call_events" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (userId && userId !== "all") {
        q = q.eq("user_id", userId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CallEvent[];
    },
    enabled: !!leadId,
  });

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`crm_call_events_${leadId}_${userId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_call_events", filter: `lead_id=eq.${leadId}` },
        () => qc.invalidateQueries({ queryKey: ["crm_call_events", leadId, userId ?? "all"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, userId, qc]);

  return query;
}
