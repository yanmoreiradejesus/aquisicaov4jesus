import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "backlog" | "em_execucao" | "revisao" | "aprovado" | "concluido" | "cancelado";
export type TaskPrioridade = "baixa" | "media" | "alta" | "urgente";

export const TASK_STATUS_ORDER: TaskStatus[] = ["backlog", "em_execucao", "revisao", "aprovado", "concluido"];
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  em_execucao: "Em execução",
  revisao: "Revisão",
  aprovado: "Aprovado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
export const TASK_PRIORIDADE_LABEL: Record<TaskPrioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};
export const TASK_PRIORIDADE_COLOR: Record<TaskPrioridade, string> = {
  baixa: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  media: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  alta: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  urgente: "bg-red-500/10 text-red-300 border-red-500/30",
};

export interface TaskRow {
  id: string;
  tenant_id: string;
  projeto_id: string | null;
  squad: string | null;
  fase_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  created_by: string | null;
  prioridade: TaskPrioridade;
  status: TaskStatus;
  prazo: string | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  estimativa_horas: number | null;
  horas_gastas: number | null;
  ordem: number;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export function useTasks(params: { projetoId?: string | null; responsavelId?: string | null } = {}) {
  const qc = useQueryClient();
  const { projetoId, responsavelId } = params;

  const query = useQuery({
    queryKey: ["tasks", { projetoId, responsavelId }],
    queryFn: async (): Promise<TaskRow[]> => {
      let q = (supabase as any).from("tasks").select("*").order("ordem").order("created_at", { ascending: false });
      if (projetoId) q = q.eq("projeto_id", projetoId);
      if (responsavelId) q = q.eq("responsavel_id", responsavelId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("tasks_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["tasks"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const create = useMutation({
    mutationFn: async (patch: Partial<TaskRow>) => {
      const { data, error } = await (supabase as any).from("tasks").insert(patch).select("*").single();
      if (error) throw error;
      return data as TaskRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaskRow> }) => {
      const { error } = await (supabase as any).from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return { ...query, create, update, remove };
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  titulo: string;
  concluido: boolean;
  ordem: number;
}

export interface TaskComentario {
  id: string;
  task_id: string;
  autor_id: string | null;
  conteudo: string;
  created_at: string;
}

export function useTaskDetail(taskId: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["task_detail", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const [t, ci, cm] = await Promise.all([
        (supabase as any).from("tasks").select("*").eq("id", taskId!).maybeSingle(),
        (supabase as any).from("task_checklist_items").select("*").eq("task_id", taskId!).order("ordem"),
        (supabase as any).from("task_comentarios").select("*").eq("task_id", taskId!).order("created_at"),
      ]);
      if (t.error) throw t.error;
      return {
        task: t.data as TaskRow | null,
        checklist: (ci.data ?? []) as TaskChecklistItem[],
        comentarios: (cm.data ?? []) as TaskComentario[],
      };
    },
  });

  const addChecklist = useMutation({
    mutationFn: async (titulo: string) => {
      const { error } = await (supabase as any)
        .from("task_checklist_items")
        .insert({ task_id: taskId, titulo, ordem: (query.data?.checklist.length ?? 0) });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_detail", taskId] }),
  });
  const toggleChecklist = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await (supabase as any).from("task_checklist_items").update({ concluido }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_detail", taskId] }),
  });
  const removeChecklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("task_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_detail", taskId] }),
  });

  const addComentario = useMutation({
    mutationFn: async ({ conteudo, autor_id }: { conteudo: string; autor_id: string | null }) => {
      const { error } = await (supabase as any).from("task_comentarios").insert({ task_id: taskId, conteudo, autor_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task_detail", taskId] }),
  });

  return { ...query, addChecklist, toggleChecklist, removeChecklist, addComentario };
}
