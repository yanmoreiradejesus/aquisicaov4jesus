import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const OPORTUNIDADE_ETAPAS: { id: string; label: string; color: string }[] = [
  { id: "proposta", label: "Proposta", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { id: "negociacao", label: "Negociação", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { id: "contrato", label: "Contrato", color: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  { id: "fechado_ganho", label: "Fechado/Ganho", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { id: "fechado_perdido", label: "Fechado/Perdido", color: "bg-red-500/10 text-red-400 border-red-500/30" },
];

export function useCrmOportunidades() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_oportunidades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_oportunidades" as any)
        .select("*, lead:crm_leads(id,nome,empresa,telefone,email)")
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
      const { lead, ...payload } = op;
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
    mutationFn: async ({ id, etapa, motivo_perda }: { id: string; etapa: string; motivo_perda?: string }) => {
      const patch: any = { etapa };
      if (etapa === "fechado_ganho") patch.data_fechamento_real = new Date().toISOString();
      if (etapa === "fechado_perdido" && motivo_perda) patch.motivo_perda = motivo_perda;
      const { error } = await supabase.from("crm_oportunidades" as any).update(patch).eq("id", id);
      if (error) throw error;
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
