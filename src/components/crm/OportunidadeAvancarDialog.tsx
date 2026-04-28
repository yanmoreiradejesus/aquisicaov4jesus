import { useEffect, useMemo, useRef, useState } from "react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  ChevronDown,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NovaTarefa {
  titulo: string;
  data_agendada: string;
}

interface GanhoPayload {
  contrato_url: string;
  oportunidades_monetizacao: string;
  grau_exigencia: string;
  info_deal: string;
  nivel_consciencia: string;
  data_assinatura: string; // ISO string — data em que o contrato foi assinado
}

const NIVEIS_CONSCIENCIA = [
  { value: "saber", label: "Saber" },
  { value: "ter", label: "Ter" },
  { value: "executar", label: "Executar" },
  { value: "potencializar", label: "Potencializar" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oportunidade: any | null;
  etapaDestino: string;
  tarefasPendentesCount?: number;
  onConfirm: (payload: {
    transcricao_reuniao?: string;
    temperatura?: string;
    novasTarefas: NovaTarefa[];
    valor_fee?: number;
    valor_ef?: number;
    ganho?: GanhoPayload;
  }) => Promise<void> | void;
}

const GRAUS_EXIGENCIA = [
  { value: "baixo", label: "Baixo", color: "text-emerald-400 bg-emerald-400/10 ring-emerald-400/40" },
  { value: "medio", label: "Médio", color: "text-amber-400 bg-amber-400/10 ring-amber-400/40" },
  { value: "alto", label: "Alto", color: "text-orange-400 bg-orange-400/10 ring-orange-400/40" },
  { value: "critico", label: "Crítico", color: "text-red-400 bg-red-400/10 ring-red-400/40" },
];

const TEMPERATURAS = [
  { value: "quente", label: "Quente", desc: "Pronto para fechar", icon: Flame, color: "text-red-400", ring: "ring-red-400/40", bg: "bg-red-400/10" },
  { value: "morno", label: "Morno", desc: "Precisa nutrir", icon: Thermometer, color: "text-amber-400", ring: "ring-amber-400/40", bg: "bg-amber-400/10" },
  { value: "frio", label: "Frio", desc: "Esfriou", icon: Snowflake, color: "text-cyan-400", ring: "ring-cyan-400/40", bg: "bg-cyan-400/10" },
];

// Etapas que exigem registro de reunião (transcrição).
// Ganho TAMBÉM exige transcrição (precisamos do registro da reunião que fechou),
// mas neste caso a temperatura é dispensada (lead já fechou).
const REQUIRES_MEETING = new Set(["negociacao", "contrato", "follow_infinito", "fechado_ganho"]);
// Etapas onde a temperatura também é exigida no step de reunião.
// Ganho está fora (lead fechou — temperatura não faz sentido).
const REQUIRES_TEMPERATURA = new Set(["negociacao", "contrato", "follow_infinito"]);
// Tarefas: sugeridas em etapas em andamento. Ganho não precisa.
const REQUIRES_TASK = new Set(["negociacao", "contrato", "follow_infinito"]);
// Valores obrigatórios em "Dúvidas e Fechamento". Em "Ganho" os valores
// aparecem dentro do próprio bloco ganho (para revisão/desconto), por isso
// não precisam ser cobrados como step separado.
const REQUIRES_VALORES = new Set(["contrato"]);
const REQUIRES_GANHO_FORM = new Set(["fechado_ganho"]);
const CONTRATO_BUCKET = "contratos-assinados";
const CONTRATO_MAX_BYTES = 20 * 1024 * 1024;

const formatLocalDateTime = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const PRESETS = [
  { label: "Amanhã 9h", build: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: "Em 3 dias", build: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(9, 0, 0, 0); return d; } },
  { label: "Próxima semana", build: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; } },
];

/**
 * Função utilitária pura — diz quais "steps" o wizard precisaria abrir.
 * Usada também por Oportunidades.tsx para pular o dialog se nenhum step for necessário.
 */
