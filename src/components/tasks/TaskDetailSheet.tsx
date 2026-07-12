import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import {
  useTaskDetail,
  useTasks,
  TASK_STATUS_LABEL,
  TASK_STATUS_ORDER,
  TASK_PRIORIDADE_LABEL,
  type TaskStatus,
  type TaskPrioridade,
} from "@/hooks/useTasks";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  taskId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TaskDetailSheet({ taskId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { data, isLoading, addChecklist, toggleChecklist, removeChecklist, addComentario } = useTaskDetail(taskId);
  const { update, remove } = useTasks();
  const { profiles } = useProfilesList({});
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");

  const task = data?.task;

  const patch = (p: any) => taskId && update.mutate({ id: taskId, patch: p });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{task?.titulo || "Tarefa"}</SheetTitle>
        </SheetHeader>

        {isLoading || !task ? (
          <p className="text-sm text-muted-foreground py-8">Carregando…</p>
        ) : (
          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                defaultValue={task.titulo}
                onBlur={(e) => e.target.value !== task.titulo && patch({ titulo: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                defaultValue={task.descricao ?? ""}
                rows={4}
                onBlur={(e) => (e.target.value || "") !== (task.descricao || "") && patch({ descricao: e.target.value || null })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={task.status} onValueChange={(v) => patch({ status: v as TaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
                    ))}
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade</Label>
                <Select value={task.prioridade} onValueChange={(v) => patch({ prioridade: v as TaskPrioridade })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TASK_PRIORIDADE_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select
                  value={task.responsavel_id ?? "none"}
                  onValueChange={(v) => patch({ responsavel_id: v === "none" ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prazo</Label>
                <Input
                  type="date"
                  defaultValue={task.prazo ?? ""}
                  onBlur={(e) => (e.target.value || null) !== task.prazo && patch({ prazo: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estimativa (h)</Label>
                <Input
                  type="number"
                  step="0.25"
                  defaultValue={task.estimativa_horas ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== task.estimativa_horas) patch({ estimativa_horas: v });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horas gastas</Label>
                <Input
                  type="number"
                  step="0.25"
                  defaultValue={task.horas_gastas ?? 0}
                  onBlur={(e) => {
                    const v = Number(e.target.value || 0);
                    if (v !== Number(task.horas_gastas || 0)) patch({ horas_gastas: v });
                  }}
                />
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Checklist</h4>
                <Badge variant="outline" className="text-[10px]">
                  {(data?.checklist ?? []).filter((c) => c.concluido).length}/{data?.checklist.length ?? 0}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {(data?.checklist ?? []).map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-2 py-1.5">
                    <Checkbox checked={c.concluido} onCheckedChange={(v) => toggleChecklist.mutate({ id: c.id, concluido: !!v })} />
                    <span className={`text-sm flex-1 ${c.concluido ? "line-through text-muted-foreground" : ""}`}>{c.titulo}</span>
                    <button onClick={() => removeChecklist.mutate(c.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newItem.trim()) {
                      addChecklist.mutate(newItem.trim());
                      setNewItem("");
                    }
                  }}
                  placeholder="Adicionar item…"
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (newItem.trim()) {
                      addChecklist.mutate(newItem.trim());
                      setNewItem("");
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Comentários */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Comentários</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(data?.comentarios ?? []).map((c) => (
                  <div key={c.id} className="rounded-lg border border-border/40 bg-background/40 p-2 text-sm">
                    <div className="text-[11px] text-muted-foreground mb-1">
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                    <p className="whitespace-pre-wrap">{c.conteudo}</p>
                  </div>
                ))}
                {(data?.comentarios ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
                )}
              </div>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="Escrever comentário…"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (!newComment.trim()) return;
                  addComentario.mutate({ conteudo: newComment.trim(), autor_id: user?.id ?? null });
                  setNewComment("");
                }}
              >
                Comentar
              </Button>
            </div>

            <div className="pt-4 border-t border-border/40 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  if (!taskId) return;
                  if (confirm("Excluir tarefa?")) {
                    remove.mutate(taskId, { onSuccess: () => onOpenChange(false) });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir tarefa
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
