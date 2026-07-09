import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProjetoStatus = "ativo" | "em_risco" | "pausado" | "encerrado" | "churn";

export const PROJETO_STATUS_LABEL: Record<ProjetoStatus, string> = {
  ativo: "Ativo",
  em_risco: "Em risco",
  pausado: "Pausado",
  encerrado: "Encerrado",
  churn: "Churn",
};

export const PROJETO_STATUS_COLOR: Record<ProjetoStatus, string> = {
  ativo: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  em_risco: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  pausado: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  encerrado: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  churn: "bg-red-500/10 text-red-300 border-red-500/30",
};

export interface ProjetoListRow {
  id: string;
  account_id: string;
  nome: string;
  status_projeto: ProjetoStatus;
  prazo_inicio: string | null;
  prazo_fim: string | null;
  updated_at: string;
  account: {
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
      nivel_consciencia: string | null;
    } | null;
  } | null;
  cobrancas: { valor: number | null; status: string | null }[];
}

export function useProjetos() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_projetos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crm_projetos")
        .select(
          "id, account_id, nome, status_projeto, prazo_inicio, prazo_fim, updated_at, account:accounts(id, cliente_nome, account_manager_id, data_inicio_contrato, data_fim_contrato, oportunidade:crm_oportunidades(id, nome_oportunidade, valor_ef, valor_fee))"
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const accountIds = rows.map((r) => r.account_id).filter(Boolean);
      let cobrancasByAccount: Record<string, { valor: number | null; status: string | null }[]> = {};
      if (accountIds.length) {
        const { data: cobs } = await (supabase as any)
          .from("cobrancas")
          .select("account_id, valor, status")
          .in("account_id", accountIds);
        (cobs ?? []).forEach((c: any) => {
          (cobrancasByAccount[c.account_id] ||= []).push({ valor: c.valor, status: c.status });
        });
      }
      return rows.map((r) => ({ ...r, cobrancas: cobrancasByAccount[r.account_id] ?? [] })) as ProjetoListRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("crm_projetos_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_projetos" }, () => {
        qc.invalidateQueries({ queryKey: ["crm_projetos"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export function agregarFinanceiro(cobrancas: { valor: number | null; status: string | null }[]) {
  const acc = { pago: 0, pendente: 0, atrasado: 0 };
  for (const c of cobrancas) {
    const v = Number(c.valor) || 0;
    if (c.status === "pago") acc.pago += v;
    else if (c.status === "atrasado") acc.atrasado += v;
    else if (c.status === "pendente") acc.pendente += v;
  }
  return acc;
}