export function computeNeededSteps(
  oportunidade: any | null,
  etapaDestino: string,
  tarefasPendentesCount: number,
): { meeting: boolean; task: boolean; valores: boolean; ganho: boolean; any: boolean } {
  if (!oportunidade) return { meeting: false, task: false, valores: false, ganho: false, any: false };
  const hasTranscricao = !!oportunidade?.transcricao_reuniao?.toString().trim();
  const hasTemperatura = !!oportunidade?.temperatura;
  const hasValores = Number(oportunidade?.valor_ef ?? 0) > 0 || Number(oportunidade?.valor_fee ?? 0) > 0;

  const requireTemp = REQUIRES_TEMPERATURA.has(etapaDestino);
  const meeting = REQUIRES_MEETING.has(etapaDestino) && (!hasTranscricao || (requireTemp && !hasTemperatura));
  // Tarefa: passo é exibido se não houver nenhuma pendente (para sugerir via IA), mas é OPCIONAL — não bloqueia o avanço.
  const task = REQUIRES_TASK.has(etapaDestino) && tarefasPendentesCount === 0;
  const valores = REQUIRES_VALORES.has(etapaDestino) && !hasValores;
  const ganho = REQUIRES_GANHO_FORM.has(etapaDestino); // bloco ganho sempre obrigatório (contrato + grau + monetização + info)
  return { meeting, task, valores, ganho, any: meeting || task || valores || ganho };
}

