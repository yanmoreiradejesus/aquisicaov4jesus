import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";

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
  /** Define o destino no Google: 'event' (Google Calendar) ou 'task' (Google Tasks). Default: 'event' */
  syncTarget?: "event" | "task";
}

export function TaskEditDialog({ open, onOpenChange, task, onSave, saving, syncTarget = "event" }: Props) {
  const [titulo, setTitulo] = useState("");
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    if (task) {
      setTitulo(task.titulo || "");
      setDate(task.data_agendada ? new Date(task.data_agendada) : null);
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;
    if (!titulo.trim() || !date) return;
    onSave({
      id: task.id,
      titulo: titulo.trim(),
      data_agendada: date.toISOString(),
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
            <Label>Data e hora</Label>
            <DateTimePicker value={date} onChange={setDate} minuteStep={5} />
            <p className="text-xs text-muted-foreground">
              {syncTarget === "task"
                ? "Sincronizado com Google Tasks. A API usa apenas a data — a hora é exibida no título da tarefa."
                : "Será sincronizado como evento de 15min no Google Calendar."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!titulo.trim() || !date || saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
