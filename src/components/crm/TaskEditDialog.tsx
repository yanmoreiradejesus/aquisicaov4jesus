import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface TaskEditValue {
  id: string;
  titulo: string;
  data_agendada: string; // ISO
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskEditValue | null;
  onSave: (patch: { id: string; titulo: string; data_agendada: string }) => void;
  saving?: boolean;
}

// Converte ISO -> formato datetime-local do input (sem timezone, hora local)
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TaskEditDialog({ open, onOpenChange, task, onSave, saving }: Props) {
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");

  useEffect(() => {
    if (task) {
      setTitulo(task.titulo || "");
      setData(toLocalInput(task.data_agendada));
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;
    if (!titulo.trim() || !data) return;
    onSave({
      id: task.id,
      titulo: titulo.trim(),
      data_agendada: new Date(data).toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="task-titulo">Título</Label>
            <Input
              id="task-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Ligar para o cliente"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-data">Data e hora</Label>
            <Input
              id="task-data"
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Será sincronizado como evento de 15min no Google Calendar.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!titulo.trim() || !data || saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