export const OportunidadeAvancarDialog = ({
  open,
  onOpenChange,
  oportunidade,
  etapaDestino,
  onConfirm,
}: Props) => {
  const { toast } = useToast();
  const etapaInfo = OPORTUNIDADE_ETAPAS.find((e) => e.id === etapaDestino);

  const [tarefasExistentes, setTarefasExistentes] = useState<any[]>([]);

  // Detecção do que já existe
  const hasTranscricaoSalva = !!oportunidade?.transcricao_reuniao?.toString().trim();
  const hasTemperaturaSalva = !!oportunidade?.temperatura;
  const hasValoresSalvos =
    Number(oportunidade?.valor_ef ?? 0) > 0 || Number(oportunidade?.valor_fee ?? 0) > 0;

  // State de inputs
  const [step, setStep] = useState(1);
  const [novaTranscricao, setNovaTranscricao] = useState("");
  const [adicionarNovaReuniao, setAdicionarNovaReuniao] = useState(false);
  const [temperatura, setTemperatura] = useState<string>("");
  const [tarefas, setTarefas] = useState<NovaTarefa[]>([]);
  const [novaTarefaTitulo, setNovaTarefaTitulo] = useState("");
  const [novaTarefaData, setNovaTarefaData] = useState("");
  const [valorFee, setValorFee] = useState<string>("");
  const [valorEf, setValorEf] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Ganho step state
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const [contratoUploading, setContratoUploading] = useState(false);
  const [oportunidadesMonetizacao, setOportunidadesMonetizacao] = useState("");
  const [grauExigencia, setGrauExigencia] = useState<string>("");
  const [infoDeal, setInfoDeal] = useState("");
  const [dataAssinatura, setDataAssinatura] = useState<string>(""); // YYYY-MM-DD

  // IA: estado da sugestão automática de tarefa
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const aiSuggestedForRef = useRef<string>(""); // hash da transcrição já processada

  const transcricaoRef = useRef<HTMLTextAreaElement>(null);
  const tarefaTituloRef = useRef<HTMLInputElement>(null);

  // Reset ao abrir
  useEffect(() => {
    if (open && oportunidade) {
      setStep(1);
      setSubmitted(false);
      setNovaTranscricao("");
      setAdicionarNovaReuniao(false);
      setTemperatura(oportunidade.temperatura || "");
      setTarefas([]);
      setNovaTarefaTitulo("");
      setNovaTarefaData(formatLocalDateTime(PRESETS[0].build()));
      setErrors({});
      setContratoFile(null);
      setContratoUploading(false);
      setOportunidadesMonetizacao(oportunidade.oportunidades_monetizacao || "");
      setGrauExigencia(oportunidade.grau_exigencia || "");
      setInfoDeal(oportunidade.info_deal || "");
      // Pré-preenche com a data de fechamento real (se houver) ou hoje
      const baseAssinatura = oportunidade.data_fechamento_real
        ? new Date(oportunidade.data_fechamento_real)
        : new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setDataAssinatura(
        `${baseAssinatura.getFullYear()}-${pad(baseAssinatura.getMonth() + 1)}-${pad(baseAssinatura.getDate())}`,
      );
      setValorFee(oportunidade.valor_fee != null && Number(oportunidade.valor_fee) > 0 ? String(oportunidade.valor_fee) : "");
      setValorEf(oportunidade.valor_ef != null && Number(oportunidade.valor_ef) > 0 ? String(oportunidade.valor_ef) : "");

      supabase
        .from("crm_atividades" as any)
        .select("id, titulo, descricao, data_agendada, concluida")
        .eq("oportunidade_id", oportunidade.id)
        .eq("tipo", "tarefa")
        .eq("concluida", false)
        .then(({ data }) => setTarefasExistentes((data as any[]) ?? []));
    }
  }, [open, oportunidade]);

  // Steps necessários (não removem o step atual quando o usuário preenche campos locais)
  const tarefasPendentesCount = tarefasExistentes.length + tarefas.length;
  const needs = useMemo(
    () => computeNeededSteps(oportunidade, etapaDestino, tarefasExistentes.length),
    [oportunidade, etapaDestino, tarefasExistentes.length],
  );

  const stepOrder: Array<"meeting" | "task" | "valores" | "ganho"> = useMemo(() => {
    const arr: Array<"meeting" | "task" | "valores" | "ganho"> = [];
    if (needs.meeting) arr.push("meeting");
    if (needs.task) arr.push("task");
    if (needs.valores) arr.push("valores");
    if (needs.ganho) arr.push("ganho");
    return arr;
  }, [needs.meeting, needs.task, needs.valores, needs.ganho]);

  const totalSteps = Math.max(1, stepOrder.length);
  const currentStepKey = (): "meeting" | "task" | "valores" | "ganho" | "none" =>
    stepOrder[step - 1] ?? "none";

  // Auto-focus por step
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const k = currentStepKey();
      if (k === "meeting") transcricaoRef.current?.focus();
      else if (k === "task") tarefaTituloRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, stepOrder.length]);

  // IA: sugerir tarefa automaticamente ao chegar no step "task"
  // Usa a transcrição (nova ou existente) e pré-preenche título + data.
  useEffect(() => {
    if (!open) return;
    if (currentStepKey() !== "task") return;
    if (aiSuggesting) return;
    // Já tem alguma tarefa? não sugere
    if (tarefasExistentes.length > 0 || tarefas.length > 0) return;

    // Determina texto base p/ IA: prioriza nova transcrição, senão a salva
    const baseTranscricao =
      novaTranscricao.trim() ||
      (oportunidade?.transcricao_reuniao?.toString().trim() ?? "");
    if (baseTranscricao.length < 20) return;

    // Evita reprocessar o mesmo texto
    const hash = `${oportunidade?.id ?? ""}::${baseTranscricao.length}::${baseTranscricao.slice(0, 80)}`;
    if (aiSuggestedForRef.current === hash) return;
    aiSuggestedForRef.current = hash;

    (async () => {
      setAiSuggesting(true);
      try {
        const { data, error } = await supabase.functions.invoke("meeting-ai", {
          body: {
            action: "suggest_task",
            transcricao: baseTranscricao,
            oportunidade: {
              nome: oportunidade?.nome_oportunidade,
              etapa: oportunidade?.etapa,
              temperatura: temperatura || oportunidade?.temperatura,
            },
          },
        });
        if (error) throw error;
        const tarefa = (data as any)?.tarefa;
        if (tarefa?.titulo) {
          setNovaTarefaTitulo(String(tarefa.titulo).slice(0, 200));
        }
        if (tarefa?.data_agendada) {
          const d = new Date(tarefa.data_agendada);
          if (!isNaN(d.getTime())) setNovaTarefaData(formatLocalDateTime(d));
        }
        toast({
          title: "Sugestão da IA",
          description: "Revise a tarefa sugerida e clique em Adicionar.",
        });
      } catch (e: any) {
        console.warn("[avancar-dialog] suggest_task falhou", e);
      } finally {
        setAiSuggesting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, stepOrder.length, tarefasExistentes.length, tarefas.length]);

  const adicionarTarefa = () => {
    const titulo = novaTarefaTitulo.trim();
    const newErrors: Record<string, string> = { ...errors };
    if (!titulo) { newErrors.novaTarefa = "Descreva a tarefa"; setErrors(newErrors); return; }
    if (!novaTarefaData) { newErrors.novaTarefa = "Escolha data e horário"; setErrors(newErrors); return; }
    setTarefas((p) => [...p, { titulo, data_agendada: new Date(novaTarefaData).toISOString() }]);
    setNovaTarefaTitulo("");
    delete newErrors.novaTarefa;
    delete newErrors.tarefas;
    setErrors(newErrors);
    setTimeout(() => tarefaTituloRef.current?.focus(), 50);
  };

  const removerTarefa = (i: number) => setTarefas((p) => p.filter((_, idx) => idx !== i));

  // Validação por step
  const liveErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (needs.meeting) {
      // Transcrição: se não tem salva, precisa nova com 20+; se tem salva e marcou "nova reunião", a nova precisa de 20+
      if (!hasTranscricaoSalva) {
        if (novaTranscricao.trim().length < 20) e.transcricao = "Cole a transcrição (mín. 20 caracteres)";
      } else if (adicionarNovaReuniao) {
        if (novaTranscricao.trim().length < 20) e.transcricao = "Transcrição complementar precisa de no mín. 20 caracteres";
      }
      if (REQUIRES_TEMPERATURA.has(etapaDestino) && !temperatura) e.temperatura = "Selecione a temperatura";
    }
    // Tarefa é opcional — não bloqueia o avanço.
    if (needs.valores) {
      const fee = Number(valorFee || 0);
      const ef = Number(valorEf || 0);
      if (!(fee > 0) && !(ef > 0)) e.valores = "Informe Valor Fee e/ou Valor EF (pelo menos um maior que zero)";
    }
    if (needs.ganho) {
      if (!contratoFile && !oportunidade?.contrato_url) e.contrato = "Anexe o contrato assinado (PDF)";
      if (!grauExigencia) e.grau = "Selecione o grau de exigência do cliente";
      if (oportunidadesMonetizacao.trim().length < 5) e.monetizacao = "Descreva oportunidades de monetização";
      if (infoDeal.trim().length < 5) e.info = "Descreva informações gerais do deal";
      if (!dataAssinatura) {
        e.assinatura = "Informe a data de assinatura do contrato";
      } else {
        const d = new Date(dataAssinatura);
        if (isNaN(d.getTime())) e.assinatura = "Data de assinatura inválida";
      }
      const fee = Number(valorFee || 0);
      const ef = Number(valorEf || 0);
      if (!(fee > 0) && !(ef > 0)) e.valoresGanho = "Confirme Valor Fee e/ou Valor EF (pelo menos um maior que zero)";
    }
    return e;
  }, [
    needs.meeting, needs.task, needs.valores, needs.ganho,
    hasTranscricaoSalva, adicionarNovaReuniao, novaTranscricao, temperatura, etapaDestino,
    tarefasPendentesCount, valorFee, valorEf,
    contratoFile, grauExigencia, oportunidadesMonetizacao, infoDeal, oportunidade?.contrato_url,
    dataAssinatura,
  ]);

  const isStepValid = (s: number): boolean => {
    const key = stepOrder[s - 1];
    if (key === "meeting") return !liveErrors.transcricao && !liveErrors.temperatura;
    if (key === "task") return !liveErrors.tarefas;
    if (key === "valores") return !liveErrors.valores;
    if (key === "ganho")
      return !liveErrors.contrato && !liveErrors.grau && !liveErrors.monetizacao && !liveErrors.info && !liveErrors.valoresGanho && !liveErrors.assinatura;
    return true;
  };

  const isAllValid = Object.keys(liveErrors).length === 0;

  const handleNext = () => {
    if (!isStepValid(step)) { setSubmitted(true); setErrors(liveErrors); return; }
    setSubmitted(false);
    setErrors({});
    setStep((s) => s + 1);
  };

  const uploadContrato = async (): Promise<string | undefined> => {
    if (!contratoFile) return oportunidade?.contrato_url || undefined;
    setContratoUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = contratoFile.name.split(".").pop() || "pdf";
      const path = `${user?.id ?? "anon"}/${oportunidade?.id ?? "new"}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(CONTRATO_BUCKET)
        .upload(path, contratoFile, { contentType: contratoFile.type, upsert: false });
      if (upErr) throw upErr;
      return path;
    } finally {
      setContratoUploading(false);
    }
  };

  const submit = async () => {
    setSubmitted(true);
    if (!isAllValid) { setErrors(liveErrors); return; }
    setSaving(true);
    try {
      let ganho: GanhoPayload | undefined;
      if (needs.ganho) {
        const contrato_url = await uploadContrato();
        // Convert YYYY-MM-DD to ISO at midday local to avoid timezone shifts
        const [yy, mm, dd] = dataAssinatura.split("-").map(Number);
        const assinaturaIso = new Date(yy, (mm ?? 1) - 1, dd ?? 1, 12, 0, 0).toISOString();
        ganho = {
          contrato_url: contrato_url || "",
          oportunidades_monetizacao: oportunidadesMonetizacao.trim(),
          grau_exigencia: grauExigencia,
          info_deal: infoDeal.trim(),
          data_assinatura: assinaturaIso,
        };
      }

      // Monta transcricao final
      let transcricaoFinal: string | undefined;
      if (needs.meeting) {
        if (!hasTranscricaoSalva) {
          transcricaoFinal = novaTranscricao.trim();
        } else if (adicionarNovaReuniao && novaTranscricao.trim()) {
          const data = new Date().toLocaleString("pt-BR");
          transcricaoFinal = `${oportunidade.transcricao_reuniao}\n\n--- Reunião em ${data} ---\n${novaTranscricao.trim()}`;
        }
        // se hasTranscricaoSalva && !adicionarNovaReuniao → não envia (mantém existente)
      }

      const payload: Parameters<typeof onConfirm>[0] = {
        transcricao_reuniao: transcricaoFinal,
        temperatura: needs.meeting && REQUIRES_TEMPERATURA.has(etapaDestino) ? temperatura : undefined,
        novasTarefas: tarefas,
        ganho,
      };
      if (needs.valores || needs.ganho) {
        const fee = Number(valorFee || 0);
        const ef = Number(valorEf || 0);
        if (fee > 0) payload.valor_fee = fee;
        if (ef > 0) payload.valor_ef = ef;
      }

      await onConfirm(payload);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e?.message || "Falha ao confirmar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const showStep = currentStepKey();
  const stepNumber = step;
  const stepLabel =
    showStep === "meeting" ? "Resultado da reunião" :
    showStep === "task" ? "Próxima atividade" :
    showStep === "valores" ? "Valores do deal" :
    showStep === "ganho" ? "Fechamento do deal" : "Confirmar";

  const isLastStep = stepNumber === totalSteps;

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl max-h-[92vh] overflow-y-auto p-0 gap-0">
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
              ? "Esta etapa exige ao menos uma tarefa pendente para acompanhamento."
              : showStep === "valores"
              ? "Informe os valores acordados para esta oportunidade."
              : showStep === "ganho"
              ? "Confirme o fechamento do deal."
              : "Confirme o avanço da oportunidade."}
          </DialogDescription>

          {totalSteps > 1 && (
            <div className="flex gap-1.5 pt-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < stepNumber ? "bg-primary" : "bg-border/60")} />
              ))}
            </div>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/80 pt-1">
            {stepLabel}
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-6">
          {showStep === "meeting" && (
            <>
              {/* Temperatura — escondida quando destino é Ganho (lead já fechou) */}
              {REQUIRES_TEMPERATURA.has(etapaDestino) && (
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
                          <Icon className={cn("h-6 w-6 transition-colors", active ? t.color : "text-muted-foreground group-hover:text-foreground")} />
                          <span className="text-[12px] font-semibold leading-none">{t.label}</span>
                          <span className="text-[10px] text-muted-foreground leading-tight">{t.desc}</span>
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
              )}

              {/* Transcrição */}
              {!hasTranscricaoSalva ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                      Transcrição da reunião *
                    </Label>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {novaTranscricao.length} caracteres
                    </span>
                  </div>
                  <Textarea
                    ref={transcricaoRef}
                    rows={8}
                    value={novaTranscricao}
                    onChange={(e) => setNovaTranscricao(e.target.value)}
                    placeholder="Cole aqui a transcrição completa da reunião — pontos discutidos, objeções, próximos passos, decisores envolvidos..."
                    className={cn("resize-none text-sm leading-relaxed", submitted && liveErrors.transcricao && "border-destructive")}
                  />
                  {submitted && liveErrors.transcricao && (
                    <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                      <AlertCircle className="h-3 w-3" /> {liveErrors.transcricao}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-400/5 border border-emerald-400/30">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-emerald-300 flex-1">
                      Transcrição já registrada nesta oportunidade
                    </span>
                  </div>
                  <Collapsible open={adicionarNovaReuniao} onOpenChange={setAdicionarNovaReuniao}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border/40 bg-surface-1/40 hover:bg-surface-1 transition-colors text-[12px]"
                      >
                        <span className="font-medium">Houve outra reunião? Adicionar nova transcrição</span>
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", adicionarNovaReuniao && "rotate-180")} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                          Nova transcrição (será anexada à existente)
                        </Label>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {novaTranscricao.length} caracteres
                        </span>
                      </div>
                      <Textarea
                        ref={transcricaoRef}
                        rows={6}
                        value={novaTranscricao}
                        onChange={(e) => setNovaTranscricao(e.target.value)}
                        placeholder="Cole a transcrição da nova reunião..."
                        className={cn("resize-none text-sm leading-relaxed", submitted && liveErrors.transcricao && "border-destructive")}
                      />
                      {submitted && liveErrors.transcricao && (
                        <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                          <AlertCircle className="h-3 w-3" /> {liveErrors.transcricao}
                        </p>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}
            </>
          )}

          {showStep === "task" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Próxima tarefa <span className="normal-case text-muted-foreground/70 font-normal">(opcional)</span>
                </Label>
                <span className={cn(
                  "text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full",
                  tarefasPendentesCount > 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-muted text-muted-foreground",
                )}>
                  {tarefasPendentesCount > 0 ? `${tarefasPendentesCount} pendente${tarefasPendentesCount !== 1 ? "s" : ""} ✓` : "Nenhuma"}
                </span>
              </div>

              {tarefasExistentes.some((t) => /\[SUGEST(Ã|A)O IA/i.test(t.titulo || "")) && (
                <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
                  Já existe uma tarefa sugerida pela IA. Você pode mantê-la, removê-la ou adicionar outras abaixo.
                </p>
              )}

              {aiSuggesting && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-400/5 border border-violet-400/30">
                  <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0 animate-pulse" />
                  <span className="text-[11px] text-violet-300">
                    IA analisando a transcrição para sugerir a próxima tarefa…
                  </span>
                </div>
              )}

              {tarefasExistentes.length === 0 && tarefas.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 px-4 rounded-xl border border-dashed border-border/50 bg-surface-1/30 text-center">
                  <ListTodo className="h-6 w-6 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">Nenhuma tarefa ainda — adicione a próxima ação abaixo.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {tarefasExistentes.map((t) => {
                    const raw: string = t.titulo || t.descricao || "";
                    const isAI = /^\[SUGEST(Ã|A)O IA/i.test(raw);
                    const display = isAI ? raw.replace(/^\[SUGEST(Ã|A)O IA[^\]]*\]\s*/i, "").split("\n")[0] : raw;
                    return (
                      <div key={t.id} className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg border text-[12px]",
                        isAI ? "bg-violet-400/5 border-violet-400/30" : "bg-surface-1/60 border-border/40",
                      )}>
                        {isAI ? <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="flex-1 truncate">{display}</span>
                        {t.data_agendada && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {new Date(t.data_agendada).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider px-1.5 py-0", isAI ? "border-violet-400/40 text-violet-300" : "border-border/40")}>
                          {isAI ? "IA" : "já criada"}
                        </Badge>
                        <button
                          type="button"
                          onClick={async () => {
                            const { error } = await supabase.from("crm_atividades" as any).delete().eq("id", t.id);
                            if (error) { toast({ title: "Erro ao remover", description: error.message, variant: "destructive" }); return; }
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
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-[12px]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="flex-1 truncate">{t.titulo}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {new Date(t.data_agendada).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <button type="button" onClick={() => removerTarefa(i)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="Remover tarefa">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarTarefa(); } }}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Quando</Label>
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
                  <Input type="datetime-local" value={novaTarefaData} onChange={(e) => setNovaTarefaData(e.target.value)} />
                </div>

                <Button type="button" onClick={adicionarTarefa} className="w-full" disabled={!novaTarefaTitulo.trim() || !novaTarefaData}>
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

          {showStep === "valores" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <DollarSign className="h-4 w-4 text-primary shrink-0" />
                <p className="text-[11px] text-foreground/80 leading-relaxed">
                  Informe pelo menos um dos valores abaixo. Eles serão usados para gerar as cobranças quando a oportunidade for ganha.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Valor Fee (mensal) — R$
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={valorFee}
                    onChange={(e) => setValorFee(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Cobrança recorrente mensal (12 parcelas).</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Valor EF (entrada/setup) — R$
                  </Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={valorEf}
                    onChange={(e) => setValorEf(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">Cobrança única de setup/entrada.</p>
                </div>
              </div>

              {submitted && liveErrors.valores && (
                <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                  <AlertCircle className="h-3 w-3" /> {liveErrors.valores}
                </p>
              )}
            </div>
          )}

          {showStep === "ganho" && (
            <div className="space-y-5">
              {/* Valores — revisão final (pode ter desconto vs. proposta) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                  <DollarSign className="h-4 w-4 text-primary shrink-0" />
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    Confirme os valores finais. Ajuste se houve desconto ou mudança em relação à proposta — eles geram as cobranças.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                      Valor Fee (mensal) — R$
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={valorFee}
                      onChange={(e) => setValorFee(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                      Valor EF (entrada/setup) — R$
                    </Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={valorEf}
                      onChange={(e) => setValorEf(e.target.value)}
                    />
                  </div>
                </div>
                {submitted && liveErrors.valoresGanho && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.valoresGanho}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Data de assinatura do contrato *
                </Label>
                <Input
                  type="date"
                  value={dataAssinatura}
                  onChange={(e) => setDataAssinatura(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  className={cn(submitted && liveErrors.assinatura && "border-destructive")}
                />
                <p className="text-[10px] text-muted-foreground">
                  Define a data oficial de fechamento (data_fechamento_real) e o início do contrato.
                </p>
                {submitted && liveErrors.assinatura && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.assinatura}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Contrato assinado * <span className="normal-case text-muted-foreground/70 font-normal">(PDF, máx. 20MB)</span>
                </Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f && f.size > CONTRATO_MAX_BYTES) { toast({ title: "Arquivo grande demais", description: "Limite: 20MB", variant: "destructive" }); e.target.value = ""; return; }
                    if (f && f.type !== "application/pdf") { toast({ title: "Formato inválido", description: "Envie um PDF", variant: "destructive" }); e.target.value = ""; return; }
                    setContratoFile(f);
                  }}
                  className={cn(submitted && liveErrors.contrato && "border-destructive")}
                />
                {contratoFile && (
                  <p className="text-[11px] text-muted-foreground">📎 {contratoFile.name} · {(contratoFile.size / 1024).toFixed(0)} KB</p>
                )}
                {!contratoFile && oportunidade?.contrato_url && (
                  <p className="text-[11px] text-emerald-400">✓ Contrato já anexado anteriormente (substitua se necessário)</p>
                )}
                {submitted && liveErrors.contrato && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.contrato}
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Grau de exigência do cliente *
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {GRAUS_EXIGENCIA.map((g) => {
                    const active = grauExigencia === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setGrauExigencia(g.value)}
                        className={cn(
                          "py-2.5 px-2 rounded-lg border text-[12px] font-semibold transition-all",
                          active ? cn("border-transparent ring-2 shadow-ios-sm", g.color) : "border-border/40 hover:border-border bg-surface-1/50 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
                {submitted && liveErrors.grau && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.grau}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Oportunidades de monetização *
                </Label>
                <Textarea
                  rows={4}
                  value={oportunidadesMonetizacao}
                  onChange={(e) => setOportunidadesMonetizacao(e.target.value)}
                  placeholder="Upsell, cross-sell, expansão futura, novos produtos que o cliente pode contratar..."
                  className={cn("resize-none text-sm", submitted && liveErrors.monetizacao && "border-destructive")}
                />
                {submitted && liveErrors.monetizacao && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.monetizacao}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  Informações gerais do deal *
                </Label>
                <Textarea
                  rows={4}
                  value={infoDeal}
                  onChange={(e) => setInfoDeal(e.target.value)}
                  placeholder="Decisores envolvidos, contexto do fechamento, prazos, expectativas, observações para o Account Manager..."
                  className={cn("resize-none text-sm", submitted && liveErrors.info && "border-destructive")}
                />
                {submitted && liveErrors.info && (
                  <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" /> {liveErrors.info}
                  </p>
                )}
              </div>

              {contratoUploading && <p className="text-[11px] text-muted-foreground">Enviando contrato...</p>}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/40 gap-2 sm:gap-2">
          {stepNumber > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={saving} className="mr-auto">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving} className="mr-auto">
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
