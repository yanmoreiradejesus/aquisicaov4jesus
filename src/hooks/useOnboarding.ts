import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ONBOARDING_ETAPAS: { id: string; label: string; color: string }[] = [
  { id: "entrada", label: "Entrada", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { id: "atrasada", label: "Atrasada", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { id: "concluida", label: "Concluída", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  { id: "churn_m0", label: "Churn M0", color: "bg-red-500/10 text-red-400 border-red-500/30" },
];

export function useOnboarding() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["onboarding_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts" as any)
        .select("*, oportunidade:crm_oportunidades(*, lead:crm_leads(*))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("onboarding_accounts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, () => {
        qc.invalidateQueries({ queryKey: ["onboarding_accounts"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const update = useMutation({
    mutationFn: async (acc: any) => {
      const { oportunidade, created_at, updated_at, ...rest } = acc;
      const { error } = await supabase
        .from("accounts" as any)
        .update(rest)
        .eq("id", acc.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_accounts"] }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, onboarding_status }: { id: string; onboarding_status: string }) => {
      const { error } = await supabase
        .from("accounts" as any)
        .update({ onboarding_status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding_accounts"] }),
  });

  return { ...query, update, updateStatus };
}
