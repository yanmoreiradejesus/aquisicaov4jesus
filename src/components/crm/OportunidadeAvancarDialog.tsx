import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { OPORTUNIDADE_ETAPAS } from "@/hooks/useCrmOportunidades";
import {
  Plus,
  Trash2,
  Flame,
  Thermometer,
  Snowflake,
  CheckCircle2,
  Circle,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Calendar as CalendarIcon,
  ListTodo,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  {
    value: "quente",
    label: "Quente",
    desc: "Pronto para fechar",
    icon: Flame,
    color: "text-red-400",
    ring: "ring-red-400/40",
    bg: "bg-red-400/10",
  },
  {
    value: "morno",
    label: "Morno",
    desc: "Precisa nutrir",
    icon: Thermometer,
    color: "text-amber-400",
    ring: "ring-amber-400/40",
    bg: "bg-amber-400/10",
  },
  {
    value: "frio",
    label: "Frio",
    desc: "Esfriou",
    icon: Snowflake,
    color: "text-cyan-400",
    ring: "ring-cyan-400/40",
    bg: "bg-cyan-400/10",
  },
];

const REQUIRES_TASK = new Set(["negociacao", "follow_infinito"]);
const REQUIRES_MEETING = new Set(["negociacao", "contrato", "fechado_ganho", "follow_infinito"]);

const formatLocalDateTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
};

