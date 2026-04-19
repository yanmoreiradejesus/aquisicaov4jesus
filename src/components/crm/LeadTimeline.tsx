import { useEffect, useState } from "react";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2,
  Circle,
  StickyNote,
  CalendarClock,
  ArrowRightLeft,
  Sparkles,
  Phone,
  Mail,
  MessageCircle,
  Users,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLeadAtividades, type Atividade, type AtividadeTipo } from "@/hooks/useLeadAtividades";
import { useToast } from "@/hooks/use-toast";

const TIPO_META: Record<AtividadeTipo, { label: string; icon: any; color: string }> = {
  criacao: { label: "Criação", icon: Sparkles, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  mudanca_etapa: { label: "Etapa", icon: ArrowRightLeft, color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
  nota: { label: "Nota", icon: StickyNote, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  tarefa: { label: "Tarefa", icon: CalendarClock, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  ligacao: { label: "Ligação", icon: Phone, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  email: { label: "E-mail", icon: Mail, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  reuniao: { label: "Reunião", icon: Users, color: "text-violet-400 bg-violet-500/10 border-violet-500/30" },
};

interface LeadTimelineProps {
  leadId: string;
  /** Esconde o composer de Nota inline (caso queira renderizar em outro lugar) */
  hideNotaComposer?: boolean;
  /** Controle externo do dialog de Tarefa */
  tarefaDialogOpen?: boolean;
  onTarefaDialogOpenChange?: (open: boolean) => void;
}

export const LeadTimeline = ({
  leadId,
  hideNotaComposer,
  tarefaDialogOpen,
  onTarefaDialogOpenChange,
}: LeadTimelineProps) => {
  const { data: atividades = [], addNota, addTarefa, toggleTarefa, remove } = useLeadAtividades(leadId);
  const { toast } = useToast();

  const [nota, setNota] = useState("");
  const [tarefaTitulo, setTarefaTitulo] = useState("");
  const [tarefaData, setTarefaData] = useState("");
  const [tarefaHora, setTarefaHora] = useState("09:00");

  // Permite controle externo OU interno do dialog
  const [internalDialog, setInternalDialog] = useState(false);
  const dialogOpen = tarefaDialogOpen ?? internalDialog;
  const setDialogOpen = (v: boolean) => {
    if (onTarefaDialogOpenChange) onTarefaDialogOpenChange(v);
    else setInternalDialog(v);
  };

  const handleAddNota = async () => {
    if (!nota.trim()) return;
    await addNota.mutateAsync(nota.trim());
    setNota("");
    toast({ title: "Nota adicionada" });
  };

  const handleAddTarefa = async () => {
    if (!tarefaTitulo.trim() || !tarefaData) {
      toast({ title: "Preencha título e data", variant: "destructive" });
      return;
    }
    const iso = new Date(`${tarefaData}T${tarefaHora || "09:00"}:00`).toISOString();
    await addTarefa.mutateAsync({ titulo: tarefaTitulo.trim(), data_agendada: iso });
    setTarefaTitulo("");
    setTarefaData("");
    setTarefaHora("09:00");
    setDialogOpen(false);
    toast({ title: "Tarefa criada" });
  };

  return (
    <div className="space-y-4">
      {/* Composer de Nota (inline) */}
      {!hideNotaComposer && (
        <div className="border border-border/40 rounded-lg bg-muted/10 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <StickyNote className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold tracking-widest uppercase text-foreground">
              Nova nota
            </span>
          </div>
          <Textarea
            placeholder="Escreva uma nota sobre este lead..."
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleAddNota} disabled={!nota.trim() || addNota.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar nota
            </Button>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
          Histórico do lead
        </p>
        {atividades.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-4 text-center">
            Sem registros ainda
          </p>
        ) : (
          <ol className="relative border-l border-border/40 ml-2 space-y-3">
            {atividades.map((a) => (
              <TimelineItem
                key={a.id}
                a={a}
                onToggle={(c) => toggleTarefa.mutate({ id: a.id, concluida: c })}
                onDelete={() => remove.mutate(a.id)}
              />
            ))}
          </ol>
        )}
      </div>

      {/* Dialog para criar tarefa */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-emerald-400" />
              Nova tarefa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="Título da tarefa (ex: Ligar para apresentar proposta)"
              value={tarefaTitulo}
              onChange={(e) => setTarefaTitulo(e.target.value)}
              className="h-9 text-sm"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={tarefaData}
                onChange={(e) => setTarefaData(e.target.value)}
                className="h-9 text-sm"
              />
              <Input
                type="time"
                value={tarefaHora}
                onChange={(e) => setTarefaHora(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleAddTarefa} disabled={addTarefa.isPending}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar tarefa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const TimelineItem = ({
  a,
  onToggle,
  onDelete,
}: {
  a: Atividade;
  onToggle: (concluida: boolean) => void;
  onDelete: () => void;
}) => {
  const meta = TIPO_META[a.tipo] ?? TIPO_META.nota;
  const Icon = meta.icon;
  const isTarefa = a.tipo === "tarefa";
  const overdue = isTarefa && !a.concluida && a.data_agendada && isPast(new Date(a.data_agendada));

  const fmt = (iso: string | null) => {
    if (!iso) return "";
    try {
      return format(new Date(iso), "dd MMM yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return iso;
    }
  };

  return (
    <li className="ml-4 group">
      <span
        className={`absolute -left-[11px] flex items-center justify-center h-5 w-5 rounded-full border ${meta.color}`}
      >
        <Icon className="h-2.5 w-2.5" />
      </span>
      <div className="bg-muted/10 border border-border/40 rounded-lg p-3 hover:bg-muted/20 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${meta.color}`}>
                {meta.label}
              </span>
              {isTarefa && a.data_agendada && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    a.concluida
                      ? "bg-emerald-500/10 text-emerald-400"
                      : overdue
                      ? "bg-red-500/10 text-red-400 border border-red-500/30"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {a.concluida ? "Concluída" : overdue ? "Atrasada" : "Agendada"} • {fmt(a.data_agendada)}
                </span>
              )}
            </div>

            {isTarefa ? (
              <button
                onClick={() => onToggle(!a.concluida)}
                className="mt-1.5 flex items-start gap-2 text-left w-full"
              >
                {a.concluida ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <span
                  className={`text-sm ${a.concluida ? "line-through text-muted-foreground" : "text-foreground"}`}
                >
                  {a.titulo || a.descricao}
                </span>
              </button>
            ) : (
              a.descricao && (
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
                  {a.descricao}
                </p>
              )
            )}

            <p className="text-[10px] text-muted-foreground/60 mt-1.5">{fmt(a.created_at)}</p>
          </div>

          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
            title="Remover"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </li>
  );
};
