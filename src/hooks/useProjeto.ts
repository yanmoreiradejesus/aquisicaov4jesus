import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjetoStatus } from "./useProjetos";

export interface KpiAlvo {
  nome: string;
  meta: string;
  unidade?: string;
}

export interface StackItem {
  ferramenta: string;
  categoria: string;
}

export interface LinkItem {
  label: string;
  url: string;
  categoria: string;
}

export interface TimeMember {
  profile_id?: string | null;
  nome_livre?: string | null;
  papel: string;
}

export interface ProjetoDetail {
  id: string;
  account_id: string;
  tenant_id: string;
  nome: string;
  status_projeto: ProjetoStatus;
  descricao: string | null;
  objetivos: string | null;
  kpis_alvo: KpiAlvo[];
  prazo_inicio: string | null;
  prazo_fim: string | null;
  stack: StackItem[];
  links: LinkItem[];
  time: TimeMember[];
  documentacao: string | null;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    cliente_nome: string | null;
    account_manager_id: string | null;
    data_inicio_contrato: string | null;
    data_fim_contrato: string | null;
    oportunidade?: {
      id: string;
      nome_oportunidade: string | null;
      valor_ef: number | null;
      valor_fee: number | null;
    } | null;
  };
  cobrancas?: { id: string; valor: number | null; status: string | null; vencimento: string | null; tipo: string | null; parcela_num: number | null; parcela_total: number | null }[];
}

export function useProjeto(id: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_projeto", id],
    enabled: !!id,
    queryFn: async (): Promise<ProjetoDetail | null> => {
      const { data, error } = await (supabase as any)
        .from("crm_projetos")
        .select(
          "*, account:accounts(id, cliente_nome, account_manager_id, data_inicio_contrato, data_fim_contrato, oportunidade:crm_oportunidades(id, nome_oportunidade, valor_ef, valor_fee))"
        )
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const { data: cobs } = await (supabase as any)
        .from("cobrancas")
        .select("id, valor, status, vencimento, tipo, parcela_num, parcela_total")
        .eq("account_id", (data as any).account_id)
        .order("vencimento", { ascending: true });

      const normalized = {
        ...(data as any),
        kpis_alvo: (data as any).kpis_alvo ?? [],
        stack: (data as any).stack ?? [],
        links: (data as any).links ?? [],
        time: (data as any).time ?? [],
        cobrancas: cobs ?? [],
      } as ProjetoDetail;
      return normalized;
    },
  });

  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`crm_projeto_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_projetos", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["crm_projeto", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [id, qc]);

  const update = useMutation({
    mutationFn: async (patch: Partial<ProjetoDetail>) => {
      if (!id) throw new Error("id ausente");
      const { account, cobrancas, created_at, updated_at, tenant_id, id: _id, account_id, ...rest } = patch as any;
      const { error } = await (supabase as any).from("crm_projetos").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm_projeto", id] });
      qc.invalidateQueries({ queryKey: ["crm_projetos"] });
    },
  });

  return { ...query, update };
}
