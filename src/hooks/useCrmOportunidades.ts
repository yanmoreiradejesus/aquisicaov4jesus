import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const OPORTUNIDADE_ETAPAS: { id: string; label: string; color: string }[] = [
  { id: "fechado_perdido", label: "Perdido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  { id: "follow_infinito", label: "Follow Infinito", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  { id: "proposta", label: "Proposta", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { id: "negociacao", label: "Negociação", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { id: "contrato", label: "Dúvidas e Fechamento", color: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  { id: "fechado_ganho", label: "Ganho", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
];

export function useCrmOportunidades() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_oportunidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades" as any)
        .select("*, lead:crm_leads(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("crm_oportunidades_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_oportunidades" }, () => {
        qc.invalidateQueries({ queryKey: ["crm_oportunidades"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const upsert = useMutation({
    mutationFn: async (op: any) => {
      const { lead, created_at, updated_at, valor_total, ...rest } = op;
      const payload = {
        ...rest,
        valor_ef: rest.valor_ef === "" || rest.valor_ef == null ? null : Number(rest.valor_ef),
        valor_fee: rest.valor_fee === "" || rest.valor_fee == null ? null : Number(rest.valor_fee),
      };

      if (payload.id) {
        const { error } = await supabase.from("crm_oportunidades" as any).update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_oportunidades" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_oportunidades"] }),
  });

  const updateEtapa = useMutation({
    mutationFn: async ({
      id,
      etapa,
      motivo_perda,
      transcricao_reuniao,
      temperatura,
      novasTarefas,
      contrato_url,
      oportunidades_monetizacao,
      grau_exigencia,
      info_deal,
      valor_fee,
      valor_ef,
    }: {
      id: string;
      etapa: string;
      motivo_perda?: string;
      transcricao_reuniao?: string;
      temperatura?: string;
      novasTarefas?: { titulo: string; data_agendada: string }[];
      contrato_url?: string;
      oportunidades_monetizacao?: string;
      grau_exigencia?: string;
      info_deal?: string;
      valor_fee?: number | null;
      valor_ef?: number | null;
    }) => {
      const patch: any = { etapa };
      if (etapa === "fechado_ganho") patch.data_fechamento_real = new Date().toISOString();
      if (etapa === "fechado_perdido" && motivo_perda) patch.motivo_perda = motivo_perda;
      if (transcricao_reuniao !== undefined) patch.transcricao_reuniao = transcricao_reuniao;
      if (temperatura !== undefined) patch.temperatura = temperatura;
      if (contrato_url !== undefined) patch.contrato_url = contrato_url;
      if (oportunidades_monetizacao !== undefined) patch.oportunidades_monetizacao = oportunidades_monetizacao;
      if (grau_exigencia !== undefined) patch.grau_exigencia = grau_exigencia;
      if (info_deal !== undefined) patch.info_deal = info_deal;
      if (valor_fee !== undefined) patch.valor_fee = valor_fee;
      if (valor_ef !== undefined) patch.valor_ef = valor_ef;

      const { error } = await supabase.from("crm_oportunidades" as any).update(patch).eq("id", id);
      if (error) throw error;

      if (novasTarefas && novasTarefas.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const rows = novasTarefas.map((t) => ({
          oportunidade_id: id,
          tipo: "tarefa" as const,
          titulo: t.titulo,
          descricao: t.titulo,
          data_agendada: t.data_agendada,
          usuario_id: user?.id,
        }));
        const { error: errAt } = await supabase.from("crm_atividades" as any).insert(rows);
        if (errAt) throw errAt;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_oportunidades"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_oportunidades" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_oportunidades"] }),
  });

  return { ...query, upsert, updateEtapa, remove };
}
