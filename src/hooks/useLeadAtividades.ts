import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AtividadeTipo =
  | "ligacao"
  | "email"
  | "reuniao"
  | "nota"
  | "whatsapp"
  | "tarefa"
  | "mudanca_etapa"
  | "criacao";

export interface Atividade {
  id: string;
  lead_id: string | null;
  tipo: AtividadeTipo;
  descricao: string | null;
  titulo: string | null;
  usuario_id: string | null;
  data_agendada: string | null;
  concluida: boolean;
  data_conclusao: string | null;
  created_at: string;
}

export function useLeadAtividades(leadId?: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_atividades", leadId],
    queryFn: async () => {
      if (!leadId) return [] as Atividade[];
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Atividade[];
    },
    enabled: !!leadId,
  });

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`crm_atividades_${leadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_atividades", filter: `lead_id=eq.${leadId}` },
        () => qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, qc]);

  const addNota = useMutation({
    mutationFn: async (descricao: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("crm_atividades" as any).insert({
        lead_id: leadId,
        tipo: "nota",
        descricao,
        usuario_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] }),
  });

  const addTarefa = useMutation({
    mutationFn: async ({ titulo, data_agendada }: { titulo: string; data_agendada: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("crm_atividades" as any).insert({
        lead_id: leadId,
        tipo: "tarefa",
        titulo,
        descricao: titulo,
        data_agendada,
        usuario_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] }),
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .update({ concluida, data_conclusao: concluida ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_atividades" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] }),
  });

  return { ...query, addNota, addTarefa, toggleTarefa, remove };
}
