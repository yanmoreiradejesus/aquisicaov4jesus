import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExpansaoEtapa = "mapeada" | "proposta" | "negociacao" | "ganho" | "perdido";
export type ExpansaoTipoGanho = "aumento_fee" | "escopo_fechado" | "ambos";

export const EXPANSAO_ETAPAS: { id: ExpansaoEtapa; label: string; color: string }[] = [
  { id: "mapeada", label: "Oportunidades mapeadas", color: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
  { id: "proposta", label: "Proposta", color: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  { id: "negociacao", label: "Negociação", color: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  { id: "ganho", label: "Ganho", color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  { id: "perdido", label: "Perdidos", color: "bg-red-500/10 text-red-300 border-red-500/30" },
];

export interface ExpansaoRow {
  id: string;
  tenant_id: string;
  projeto_id: string;
  titulo: string;
  descricao: string | null;
  etapa: ExpansaoEtapa;
  responsavel_id: string | null;
  valor_estimado: number | null;
  tipo_ganho: ExpansaoTipoGanho | null;
  valor_aumento_fee: number | null;
  valor_escopo_fechado: number | null;
  data_ganho: string | null;
  motivo_perda: string | null;
  data_proposta: string | null;
  data_negociacao: string | null;
  contrato_path: string | null;
  novo_fee_mensal: number | null;
  created_at: string;
  updated_at: string;
  projeto?: {
    id: string;
    nome: string;
    account?: { id: string; cliente_nome: string | null; mrr: number | null; mrr_variavel: number | null } | null;
  } | null;
}

export function useExpansoes() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_expansoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_expansoes")
        .select("*, projeto:crm_projetos(id, nome, account:accounts(id, cliente_nome, mrr, mrr_variavel))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExpansaoRow[];
    },
  });

  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel("crm_expansoes_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_expansoes" }, () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["crm_expansoes"] });
          pending = null;
        }, 250);
      })
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const upsert = useMutation({
    mutationFn: async (row: Partial<ExpansaoRow> & { id?: string }) => {
      const { projeto, created_at, updated_at, tenant_id, ...rest } = row as any;
      const payload = {
        ...rest,
        valor_estimado:
          rest.valor_estimado === "" || rest.valor_estimado == null ? null : Number(rest.valor_estimado),
      };
      if (payload.id) {
        const { error } = await (supabase as any).from("crm_expansoes").update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await (supabase as any)
          .from("crm_expansoes")
          .insert({ ...payload, created_by: userData.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_expansoes"] }),
  });

  const updateEtapa = useMutation({
    mutationFn: async (args: {
      id: string;
      etapa: ExpansaoEtapa;
      tipo_ganho?: ExpansaoTipoGanho;
      valor_aumento_fee?: number | null;
      valor_escopo_fechado?: number | null;
      motivo_perda?: string;
      contrato_path?: string | null;
      novo_fee_mensal?: number | null;
      account_id?: string | null;
    }) => {
      const patch: any = { etapa: args.etapa };
      if (args.etapa === "ganho") {
        patch.tipo_ganho = args.tipo_ganho ?? null;
        patch.valor_aumento_fee = args.valor_aumento_fee ?? null;
        patch.valor_escopo_fechado = args.valor_escopo_fechado ?? null;
        if (args.contrato_path !== undefined) patch.contrato_path = args.contrato_path;
        if (args.novo_fee_mensal !== undefined) patch.novo_fee_mensal = args.novo_fee_mensal;
      }
      if (args.etapa === "perdido" && args.motivo_perda !== undefined) {
        patch.motivo_perda = args.motivo_perda;
      }
      const { error } = await (supabase as any).from("crm_expansoes").update(patch).eq("id", args.id);
      if (error) throw error;

      // Ao marcar Ganho: envia o contrato para "A faturar" (aquisição/expansão)
      // e atualiza o MRR da account se houve aumento de fee recorrente.
      if (args.etapa === "ganho" && args.account_id) {
        const temFee =
          args.tipo_ganho === "aumento_fee" || args.tipo_ganho === "ambos";
        const temEf =
          args.tipo_ganho === "escopo_fechado" || args.tipo_ganho === "ambos";
        const modelo = temFee && temEf ? "hibrido" : temFee ? "recorrente" : "escopo_fechado";

        const accPatch: any = {
          faturamento_status: "a_faturar",
          origem: "expansao",
          expansao_id: args.id,
          modelo_contrato: modelo,
          valor_ef_override: temEf ? args.valor_escopo_fechado ?? null : null,
          valor_fee_override: temFee ? args.novo_fee_mensal ?? null : null,
        };
        if (temFee && args.novo_fee_mensal != null) {
          accPatch.mrr = args.novo_fee_mensal;
        }
        await (supabase as any).from("accounts").update(accPatch).eq("id", args.account_id);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_expansoes"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("crm_expansoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_expansoes"] }),
  });

  return { ...query, upsert, updateEtapa, remove };
}