const PRESETS = [
  {
    label: "Amanhã 9h",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Em 3 dias",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
  {
    label: "Próxima semana",
    build: () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

export const OportunidadeAvancarDialog = ({
  open,
  onOpenChange,
  oportunidade,
  etapaDestino,
  onConfirm,
}: Props) => {
  const { toast } = useToast();
  const etapaInfo = OPORTUNIDADE_ETAPAS.find((e) => e.id === etapaDestino);
  const etapaOrigem = oportunidade?.etapa;
  const isPropostaParaNegociacao = etapaOrigem === "proposta" && etapaDestino === "negociacao";
  const requiresTask = REQUIRES_TASK.has(etapaDestino);
  const hasMeetingStep = isPropostaParaNegociacao;
  const hasTaskStep = requiresTask;
  const totalSteps = (hasMeetingStep ? 1 : 0) + (hasTaskStep ? 1 : 0) || 1;

  const [step, setStep] = useState(1);
  const [transcricao, setTranscricao] = useState("");
  const [temperatura, setTemperatura] = useState<string>("");
  const [tarefas, setTarefas] = useState<NovaTarefa[]>([]);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [novaTarefaData, setNovaTarefaData] = useState("");
  const [tarefasExistentes, setTarefasExistentes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const transcricaoRef = useRef<HTMLTextAreaElement>(null);
  const tarefaTituloRef = useRef<HTMLInputElement>(null);

  // Reset ao abrir
  useEffect(() => {
    if (open && oportunidade) {
      setStep(1);
      setSubmitted(false);
      setTranscricao(oportunidade.transcricao_reuniao || "");
      setTemperatura(oportunidade.temperatura || "");
      setTarefas([]);
      setNovaTarefaTitulo("");
      setNovaTarefaData(formatLocalDateTime(PRESETS[0].build()));
      setErrors({});

      supabase
        .from("crm_atividades" as any)
        .select("id, titulo, descricao, data_agendada, concluida")
        .eq("oportunidade_id", oportunidade.id)
        .eq("tipo", "tarefa")
        .eq("concluida", false)
        .then(({ data }) => setTarefasExistentes((data as any[]) ?? []));
    }
  }, [open, oportunidade]);

  // Auto-focus por step
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (currentStepKey() === "meeting") transcricaoRef.current?.focus();
      else if (currentStepKey() === "task") tarefaTituloRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, hasMeetingStep, hasTaskStep]);

  const currentStepKey = (): "meeting" | "task" | "none" => {
    if (hasMeetingStep && step === 1) return "meeting";
    if (hasTaskStep) return "task";
    return "none";
  };

  const tarefasPendentes = useMemo(
    () => tarefasExistentes.length + tarefas.length,
    [tarefasExistentes, tarefas],
  );

  const adicionarTarefa = () => {
    const titulo = novaTarefaTitulo.trim();
    const newErrors: Record<string, string> = { ...errors };
    if (!titulo) {
      newErrors.novaTarefa = "Descreva a tarefa";
      setErrors(newErrors);
      return;
    }
    if (!novaTarefaData) {
      newErrors.novaTarefa = "Escolha data e horário";
      setErrors(newErrors);
      return;
    }
    setTarefas((p) => [...p, { titulo, data_agendada: new Date(novaTarefaData).toISOString() }]);
    setNovaTarefaTitulo("");
    delete newErrors.novaTarefa;
    delete newErrors.tarefas;
    setErrors(newErrors);
    setTimeout(() => tarefaTituloRef.current?.focus(), 50);
  };

  const removerTarefa = (i: number) => setTarefas((p) => p.filter((_, idx) => idx !== i));

  // Validação derivada (live) para tooltip do botão
  const liveErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (hasMeetingStep) {
      if (transcricao.trim().length < 20) e.transcricao = "Cole a transcrição (mín. 20 caracteres)";
      if (!temperatura) e.temperatura = "Selecione a temperatura";
    }
    if (hasTaskStep && requiresTask && tarefasPendentes === 0) {
      e.tarefas = "Mantenha a sugestão da IA ou adicione ao menos 1 tarefa";
    }
    return e;
  }, [
    hasMeetingStep,
    hasTaskStep,
    transcricao,
    temperatura,
    tarefas,
    tarefasPendentes,
    isPropostaParaNegociacao,
    requiresTask,
  ]);

  const isStepValid = (s: number): boolean => {
    if (s === 1 && hasMeetingStep) return !liveErrors.transcricao && !liveErrors.temperatura;
    return !liveErrors.tarefas;
  };

  const isAllValid = Object.keys(liveErrors).length === 0;

  const handleNext = () => {
    if (!isStepValid(step)) {
      setSubmitted(true);
      setErrors(liveErrors);
      return;
    }
    setSubmitted(false);
    setErrors({});
    setStep((s) => s + 1);
  };

  const submit = async () => {
    setSubmitted(true);
    if (!isAllValid) {
      setErrors(liveErrors);
      return;
    }
    setSaving(true);
    try {
      await onConfirm({
        transcricao_reuniao: hasMeetingStep ? transcricao.trim() : undefined,
        temperatura: hasMeetingStep ? temperatura : undefined,
        novasTarefas: tarefas,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const showStep = currentStepKey();
  const stepNumber = hasMeetingStep && step === 1 ? 1 : hasMeetingStep ? 2 : 1;
  const stepLabel =
    showStep === "meeting"
      ? "Resultado da reunião"
      : showStep === "task"
      ? "Próxima atividade"
      : "Confirmar";

  const isLastStep = stepNumber === totalSteps;

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="font-heading tracking-wider uppercase flex items-center gap-2 text-base">
              Avançar para
              <Badge variant="outline" className={cn("font-display", etapaInfo?.color)}>
                {etapaInfo?.label}
              </Badge>
            </DialogTitle>
            {totalSteps > 1 && (
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground tabular-nums">
                Passo {stepNumber} de {totalSteps}
              </span>
            )}
          </div>
          <DialogDescription className="text-xs leading-relaxed">
            {showStep === "meeting"
              ? "Registre o resultado da reunião antes de mover esta oportunidade."
              : showStep === "task"
              ? requiresTask
                ? "Esta etapa exige ao menos uma tarefa pendente para acompanhamento."
                : "Adicione a próxima atividade desta oportunidade."
              : "Confirme o avanço da oportunidade."}
          </DialogDescription>

          {totalSteps > 1 && (
            <div className="flex gap-1.5 pt-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < stepNumber ? "bg-primary" : "bg-border/60",
                  )}
                />
              ))}
            </div>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/80 pt-1">
            {stepLabel}
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {showStep === "meeting" && (
            <>
              {/* Temperatura */}
              <div className="space-y-2.5">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Temperatura *
                </Label>
                <div className="grid grid-cols-3 gap-2.5">
                  {TEMPERATURAS.map((t) => {
                    const Icon = t.icon;
                    const active = temperatura === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTemperatura(t.value)}
                        className={cn(
                          "group flex flex-col items-center gap-1.5 py-4 px-2 rounded-xl border text-center transition-all",
                          active
                            ? cn("border-transparent ring-2", t.ring, t.bg, "shadow-ios-sm")
                            : "border-border/40 hover:border-border bg-surface-1/50 hover:bg-surface-1",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-6 w-6 transition-colors",
                            active ? t.color : "text-muted-foreground group-hover:text-foreground",
                          )}
                        />
                        <span className="text-[12px] font-semibold leading-none">{t.label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          {t.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {submitted && liveErrors.temperatura && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.temperatura}
                  </p>
                )}
              </div>

              {/* Transcrição */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Transcrição da reunião *
                  </Label>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {transcricao.length} caracteres
                  </span>
                </div>
                <Textarea
                  ref={transcricaoRef}
                  rows={8}
                  value={transcricao}
                  onChange={(e) => setTranscricao(e.target.value)}
                  placeholder="Cole aqui a transcrição completa da reunião — pontos discutidos, objeções, próximos passos, decisores envolvidos..."
                  className={cn(
                    "resize-none text-sm leading-relaxed",
                    submitted && liveErrors.transcricao && "border-destructive",
                  )}
                />
                {submitted && liveErrors.transcricao && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.transcricao}
                  </p>
                )}
              </div>
            </>
          )}

          {showStep === "task" && (
            <div className="space-y-4">
              {/* Counter */}
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Tarefas {requiresTask && "*"}
                </Label>
                <span
                  className={cn(
                    "text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full",
                    tarefasPendentes > 0
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tarefasPendentes > 0
                    ? `${tarefasPendentes} pendente${tarefasPendentes !== 1 ? "s" : ""} ✓`
                    : "Nenhuma"}
                </span>
              </div>

              {/* Helper quando há sugestão IA */}
              {tarefasExistentes.some((t) => /\[SUGEST(Ã|A)O IA/i.test(t.titulo || "")) && (
                <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                  Já existe uma tarefa sugerida pela IA. Você pode mantê-la, removê-la ou
                  adicionar outras abaixo — fica a seu critério.
                </p>
              )}

              {/* Lista */}
              {tarefasExistentes.length === 0 && tarefas.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 px-4 rounded-xl border border-dashed border-border/50 bg-surface-1/30 text-center">
                  <ListTodo className="h-6 w-6 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    Nenhuma tarefa ainda — adicione a próxima ação abaixo.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {tarefasExistentes.map((t) => {
                    const raw: string = t.titulo || t.descricao || "";
                    const isAI = /^\[SUGEST(Ã|A)O IA/i.test(raw);
                    const display = isAI
                      ? raw.replace(/^\[SUGEST(Ã|A)O IA[^\]]*\]\s*/i, "").split("\n")[0]
                      : raw;
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px]",
                          isAI
                            ? "bg-violet-400/5 border-violet-400/30"
                            : "bg-surface-1/60 border-border/40",
                        )}
                      >
                        {isAI ? (
                          <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="flex-1 truncate">{display}</span>
                        {t.data_agendada && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {new Date(t.data_agendada).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] uppercase tracking-wider px-1.5 py-0",
                            isAI
                              ? "border-violet-400/40 text-violet-300"
                              : "border-border/40",
                          )}
                        >
                          {isAI ? "IA" : "já criada"}
                        </Badge>
                        <button
                          type="button"
                          onClick={async () => {
                            const { error } = await supabase
                              .from("crm_atividades" as any)
                              .delete()
                              .eq("id", t.id);
                            if (error) {
                              toast({
                                title: "Erro ao remover",
                                description: error.message,
                                variant: "destructive",
                              });
                              return;
                            }
                            setTarefasExistentes((p) => p.filter((x) => x.id !== t.id));
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remover tarefa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  {tarefas.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-[12px]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="flex-1 truncate">{t.titulo}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(t.data_agendada).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removerTarefa(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remover tarefa"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Form criar */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    O que precisa ser feito?
                  </Label>
                  <Input
                    ref={tarefaTituloRef}
                    placeholder="Ex.: Ligar para o decisor financeiro"
                    value={novaTarefaTitulo}
                    onChange={(e) => setNovaTarefaTitulo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        adicionarTarefa();
                      }
                    }}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Quando
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setNovaTarefaData(formatLocalDateTime(p.build()))}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-surface-1/60 hover:bg-surface-1 hover:border-border transition-colors flex items-center gap-1"
                      >
                        <CalendarIcon className="h-3 w-3" /> {p.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="datetime-local"
                    value={novaTarefaData}
                    onChange={(e) => setNovaTarefaData(e.target.value)}
                  />
                </div>

                <Button
                  type="button"
                  onClick={adicionarTarefa}
                  className="w-full"
                  disabled={!novaTarefaTitulo.trim() || !novaTarefaData}
                >
                  <Plus className="h-4 w-4 mr-1.5" /> Adicionar tarefa
                </Button>

                {errors.novaTarefa && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {errors.novaTarefa}
                  </p>
                )}
                {submitted && liveErrors.tarefas && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.tarefas}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/40 gap-2 sm:gap-2">
          {stepNumber > 1 ? (
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
              className="mr-auto"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="mr-auto"
            >
              Cancelar
            </Button>
          )}

          {!isLastStep ? (
            <Button onClick={handleNext} disabled={!isStepValid(step)}>
              Continuar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button onClick={submit} disabled={saving || !isAllValid}>
                      {saving ? "Salvando..." : "Confirmar avanço"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {!isAllValid && (
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-xs font-semibold mb-1">Falta preencher:</p>
                    <ul className="text-[11px] space-y-0.5 list-disc list-inside">
                      {Object.values(liveErrors).map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
