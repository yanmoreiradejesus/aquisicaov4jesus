import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TarefaStatus = "a_fazer" | "em_execucao" | "bloqueada" | "concluida" | "cancelada";
export type TarefaPrioridade = "baixa" | "media" | "alta" | "urgente";
export type TarefaEscopo = "trafego" | "social_media" | "design" | "crm";
export type TarefaEtapaStatus = "pendente" | "em_execucao" | "concluida" | "pulada";

export interface TarefaEtapa {
  id: string;
  tarefa_id: string;
  ordem: number;
  nome: string;
  funcao: string | null;
  responsavel_id: string | null;
  prazo: string | null;
  status: TarefaEtapaStatus;
  iniciada_em: string | null;
  concluida_em: string | null;
  concluida_por: string | null;
  observacao_conclusao: string | null;
}

export interface Tarefa {
  id: string;
  tenant_id: string;
  projeto_id: string | null;
  account_id: string | null;
  titulo: string;
  descricao: string | null;
  escopo: TarefaEscopo | null;
  prioridade: TarefaPrioridade;
  status: TarefaStatus;
  prazo_final: string | null;
  etapa_atual_id: string | null;
  criado_por: string | null;
  concluida_em: string | null;
  created_at: string;
  updated_at: string;
  etapas?: TarefaEtapa[];
  etapa_atual?: TarefaEtapa | null;
}

export function useTarefas(filters?: {
  responsavelId?: string;
  status?: TarefaStatus[];
  projetoId?: string;
  escopo?: TarefaEscopo;
}) {
  return useQuery({
    queryKey: ["tarefas", filters],
    queryFn: async () => {
      let q = supabase
        .from("tarefas" as any)
        .select("*, etapas:tarefa_etapas(*)")
        .order("created_at", { ascending: false });
      if (filters?.status?.length) q = q.in("status", filters.status);
      if (filters?.projetoId) q = q.eq("projeto_id", filters.projetoId);
      if (filters?.escopo) q = q.eq("escopo", filters.escopo);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const mapped: Tarefa[] = rows.map((r) => {
        const etapas = (r.etapas ?? []).sort((a: any, b: any) => a.ordem - b.ordem);
        const etapa_atual = etapas.find((e: TarefaEtapa) => e.id === r.etapa_atual_id) ?? null;
        return { ...r, etapas, etapa_atual };
      });
      if (filters?.responsavelId) {
        return mapped.filter((t) =>
          t.etapa_atual?.responsavel_id === filters.responsavelId ||
          t.etapas?.some((e) => e.responsavel_id === filters.responsavelId),
        );
      }
      return mapped;
    },
  });
}

export function useTarefa(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["tarefa", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas" as any)
        .select("*, etapas:tarefa_etapas(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const r = data as any;
      const etapas = (r.etapas ?? []).sort((a: any, b: any) => a.ordem - b.ordem);
      const etapa_atual = etapas.find((e: TarefaEtapa) => e.id === r.etapa_atual_id) ?? null;
      return { ...r, etapas, etapa_atual } as Tarefa;
    },
  });
}

export interface CreateTarefaInput {
  titulo: string;
  descricao?: string;
  projeto_id?: string | null;
  account_id?: string | null;
  escopo?: TarefaEscopo | null;
  prioridade?: TarefaPrioridade;
  prazo_final?: string | null;
  etapas: Array<{
    nome: string;
    funcao?: string | null;
    responsavel_id?: string | null;
    prazo?: string | null;
  }>;
}

export function useCreateTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTarefaInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? null;

      const { data: tarefa, error } = await supabase
        .from("tarefas" as any)
        .insert({
          titulo: input.titulo,
          descricao: input.descricao ?? null,
          projeto_id: input.projeto_id ?? null,
          account_id: input.account_id ?? null,
          escopo: input.escopo ?? null,
          prioridade: input.prioridade ?? "media",
          prazo_final: input.prazo_final ?? null,
          criado_por: uid,
        } as any)
        .select()
        .single();
      if (error) throw error;

      const tarefaId = (tarefa as any).id;
      if (input.etapas.length) {
        const rows = input.etapas.map((e, i) => ({
          tarefa_id: tarefaId,
          ordem: i + 1,
          nome: e.nome,
          funcao: e.funcao ?? null,
          responsavel_id: e.responsavel_id ?? null,
          prazo: e.prazo ?? null,
          status: i === 0 ? "em_execucao" : "pendente",
          iniciada_em: i === 0 ? new Date().toISOString() : null,
        }));
        const { data: etapasInseridas, error: e2 } = await supabase
          .from("tarefa_etapas" as any)
          .insert(rows as any)
          .select();
        if (e2) throw e2;
        const primeira = (etapasInseridas as any[])?.[0];
        if (primeira) {
          await supabase
            .from("tarefas" as any)
            .update({ etapa_atual_id: primeira.id, status: "em_execucao" } as any)
            .eq("id", tarefaId);
        }
      }
      return tarefa;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
    },
  });
}

export function useConcluirEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ etapa_id, observacao }: { etapa_id: string; observacao?: string }) => {
      const { error } = await supabase
        .from("tarefa_etapas" as any)
        .update({ status: "concluida", observacao_conclusao: observacao ?? null } as any)
        .eq("id", etapa_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefa"] });
    },
  });
}

export function useUpdateTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Tarefa> }) => {
      const { error } = await supabase.from("tarefas" as any).update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarefas"] });
      qc.invalidateQueries({ queryKey: ["tarefa"] });
    },
  });
}

export function useDeleteTarefa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarefas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tarefas"] }),
  });
}

export const STATUS_LABEL: Record<TarefaStatus, string> = {
  a_fazer: "A fazer",
  em_execucao: "Em execução",
  bloqueada: "Bloqueada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PRIORIDADE_LABEL: Record<TarefaPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const ESCOPO_LABEL: Record<TarefaEscopo, string> = {
  trafego: "Tráfego",
  social_media: "Social Media",
  design: "Design",
  crm: "CRM",
};
