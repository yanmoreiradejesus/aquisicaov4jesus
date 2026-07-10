import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CobrancaStatus = "pendente" | "pago" | "atrasado" | "cancelado";
export type CobrancaTipo = "fee_setup" | "fee_recorrente" | "ef";

export interface CobrancaRow {
  id: string;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
  tipo: CobrancaTipo;
  parcela_num: number | null;
  parcela_total: number | null;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  nota_fiscal: string | null;
  notas: string | null;
  account_id: string | null;
  oportunidade_id: string | null;
  created_at: string;
  account?: { id: string; cliente_nome: string | null } | null;
  oportunidade?: { id: string; nome_oportunidade: string | null } | null;
}

export const COBRANCA_STATUS_LABEL: Record<CobrancaStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

export const COBRANCA_STATUS_COLOR: Record<CobrancaStatus, string> = {
  pendente: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  pago: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  atrasado: "bg-red-500/10 text-red-300 border-red-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export const COBRANCA_TIPO_LABEL: Record<CobrancaTipo, string> = {
  fee_setup: "Fee setup",
  fee_recorrente: "Fee recorrente",
  ef: "EF",
};

export function useCobrancas() {
  return useQuery({
    queryKey: ["cobrancas", "admin-financeiro"],
    queryFn: async (): Promise<CobrancaRow[]> => {
      const { data, error } = await (supabase as any)
        .from("cobrancas")
        .select(
          "id, valor, vencimento, status, tipo, parcela_num, parcela_total, data_pagamento, forma_pagamento, nota_fiscal, notas, account_id, oportunidade_id, created_at, account:accounts(id, cliente_nome), oportunidade:crm_oportunidades(id, nome_oportunidade)"
        )
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CobrancaRow[];
    },
  });
}
