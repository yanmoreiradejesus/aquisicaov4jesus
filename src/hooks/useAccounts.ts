import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { upsertAccountScope } from "./useAccountScope";
import type { ScopeItem } from "@/components/accounts/AccountManagementFields";

export type SquadKey = "strikers" | "fenix" | "saber";

export const SQUAD_LABEL: Record<SquadKey, string> = {
  strikers: "Strikers",
  fenix: "Fênix",
  saber: "Saber",
};

export interface AccountRow {
  id: string;
  cliente_nome: string;
  squad: SquadKey | null;
  mrr: number | null;
  mrr_variavel: number | null;
  health_score: number | null;
  onboarding_status: string;
  status: string;
  ekyte_workspace_id: number | null;
  data_fim_contrato: string | null;
  data_inicio_contrato: string | null;
  account_manager_id: string | null;
  gt_id: string | null;
  designer_id: string | null;
  social_media_id: string | null;
  playbook_url: string | null;
  growthpack_url: string | null;
  drive_url: string | null;
}

/** Lista de contas operacionais (onboarding concluído). */
export function useAccountsList() {
  return useQuery({
    queryKey: ["accounts_list"],
    queryFn: async (): Promise<AccountRow[]> => {
      const { data, error } = await supabase
        .from("accounts" as any)
        .select(
          "id, cliente_nome, squad, mrr, mrr_variavel, health_score, onboarding_status, status, ekyte_workspace_id, data_fim_contrato, data_inicio_contrato, account_manager_id, gt_id, designer_id, social_media_id, playbook_url, growthpack_url, drive_url",
        )
        .eq("onboarding_status", "concluida")
        .order("cliente_nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[] as AccountRow[];
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
        .select(
          "id, cliente_nome, squad, mrr, mrr_variavel, health_score, onboarding_status, status, ekyte_workspace_id, data_fim_contrato, data_inicio_contrato, account_manager_id, gt_id, designer_id, social_media_id, playbook_url, growthpack_url, drive_url",
        )
        .eq("id", accountId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? null;
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      tenantId: string;
      patch: Partial<AccountRow>;
      scope?: ScopeItem[];
    }) => {
      const { id, tenantId, patch, scope } = params;
      const { error } = await supabase
        .from("accounts" as any)
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
      if (scope && scope.length > 0) {
        await upsertAccountScope(id, tenantId, scope);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["accounts_list"] });
      qc.invalidateQueries({ queryKey: ["account_detail", vars.id] });
      qc.invalidateQueries({ queryKey: ["account_scope", vars.id] });
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
