import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { OPORTUNIDADE_ETAPAS } from "@/hooks/useCrmOportunidades";
import { Plus, Trash2, Flame, Thermometer, Snowflake, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NovaTarefa {
  titulo: string;
  data_agendada: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oportunidade: any | null;
  etapaDestino: string;
  onConfirm: (payload: {
    transcricao_reuniao?: string;
    temperatura?: string;
    novasTarefas: NovaTarefa[];
  }) => Promise<void> | void;
}

const TEMPERATURAS = [
  { value: "quente", label: "Quente", icon: Flame, color: "text-red-400" },
  { value: "morno", label: "Morno", icon: Thermometer, color: "text-amber-400" },
  { value: "frio", label: "Frio", icon: Snowflake, color: "text-cyan-400" },
];

// Etapas que exigem pelo menos 1 tarefa criada
const REQUIRES_TASK = new Set(["negociacao", "contrato", "follow_infinito"]);

export const OportunidadeAvancarDialog = ({
  open,
  onOpenChange,
  oportunidade,
  etapaDestino,
  onConfirm,
}: Props) => {
  const etapaInfo = OPORTUNIDADE_ETAPAS.find((e) => e.id === etapaDestino);
  const etapaOrigem = oportunidade?.etapa;
  const isPropostaParaNegociacao = etapaOrigem === "proposta" && etapaDestino === "negociacao";
  const requiresTask = REQUIRES_TASK.has(etapaDestino);

  const [transcricao, setTranscricao] = useState("");
  const [temperatura, setTemperatura] = useState<string>("");
  const [tarefas, setTarefas] = useState<NovaTarefa[]>([]);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [novaTarefaData, setNovaTarefaData] = useState("");
  const [tarefasExistentes, setTarefasExistentes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset ao abrir
  useEffect(() => {
    if (open && oportunidade) {
      setTranscricao(oportunidade.transcricao_reuniao || "");
      setTemperatura(oportunidade.temperatura || "");
      setTarefas([]);
      setNovaTarefaTitulo("");
      // Default: amanhã às 09:00
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      amanha.setHours(9, 0, 0, 0);
      setNovaTarefaData(amanha.toISOString().slice(0, 16));
      setErrors({});

      // Buscar tarefas existentes pendentes da oportunidade
      supabase
        .from("crm_atividades" as any)
        .select("id, titulo, descricao, data_agendada, concluida")
        .eq("oportunidade_id", oportunidade.id)
        .eq("tipo", "tarefa")
        .eq("concluida", false)
        .then(({ data }) => setTarefasExistentes((data as any[]) ?? []));
    }
  }, [open, oportunidade]);

  const tarefasPendentes = useMemo(
    () => tarefasExistentes.length + tarefas.length,
    [tarefasExistentes, tarefas]
  );

  const adicionarTarefa = () => {
    const titulo = novaTarefaTitulo.trim();
    if (!titulo || !novaTarefaData) {
      setErrors((p) => ({ ...p, novaTarefa: "Preencha título e data" }));
      return;
    }
    setTarefas((p) => [...p, { titulo, data_agendada: new Date(novaTarefaData).toISOString() }]);
    setNovaTarefaTitulo("");
    setErrors((p) => ({ ...p, novaTarefa: "", tarefas: "" }));
  };

  const removerTarefa = (i: number) => setTarefas((p) => p.filter((_, idx) => idx !== i));

  const validar = (): boolean => {
    const schema = z.object({
      transcricao: isPropostaParaNegociacao
        ? z.string().trim().min(20, "Cole a transcrição da reunião (mín. 20 caracteres)")
        : z.string().optional(),
      temperatura: isPropostaParaNegociacao
        ? z.string().min(1, "Selecione a temperatura")
        : z.string().optional(),
    });

    const r = schema.safeParse({ transcricao, temperatura });
    const newErrors: Record<string, string> = {};
    if (!r.success) {
      r.error.issues.forEach((i) => {
        newErrors[i.path[0] as string] = i.message;
      });
    }

    if (isPropostaParaNegociacao && tarefas.length === 0) {
      newErrors.tarefas = "Crie a próxima atividade (vira tarefa)";
    } else if (requiresTask && tarefasPendentes === 0) {
      newErrors.tarefas = "É obrigatório ter ao menos 1 tarefa pendente nesta etapa";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      await onConfirm({
        transcricao_reuniao: isPropostaParaNegociacao ? transcricao.trim() : undefined,
        temperatura: isPropostaParaNegociacao ? temperatura : undefined,
        novasTarefas: tarefas,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase flex items-center gap-2">
            Avançar para
            <Badge variant="outline" className={cn("font-display", etapaInfo?.color)}>
              {etapaInfo?.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {isPropostaParaNegociacao
              ? "Antes de mover esta oportunidade, registre o resultado da reunião."
              : requiresTask
              ? "Esta etapa exige ao menos uma tarefa pendente para acompanhamento."
              : "Confirme o avanço da oportunidade."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {isPropostaParaNegociacao && (
            <>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Transcrição da reunião *
                </Label>
                <Textarea
                  rows={6}
                  value={transcricao}
                  onChange={(e) => setTranscricao(e.target.value)}
                  placeholder="Cole aqui a transcrição da reunião de vendas..."
                  className={cn(errors.transcricao && "border-destructive")}
                />
                {errors.transcricao && (
                  <p className="text-[11px] text-destructive">{errors.transcricao}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Temperatura *
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPERATURAS.map((t) => {
                    const Icon = t.icon;
                    const active = temperatura === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTemperatura(t.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 py-3 rounded-xl border transition-all",
                          active
                            ? "border-primary/60 bg-primary/10 shadow-ios-sm"
                            : "border-border/40 hover:border-border bg-surface-1/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5", active ? t.color : "text-muted-foreground")} />
                        <span className="text-[11px] font-semibold">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.temperatura && (
                  <p className="text-[11px] text-destructive">{errors.temperatura}</p>
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Próxima(s) atividade(s) {requiresTask && "*"}
              </Label>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {tarefasPendentes} pendente{tarefasPendentes !== 1 ? "s" : ""}
              </span>
            </div>

            {tarefasExistentes.length > 0 && (
              <div className="space-y-1.5">
                {tarefasExistentes.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-1/60 border border-border/40 text-[12px]"
                  >
                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{t.titulo || t.descricao}</span>
                    {t.data_agendada && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(t.data_agendada).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tarefas.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/30 text-[12px]"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="flex-1 truncate">{t.titulo}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {new Date(t.data_agendada).toLocaleDateString("pt-BR")}
                </span>
                <button
                  type="button"
                  onClick={() => removerTarefa(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <Input
                placeholder="Título da tarefa"
                value={novaTarefaTitulo}
                onChange={(e) => setNovaTarefaTitulo(e.target.value)}
                className="flex-1"
                maxLength={200}
              />
              <Input
                type="datetime-local"
                value={novaTarefaData}
                onChange={(e) => setNovaTarefaData(e.target.value)}
                className="sm:w-52"
              />
              <Button type="button" variant="outline" onClick={adicionarTarefa}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
            {errors.novaTarefa && <p className="text-[11px] text-destructive">{errors.novaTarefa}</p>}
            {errors.tarefas && <p className="text-[11px] text-destructive">{errors.tarefas}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Confirmar avanço"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
