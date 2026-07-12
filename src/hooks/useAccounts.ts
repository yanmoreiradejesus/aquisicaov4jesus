import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SquadKey = "strikers" | "fenix" | "saber";

export const SQUAD_LABEL: Record<SquadKey, string> = {
  strikers: "Strikers",
  fenix: "Fênix",
  saber: "Saber",
};

export interface AccountScopeChips {
  trafego: boolean;
  social_media: boolean;
  design: boolean;
  crm: boolean;
  validado: boolean;
}

export interface AccountRow {
  id: string;
  cliente_nome: string;
  squad: SquadKey | null;
  mrr: number | null;
  effective_mrr: number | null;
  health_score: number | null;
  onboarding_status: string;
  status: string;
  
  data_fim_contrato: string | null;
  data_inicio_contrato: string | null;
  account_manager_id: string | null;
  gt_id: string | null;
  designer_id: string | null;
  social_media_id: string | null;
  playbook_url: string | null;
  growthpack_url: string | null;
  drive_url: string | null;
  valor_fee_override: number | null;
  valor_ef_override: number | null;
  oportunidade_id: string | null;
  oportunidade_valor_fee: number | null;
  oportunidade_valor_ef: number | null;
  projeto_id: string | null;
  escopo: AccountScopeChips;
}

const SELECT = `
  id, cliente_nome, squad, mrr, health_score, onboarding_status, status,
  data_fim_contrato, data_inicio_contrato,
  account_manager_id, gt_id, designer_id, social_media_id,
  playbook_url, growthpack_url, drive_url,
  valor_fee_override, valor_ef_override, oportunidade_id,
  oportunidade:crm_oportunidades(valor_fee, valor_ef),
  projeto:crm_projetos(id, escopo_trafego, escopo_social_media, escopo_design, escopo_crm, escopo_validado)
`;

function mapRow(r: any): AccountRow {
  const opFee = r.oportunidade?.valor_fee != null ? Number(r.oportunidade.valor_fee) : null;
  const opEf = r.oportunidade?.valor_ef != null ? Number(r.oportunidade.valor_ef) : null;
  const override = r.valor_fee_override != null ? Number(r.valor_fee_override) : null;
  const effectiveMrr = override ?? opFee ?? (r.mrr != null ? Number(r.mrr) : null);
  const proj = Array.isArray(r.projeto) ? r.projeto[0] : r.projeto;
  return {
    id: r.id,
    cliente_nome: r.cliente_nome,
    squad: r.squad,
    mrr: r.mrr != null ? Number(r.mrr) : null,
    effective_mrr: effectiveMrr,
    health_score: r.health_score,
    onboarding_status: r.onboarding_status,
    status: r.status,
    ekyte_workspace_id: r.ekyte_workspace_id,
    data_fim_contrato: r.data_fim_contrato,
    data_inicio_contrato: r.data_inicio_contrato,
    account_manager_id: r.account_manager_id,
    gt_id: r.gt_id,
    designer_id: r.designer_id,
    social_media_id: r.social_media_id,
    playbook_url: r.playbook_url,
    growthpack_url: r.growthpack_url,
    drive_url: r.drive_url,
    valor_fee_override: override,
    valor_ef_override: r.valor_ef_override != null ? Number(r.valor_ef_override) : null,
    oportunidade_id: r.oportunidade_id ?? null,
    oportunidade_valor_fee: opFee,
    oportunidade_valor_ef: opEf,
    projeto_id: proj?.id ?? null,
    escopo: {
      trafego: !!proj?.escopo_trafego,
      social_media: !!proj?.escopo_social_media,
      design: !!proj?.escopo_design,
      crm: !!proj?.escopo_crm,
      validado: !!proj?.escopo_validado,
    },
  };
}

export function useAccountsList() {
  return useQuery({
    queryKey: ["accounts_list"],
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase
        .from("accounts" as any)
        .select(SELECT)
        .eq("onboarding_status", "concluida")
        .order("cliente_nome", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map(mapRow);
    },
  });
}

export function useAccountDetail(accountId: string | undefined) {
  return useQuery({
    queryKey: ["account_detail", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<AccountRow | null> => {
      const { data, error } = await supabase
        .from("accounts" as any)
        .select(SELECT)
        .eq("id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data) : null;
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; patch: Partial<AccountRow> }) => {
      const { id, patch } = params;
      const { error } = await supabase.from("accounts" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["accounts_list"] });
      qc.invalidateQueries({ queryKey: ["account_detail", vars.id] });
      qc.invalidateQueries({ queryKey: ["onboarding_accounts"] });
    },
  });
}

export function healthBand(score: number | null | undefined) {
  if (score == null) return { label: "—", color: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" };
  if (score >= 70) return { label: "Saudável", color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" };
  if (score >= 40) return { label: "Atenção", color: "bg-amber-500/10 text-amber-300 border-amber-500/30", dot: "bg-amber-400" };
  return { label: "Risco", color: "bg-red-500/10 text-red-300 border-red-500/30", dot: "bg-red-400" };
}
