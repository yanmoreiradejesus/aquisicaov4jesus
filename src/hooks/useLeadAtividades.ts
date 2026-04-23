import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AtividadeTipo =
  | "ligacao"
  | "email"
  | "reuniao"
  | "nota"
  | "whatsapp"
  | "tarefa"
  | "mudanca_etapa"
  | "criacao";

export interface Atividade {
  id: string;
  lead_id: string | null;
  tipo: AtividadeTipo;
  descricao: string | null;
  titulo: string | null;
  usuario_id: string | null;
  data_agendada: string | null;
  concluida: boolean;
  data_conclusao: string | null;
  created_at: string;
  google_event_id?: string | null;
  google_sync_status?: string | null;
  google_sync_error?: string | null;
}

function fireSync(atividade_id: string, action: "upsert" | "delete", google_event_id?: string | null) {
  // Fire-and-forget: não bloqueia o CRM, falha silenciosa
  supabase.functions
    .invoke("sync-task-to-google", { body: { atividade_id, action, google_event_id } })
    .catch((err) => console.warn("[sync-task-to-google]", err));
}

export function useLeadAtividades(leadId?: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm_atividades", leadId],
    queryFn: async () => {
      if (!leadId) return [] as Atividade[];
      const { data, error } = await supabase
        .from("crm_atividades" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Atividade[];
    },
    enabled: !!leadId,
  });

  useEffect(() => {
    if (!leadId) return;
    const channel = supabase
      .channel(`crm_atividades_${leadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_atividades", filter: `lead_id=eq.${leadId}` },
        () => qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, qc]);

  const addNota = useMutation({
    mutationFn: async (descricao: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("crm_atividades" as any).insert({
        lead_id: leadId,
        tipo: "nota",
        descricao,
        usuario_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] }),
  });

  const addTarefa = useMutation({
    mutationFn: async ({ titulo, data_agendada }: { titulo: string; data_agendada: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase.from("crm_atividades" as any).insert({
        lead_id: leadId,
        tipo: "tarefa",
        titulo,
        descricao: titulo,
        data_agendada,
        usuario_id: user.id,
        google_sync_status: "pending",
      }).select("id").single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] });
      if (data?.id) fireSync(data.id, "upsert");
    },
  });

  const updateTarefa = useMutation({
    mutationFn: async ({ id, titulo, data_agendada }: { id: string; titulo?: string; data_agendada?: string }) => {
      const patch: Record<string, unknown> = { google_sync_status: "pending" };
      if (titulo !== undefined) {
        patch.titulo = titulo;
        patch.descricao = titulo;
      }
      if (data_agendada !== undefined) patch.data_agendada = data_agendada;
      const { error } = await supabase.from("crm_atividades" as any).update(patch).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] });
      fireSync(id, "upsert");
    },
  });

  const toggleTarefa = useMutation({
    mutationFn: async ({ id, concluida }: { id: string; concluida: boolean }) => {
      const { error } = await supabase
        .from("crm_atividades" as any)
        .update({
          concluida,
          data_conclusao: concluida ? new Date().toISOString() : null,
          google_sync_status: "pending",
        })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] });
      fireSync(id, "upsert");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Captura o google_event_id ANTES do delete
      const { data: row } = await supabase
        .from("crm_atividades" as any)
        .select("google_event_id")
        .eq("id", id)
        .maybeSingle();
      const eventId = (row as any)?.google_event_id ?? null;

      const { error } = await supabase.from("crm_atividades" as any).delete().eq("id", id);
      if (error) throw error;
      return { id, eventId };
    },
    onSuccess: ({ id, eventId }) => {
      qc.invalidateQueries({ queryKey: ["crm_atividades", leadId] });
      if (eventId) fireSync(id, "delete", eventId);
    },
  });

  return { ...query, addNota, addTarefa, updateTarefa, toggleTarefa, remove };
}
