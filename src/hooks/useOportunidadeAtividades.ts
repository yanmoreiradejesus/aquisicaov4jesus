import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Atividade } from "./useLeadAtividades";

export function useOportunidadeAtividades(oportunidadeId?: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_atividades_op", oportunidadeId],
    queryFn: async () => {
      if (!oportunidadeId) return [] as Atividade[];
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("*")
        .eq("oportunidade_id", oportunidadeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Atividade[];
    },
    enabled: !!oportunidadeId,
  });

  useEffect(() => {
    if (!oportunidadeId) return;
    const channel = supabase
      .channel(`crm_atividades_op_${oportunidadeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_atividades",
          filter: `oportunidade_id=eq.${oportunidadeId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["crm_atividades_op", oportunidadeId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [oportunidadeId, qc]);

  const addNota = useMutation({
    mutationFn: async (descricao: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("crm_atividades" as any).insert({
        oportunidade_id: oportunidadeId,
        tipo: "nota",
        descricao,
        usuario_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades_op", oportunidadeId] }),
  });

  const addTarefa = useMutation({
    mutationFn: async ({ titulo, data_agendada }: { titulo: string; data_agendada: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("crm_atividades" as any).insert({
        oportunidade_id: oportunidadeId,
        tipo: "tarefa",
        titulo,
        descricao: titulo,
        data_agendada,
        usuario_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades_op", oportunidadeId] }),
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .update({ concluida, data_conclusao: concluida ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades_op", oportunidadeId] }),
  });

  const addReuniao = useMutation({
    mutationFn: async ({ titulo, descricao }: { titulo: string; descricao: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("crm_atividades" as any).insert({
        oportunidade_id: oportunidadeId,
        tipo: "reuniao",
        titulo,
        descricao,
        usuario_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades_op", oportunidadeId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_atividades" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades_op", oportunidadeId] }),
  });

  return { ...query, addNota, addTarefa, toggleTarefa, remove };
}
