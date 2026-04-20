import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LeadEtapa = Database["public"]["Enums"] extends { lead_etapa: infer T } ? T : string;
export type Lead = Database["public"]["Tables"] extends { crm_leads: { Row: infer R } } ? R : any;

export const LEAD_ETAPAS: { id: string; label: string; color: string }[] = [
  { id: "desqualificado", label: "Desqualificado", color: "bg-red-500/10 text-red-400 border-red-500/30" },
  { id: "entrada", label: "Entrada", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { id: "tentativa_contato", label: "Tentativa de Contato", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  { id: "contato_realizado", label: "Contato Realizado", color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" },
  { id: "reuniao_agendada", label: "Reunião Agendada", color: "bg-violet-500/10 text-violet-400 border-violet-500/30" },
  { id: "no_show", label: "No-Show", color: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  { id: "reuniao_realizada", label: "Reunião Realizada", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
];

export function useCrmLeads() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("crm_leads_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => {
        qc.invalidateQueries({ queryKey: ["crm_leads"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const upsert = useMutation({
    mutationFn: async (lead: any) => {
      if (lead.id) {
        const { error } = await supabase.from("crm_leads" as any).update(lead).eq("id", lead.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("crm_leads" as any).insert({ ...lead, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_leads"] }),
  });

  const updateEtapa = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: string }) => {
      const patch: any = { etapa };
      if (etapa === "reuniao_realizada") patch.data_reuniao_realizada = new Date().toISOString();
      const { error } = await supabase.from("crm_leads" as any).update(patch).eq("id", id);
      if (error) throw error;

      // Trigger briefing de mercado quando agenda reunião (fire-and-forget)
      if (etapa === "reuniao_agendada") {
        const { data: leadRow } = await supabase
          .from("crm_leads" as any)
          .select("briefing_mercado")
          .eq("id", id)
          .maybeSingle();
        const existing = (leadRow as any)?.briefing_mercado;
        const alreadyReady = existing && (existing.status === "ready" || existing.status === "generating");
        if (!alreadyReady) {
          supabase.functions
            .invoke("generate-market-briefing", { body: { lead_id: id } })
            .catch((e) => console.error("market briefing trigger failed", e));
        }
      }

      // Trigger pesquisa pré-qualificação quando vai pra tentativa de contato (fire-and-forget)
      if (etapa === "tentativa_contato") {
        const { data: leadRow } = await supabase
          .from("crm_leads" as any)
          .select("pesquisa_pre_qualificacao")
          .eq("id", id)
          .maybeSingle();
        const existing = (leadRow as any)?.pesquisa_pre_qualificacao;
        const alreadyReady = existing && (existing.status === "ready" || existing.status === "generating");
        if (!alreadyReady) {
          supabase.functions
            .invoke("generate-pre-qualification", { body: { lead_id: id } })
            .catch((e) => console.error("pre-qualification trigger failed", e));
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_leads"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_leads" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_leads"] }),
  });

  return { ...query, upsert, updateEtapa, remove };
}
