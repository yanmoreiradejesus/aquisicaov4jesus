import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Copy, MessageCircle, Clock, XCircle, Plus } from "lucide-react";
import { formatPhone, whatsappNumber, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLeadAtividades } from "@/hooks/useLeadAtividades";

interface Props {
  lead: any;
  onClick: () => void;
  showAge?: boolean;
  showStageDays?: boolean;
  onPhoneInteract?: () => void;
  onDisqualify?: () => void;
}

const tempAccent: Record<string, string> = {
  Quente: "bg-temp-hot",
  Morno: "bg-temp-warm",
  Frio: "bg-temp-cold",
};

const tempPill: Record<string, { emoji: string; cls: string }> = {
  Quente: { emoji: "🔥", cls: "bg-temp-hot/15 text-temp-hot border-temp-hot/40" },
  Morno: { emoji: "🌤️", cls: "bg-temp-warm/15 text-temp-warm border-temp-warm/40" },
  Frio: { emoji: "❄️", cls: "bg-temp-cold/15 text-temp-cold border-temp-cold/40" },
};

const daysSince = (iso?: string | null) => {
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
};

export const LeadCard = ({
  lead,
  onClick,
  showAge,
  showStageDays,
  onPhoneInteract,
  onDisqualify,
}: Props) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });
  const { toast } = useToast();
  const { addTarefa } = useLeadAtividades(lead.id);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDate, setTaskDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${
          isDragging ? "1.5deg" : "0deg"
        })`,
        zIndex: 50,
      }
    : undefined;

  const phone = lead.telefone as string | undefined;
  const phoneFmt = formatPhone(phone);
  const wa = whatsappNumber(phone);
  const since = lead.data_criacao_origem || lead.data_aquisicao || lead.created_at;
  const temp = lead.temperatura ? tempPill[lead.temperatura] : null;
  const accent = lead.temperatura ? tempAccent[lead.temperatura] : "bg-border/60";
  const stageDays = showStageDays ? daysSince(lead.updated_at) : 0;

  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };
  const stopHard = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const copyPhone = (e: React.MouseEvent) => {
    stopHard(e);
    if (!phoneFmt) return;
    navigator.clipboard.writeText(phoneFmt);
    toast({ title: "Telefone copiado", description: phoneFmt });
    onPhoneInteract?.();
  };

  const handleWhatsapp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPhoneInteract?.();
    // Não bloqueia navegação do <a>
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim() || !taskDate) return;
    try {
      await addTarefa.mutateAsync({
        titulo: taskTitle.trim(),
        data_agendada: new Date(taskDate).toISOString(),
      });
      toast({ title: "Tarefa criada" });
      setTaskTitle("");
      setTaskOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao criar tarefa", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border border-border/50 bg-surface-1/80 backdrop-blur-sm card-lift",
          isDragging
            ? "opacity-60 shadow-ios-xl scale-[1.02]"
            : "shadow-ios-sm hover:border-primary/40 hover:bg-surface-2/80"
        )}
      >
        {/* Accent strip */}
        <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", accent)} />

        {/* Disqualify button — top-right (always available) */}
        {onDisqualify && lead.etapa !== "desqualificado" && (
          <button
            onClick={(e) => {
              stopHard(e);
              onDisqualify();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
            title="Desqualificar lead"
            aria-label="Desqualificar lead"
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        )}

        <div
          {...listeners}
          onClick={onClick}
          className="pl-3.5 pr-8 py-3 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-display font-semibold text-[13px] leading-snug text-foreground truncate tracking-[-0.01em] normal-case">
                {lead.empresa || lead.nome}
              </div>
              {lead.empresa && (
                <p className="font-display font-normal text-[11px] text-muted-foreground truncate mt-0.5 tracking-[-0.005em] normal-case">
                  {lead.nome}
                </p>
              )}
            </div>
            {showAge && since && (
              <div className="flex items-center gap-0.5 text-[10px] text-temp-warm font-medium shrink-0 tabular-nums mr-6">
                <Clock className="h-2.5 w-2.5" />
                <span>{timeAgo(since)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {temp && (
              <span
                className={cn(
                  "text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide",
                  temp.cls,
                )}
              >
                {temp.emoji} {lead.temperatura}
              </span>
            )}
            {showStageDays && stageDays > 0 && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded-md border font-semibold tracking-wide bg-amber-500/10 text-amber-300 border-amber-500/30 tabular-nums">
                Dia {stageDays}
              </span>
            )}
          </div>
        </div>

        {/* Actions row: phone + whatsapp + criar tarefa */}
        <div className="flex items-center gap-1 px-3 pb-2.5 pt-1.5 border-t border-border/30">
          {phoneFmt ? (
            <>
              <button
                onClick={copyPhone}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex-1 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-muted/40 min-w-0"
                title="Copiar telefone"
              >
                <Copy className="h-3 w-3 shrink-0" />
                <span className="truncate tabular-nums">{phoneFmt}</span>
              </button>
              {wa && (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleWhatsapp}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex items-center justify-center h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:scale-105 transition-all shrink-0"
                  title="Abrir WhatsApp"
                  aria-label="Abrir WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          ) : (
            <div className="flex-1" />
          )}

          <Popover open={taskOpen} onOpenChange={setTaskOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={(e) => stopHard(e)}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center justify-center h-7 w-7 rounded-md bg-primary/10 text-primary hover:bg-primary/20 hover:scale-105 transition-all shrink-0"
                title="Criar tarefa"
                aria-label="Criar tarefa"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 p-3 space-y-2"
              onClick={stop}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Nova tarefa
              </div>
              <Input
                autoFocus
                placeholder="Ex.: Ligar para confirmar reunião"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="h-8 text-sm"
                maxLength={120}
              />
              <Input
                type="datetime-local"
                value={taskDate}
                onChange={(e) => setTaskDate(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex justify-end gap-1.5 pt-1">
                <Button size="sm" variant="ghost" onClick={() => setTaskOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateTask}
                  disabled={!taskTitle.trim() || !taskDate || addTarefa.isPending}
                >
                  {addTarefa.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};
