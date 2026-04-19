import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OPORTUNIDADE_ETAPAS } from "@/hooks/useCrmOportunidades";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageCircle,
  Pencil,
  Trash2,
  Plus,
  Sparkles,
  Loader2,
  ListTodo,
  Archive,
} from "lucide-react";
import { formatPhone, whatsappNumber, locationFromPhone, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";
import { OportunidadeTimeline } from "./OportunidadeTimeline";
import { CloserCopilot } from "./CloserCopilot";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOportunidadeAtividades } from "@/hooks/useOportunidadeAtividades";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oportunidade: any | null;
  onSave: (op: any) => Promise<void> | void;
  onChangeEtapa: (id: string, etapaDestino: string, op: any) => void;
  onDelete?: (id: string) => Promise<void> | void;
}

/** Deriva o Tier a partir do faturamento (mesmo critério do CRM Lead) */
function tierFromFaturamento(fat?: string | null): string {
  if (!fat) return "—";
  const raw = String(fat).toLowerCase().trim();
  const m = raw.match(/([\d]+(?:[.,]\d+)?)/);
  if (!m) return "—";
  let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  if (isNaN(n)) {
    n = parseFloat(m[1].replace(",", "."));
    if (isNaN(n)) return "—";
  }
  if (/(milhão|milhões|mi\b|mm\b)/.test(raw)) n *= 1_000_000;
  else if (/(mil\b|k\b)/.test(raw)) n *= 1_000;
  else if (/bilh/.test(raw)) n *= 1_000_000_000;
  if (n <= 100_000) return "Tiny";
  if (n <= 200_000) return "Small";
  if (n <= 4_000_000) return "Medium";
  if (n <= 16_000_000) return "Large";
  return "Enterprise";
}

const HoverEditField = ({
  label,
  value,
  onChange,
  multiline,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
}) => {
  const [editing, setEditing] = useState(false);
  return (
    <div className="group flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1">{label}</p>
        {editing ? (
          multiline ? (
            <Textarea
              autoFocus
              rows={3}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
              className="text-sm"
            />
          ) : (
            <Input
              autoFocus
              type={type}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
              className="h-8 text-sm"
            />
          )
        ) : (
          <p className="text-sm text-foreground break-words whitespace-pre-wrap">
            {value || <span className="text-muted-foreground/60">—</span>}
          </p>
        )}
      </div>
      {!editing && (
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
          title={`Editar ${label}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

const SalesforceStepper = ({
  currentIdx,
  onStep,
}: {
  currentIdx: number;
  onStep: (id: string) => void;
}) => {
  return (
    <div className="flex w-full overflow-hidden rounded-md border border-border/40 bg-muted/10">
      {OPORTUNIDADE_ETAPAS.map((e, i) => {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        const isLast = i === OPORTUNIDADE_ETAPAS.length - 1;

        return (
          <button
            key={e.id}
            onClick={() => onStep(e.id)}
            className={`relative flex-1 min-w-0 h-10 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wider transition-colors px-3
              ${
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isPast
                  ? "bg-primary/70 text-primary-foreground hover:bg-primary/80"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              }
            `}
            style={{
              clipPath: isLast
                ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)"
                : i === 0
                ? "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)"
                : "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)",
              marginLeft: i === 0 ? 0 : -8,
              zIndex: OPORTUNIDADE_ETAPAS.length - i,
            }}
            title={e.label}
          >
            <span className="flex items-center gap-1.5 truncate">
              {isPast && <Check className="h-3 w-3 shrink-0" />}
              <span className="truncate">{e.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

/** Linha somente-leitura para exibir um campo do lead */
const ReadOnlyRow = ({ label, value }: { label: string; value?: string | number | null }) => {
  const v = value == null || value === "" ? null : String(value);
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1">{label}</p>
        <p className="text-sm text-foreground break-words whitespace-pre-wrap">
          {v ?? <span className="text-muted-foreground/60">—</span>}
        </p>
      </div>
    </div>
  );
};

/** Renderiza TODOS os campos do lead vinculado (espelha CRM Lead) */
const LeadReadOnlyFields = ({ lead }: { lead: any }) => {
  const tier = tierFromFaturamento(lead?.faturamento);
  const fmtDate = (d?: string | null) => {
    if (!d) return null;
    try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
  };
  return (
    <div>
      <ReadOnlyRow label="Nome" value={lead.nome} />
      <ReadOnlyRow label="Empresa" value={lead.empresa} />
      <ReadOnlyRow label="Telefone" value={lead.telefone} />
      <ReadOnlyRow label="WhatsApp" value={lead.telefone} />
      <ReadOnlyRow label="E-mail" value={lead.email} />
      <ReadOnlyRow label="Instagram" value={lead.instagram} />
      <ReadOnlyRow label="Site" value={lead.site} />
      <ReadOnlyRow label="Cargo" value={lead.cargo} />
      <ReadOnlyRow label="Documento empresa" value={lead.documento_empresa} />
      <ReadOnlyRow label="Faturamento" value={lead.faturamento} />
      <ReadOnlyRow label="Tier (auto)" value={tier} />
      <ReadOnlyRow label="Segmento" value={lead.segmento} />
      <ReadOnlyRow label="Canal" value={lead.canal} />
      <ReadOnlyRow label="Origem" value={lead.origem} />
      <ReadOnlyRow label="Urgência" value={lead.urgencia} />
      <ReadOnlyRow label="Temperatura" value={lead.temperatura} />
      <ReadOnlyRow label="Qualificação" value={lead.qualificacao} />
      <ReadOnlyRow label="Cidade" value={lead.cidade} />
      <ReadOnlyRow label="Estado" value={lead.estado} />
      <ReadOnlyRow label="País" value={lead.pais} />
      <ReadOnlyRow label="Etapa atual do lead" value={lead.etapa} />
      <ReadOnlyRow label="Nome do produto" value={lead.nome_produto} />
      <ReadOnlyRow label="Tipo de produto" value={lead.tipo_produto} />
      <ReadOnlyRow label="Valor pago (R$)" value={lead.valor_pago} />
      <ReadOnlyRow label="Arrematador" value={lead.arrematador} />
      <ReadOnlyRow label="Data de aquisição" value={fmtDate(lead.data_aquisicao)} />
      <ReadOnlyRow label="Data de criação na origem" value={fmtDate(lead.data_criacao_origem)} />
      <ReadOnlyRow label="Reunião agendada" value={fmtDate(lead.data_reuniao_agendada)} />
      <ReadOnlyRow label="Reunião realizada" value={fmtDate(lead.data_reuniao_realizada)} />
      <ReadOnlyRow label="Motivo da desqualificação" value={lead.motivo_desqualificacao} />
      <ReadOnlyRow label="Descrição" value={lead.descricao} />
      <ReadOnlyRow label="Notas do lead" value={lead.notas} />
      <ReadOnlyRow label="Lead criado em" value={fmtDate(lead.created_at)} />
    </div>
  );
};

export const OportunidadeDetailSheet = ({
  open,
  onOpenChange,
  oportunidade,
  onSave,
  onChangeEtapa,
  onDelete,
}: Props) => {
  const [form, setForm] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("informacoes");
  const [tarefaDialogOpen, setTarefaDialogOpen] = useState(false);
  const [aiResumo, setAiResumo] = useState<string>("");
  const [aiTarefa, setAiTarefa] = useState<{ titulo: string; descricao: string; prazo_sugerido_dias: number; prioridade: string } | null>(null);
  const [aiLoadingResumo, setAiLoadingResumo] = useState(false);
  const [aiLoadingTarefa, setAiLoadingTarefa] = useState(false);
  const [transcricaoEditing, setTranscricaoEditing] = useState(false);
  const [transcricaoExpanded, setTranscricaoExpanded] = useState(false);
  const processedHashRef = useRef<string>("");
  const autoTaskCreatedRef = useRef<string>("");
  const { toast } = useToast();
  const { data: atividades, addTarefa, addNota, addReuniao } = useOportunidadeAtividades(oportunidade?.id ?? null);

  // Reuniões arquivadas (histórico) — atividades tipo "reuniao"
  const reunioesArquivadas = useMemo(
    () => (atividades ?? []).filter((a: any) => a.tipo === "reuniao"),
    [atividades],
  );

  useEffect(() => {
    if (open) {
      setForm(oportunidade);
      setActiveTab("informacoes");
      setAiResumo(oportunidade?.resumo_reuniao ?? "");
      setAiTarefa(null);
      setAiLoadingResumo(false);
      setAiLoadingTarefa(false);
      setTranscricaoEditing(!(oportunidade?.transcricao_reuniao ?? "").trim());
      setTranscricaoExpanded(false);
      // Se já existe resumo salvo, marca o hash da transcrição como já processado
      // (evita reprocessar automaticamente ao abrir)
      processedHashRef.current = oportunidade?.resumo_reuniao
        ? (oportunidade?.transcricao_reuniao ?? "").trim()
        : "";
      autoTaskCreatedRef.current = "";
    }
  }, [open, oportunidade]);

  const initialIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      initialIdRef.current = null;
      return;
    }
    if (!form?.id) return;
    if (initialIdRef.current !== form.id) {
      initialIdRef.current = form.id;
      return;
    }
    if (!form.nome_oportunidade?.trim()) return;

    const t = setTimeout(() => {
      const payload: any = { ...form };
      payload.valor_ef = payload.valor_ef === "" || payload.valor_ef == null ? null : Number(payload.valor_ef);
      payload.valor_fee = payload.valor_fee === "" || payload.valor_fee == null ? null : Number(payload.valor_fee);
      payload.data_fechamento_previsto = payload.data_fechamento_previsto || null;
      payload.motivo_perda = payload.motivo_perda?.trim() || null;
      payload.notas = payload.notas?.trim() || null;
      payload.transcricao_reuniao = payload.transcricao_reuniao?.trim() || null;
      payload.resumo_reuniao = payload.resumo_reuniao?.trim() || null;
      payload.temperatura = payload.temperatura || null;
      delete payload.lead;
      delete payload.valor_total;
      delete payload.created_at;
      delete payload.updated_at;
      Promise.resolve(onSave(payload)).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, open]);

  // Auto-processamento quando a transcrição fica estável (debounce) — Sonnet (resumo) + Opus 4.5 (tarefa)
  const autoProcessRef = useRef<(txt: string) => void>(() => {});
  useEffect(() => {
    if (!open || !form?.id) return;
    const txt = (form.transcricao_reuniao ?? "").trim();
    if (txt.length < 20) return;
    if (processedHashRef.current === txt) return;
    const t = setTimeout(() => {
      processedHashRef.current = txt;
      autoProcessRef.current(txt);
    }, 1200);
    return () => clearTimeout(t);
  }, [form?.transcricao_reuniao, open, form?.id]);

  if (!form) return null;

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const currentIdx = OPORTUNIDADE_ETAPAS.findIndex((e) => e.id === form.etapa);
  const lead = form.lead;
  const phoneFmt = formatPhone(lead?.telefone);
  const wa = whatsappNumber(lead?.telefone);
  const loc = locationFromPhone(lead?.telefone);
  const since = form.data_proposta || form.created_at;

  const copyPhone = () => {
    if (!phoneFmt) return;
    navigator.clipboard.writeText(phoneFmt);
    toast({ title: "Telefone copiado", description: phoneFmt });
  };

  const handleStep = (etapaId: string) => {
    if (etapaId === form.etapa) return;
    onChangeEtapa(form.id, etapaId, form);
  };

  const handleDelete = async () => {
    if (!form.id || !onDelete) return;
    if (!confirm("Excluir esta oportunidade?")) return;
    await onDelete(form.id);
    onOpenChange(false);
  };

  const callMeetingAI = async (
    action: "summarize" | "suggest_task",
    opts?: { silent?: boolean; transcricaoOverride?: string; providerOverride?: "sonnet" | "opus45" | "haiku45" },
  ): Promise<any> => {
    const transcricao = (opts?.transcricaoOverride ?? form.transcricao_reuniao ?? "").trim();
    if (transcricao.length < 20) {
      if (!opts?.silent) {
        toast({ title: "Transcrição vazia", description: "Cole a transcrição da reunião antes de usar a IA.", variant: "destructive" });
      }
      return null;
    }
    // Sonnet para resumo (auto), Opus 4.5 para sugestão de tarefa e reprocessamento manual
    const provider = opts?.providerOverride ?? (action === "summarize" ? "sonnet" : "opus45");
    if (action === "summarize") setAiLoadingResumo(true);
    else setAiLoadingTarefa(true);
    try {
      const contexto = {
        nome_oportunidade: form.nome_oportunidade,
        etapa: form.etapa,
        valor_ef: form.valor_ef,
        valor_fee: form.valor_fee,
        temperatura: form.temperatura,
        lead: lead ? {
          nome: lead.nome, empresa: lead.empresa, segmento: lead.segmento,
          faturamento: lead.faturamento, qualificacao: lead.qualificacao,
        } : null,
      };
      const { data, error } = await supabase.functions.invoke("meeting-ai", {
        body: { action, transcricao, contexto, provider },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (action === "summarize") {
        const resumo = (data as any).resumo ?? "";
        setAiResumo(resumo);
        // Persiste o resumo no banco (descarta o antigo)
        if (form.id && resumo) {
          setForm((p: any) => ({ ...p, resumo_reuniao: resumo }));
          supabase
            .from("crm_oportunidades")
            .update({ resumo_reuniao: resumo })
            .eq("id", form.id)
            .then(() => {});
        }
        return resumo;
      } else {
        setAiTarefa((data as any).tarefa ?? null);
        return (data as any).tarefa ?? null;
      }
    } catch (e: any) {
      if (!opts?.silent) {
        toast({ title: "Erro na IA", description: e?.message ?? "Falha ao chamar IA", variant: "destructive" });
      }
      return null;
    } finally {
      if (action === "summarize") setAiLoadingResumo(false);
      else setAiLoadingTarefa(false);
    }
  };

  // Reprocessar resumo sob demanda — sempre Opus 4.5, NÃO gera nova tarefa
  const handleReprocessSummary = () => {
    callMeetingAI("summarize", { providerOverride: "opus45" });
  };

  // Conecta o auto-processamento ao callMeetingAI (definido acima)
  // Resumo via Sonnet + Tarefa via Opus 4.5 (auto-criada como sugestão pendente em Tarefas)
  autoProcessRef.current = async (txt: string) => {
    callMeetingAI("summarize", { silent: true, transcricaoOverride: txt });
    const tarefa = await callMeetingAI("suggest_task", { silent: true, transcricaoOverride: txt });
    if (tarefa && form?.id && autoTaskCreatedRef.current !== txt) {
      autoTaskCreatedRef.current = txt;
      const dt = new Date();
      const dias = Number(tarefa.prazo_sugerido_dias) > 0 ? Number(tarefa.prazo_sugerido_dias) : 1;
      dt.setDate(dt.getDate() + dias);
      dt.setHours(9, 0, 0, 0);
      try {
        await addTarefa.mutateAsync({
          titulo: `[SUGESTÃO IA · ${tarefa.prioridade?.toUpperCase() ?? "MED"}] ${tarefa.titulo}\n${tarefa.descricao}`,
          data_agendada: dt.toISOString(),
        });
        toast({ title: "Tarefa sugerida criada", description: `${tarefa.titulo} · prazo em ${dias}d` });
      } catch (_) { /* silencioso */ }
    }
  };

  const aplicarResumoNasNotas = async () => {
    if (!aiResumo) return;
    const atual = (form.notas ?? "").trim();
    const bloco = `\n\n---\n📝 Resumo IA da reunião:\n${aiResumo}`;
    set("notas", atual ? atual + bloco : aiResumo);
    if (form.id) {
      try {
        await addNota.mutateAsync(`📝 **Resumo IA da reunião**\n\n${aiResumo}`);
      } catch (_) { /* silencioso */ }
    }
    toast({ title: "Resumo adicionado às notas e ao histórico" });
  };

  const criarTarefaSugerida = async () => {
    if (!aiTarefa || !form.id) return;
    const dt = new Date();
    dt.setDate(dt.getDate() + (aiTarefa.prazo_sugerido_dias ?? 1));
    dt.setHours(9, 0, 0, 0);
    try {
      await addTarefa.mutateAsync({
        titulo: `[${aiTarefa.prioridade?.toUpperCase() ?? "MED"}] ${aiTarefa.titulo}\n${aiTarefa.descricao}`,
        data_agendada: dt.toISOString(),
      });
      toast({ title: "Tarefa criada", description: aiTarefa.titulo });
      setAiTarefa(null);
    } catch (e: any) {
      toast({ title: "Erro ao criar tarefa", description: e?.message, variant: "destructive" });
    }
  };

  const arquivarReuniaoAtual = async () => {
    const txt = (form.transcricao_reuniao ?? "").trim();
    if (!form.id || txt.length < 20) {
      toast({ title: "Nada para arquivar", description: "Cole uma transcrição antes de iniciar uma nova reunião.", variant: "destructive" });
      return;
    }
    const dataStr = new Date().toLocaleDateString("pt-BR");
    const titulo = `Reunião — ${dataStr}`;
    const descricao = aiResumo
      ? `📝 **Resumo**\n\n${aiResumo}\n\n---\n\n**Transcrição completa:**\n\n${txt}`
      : `**Transcrição:**\n\n${txt}`;
    try {
      await addReuniao.mutateAsync({ titulo, descricao });
      // Limpa transcrição ativa, resumo persistido e estados de IA
      set("transcricao_reuniao", "");
      setForm((p: any) => ({ ...p, resumo_reuniao: null }));
      if (form.id) {
        supabase.from("crm_oportunidades").update({ resumo_reuniao: null }).eq("id", form.id).then(() => {});
      }
      setAiResumo("");
      setAiTarefa(null);
      processedHashRef.current = "";
      autoTaskCreatedRef.current = "";
      toast({ title: "Reunião arquivada", description: "Comece uma nova transcrição." });
    } catch (e: any) {
      toast({ title: "Erro ao arquivar", description: e?.message, variant: "destructive" });
    }
  };


  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-screen sm:max-w-[min(96vw,1400px)] overflow-y-auto glass-strong border-l-border/60"
      >
        <SheetHeader>
          <SheetTitle className="tracking-tight text-[22px] font-semibold pr-10">
            {form.nome_oportunidade || "Oportunidade"}
          </SheetTitle>
        </SheetHeader>

        {/* STEPPER */}
        <div className="mt-6 mb-6">
          <div className="flex items-center justify-end mb-2 min-h-[24px]">
            {onDelete && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-red-400 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors"
                title="Excluir oportunidade"
              >
                <Trash2 className="h-3 w-3" />
                Excluir
              </button>
            )}
          </div>
          <SalesforceStepper currentIdx={currentIdx} onStep={handleStep} />
          <div className="flex items-center justify-end mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setActiveTab("tarefas"); setTarefaDialogOpen(true); }}
              className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3 mr-1" />
              Criar tarefa
            </Button>
          </div>
        </div>

        {/* CONTATO RÁPIDO (lead vinculado) */}
        {lead && (
          <div className="bg-muted/20 border border-border/40 rounded-lg p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-medium text-foreground">{lead.nome}</p>
                {lead.empresa && lead.empresa !== lead.nome && (
                  <p className="text-xs text-muted-foreground mt-0.5">{lead.empresa}</p>
                )}
              </div>
              {since && (
                <span className="text-[11px] px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  {timeAgo(since)}
                </span>
              )}
            </div>
            {phoneFmt && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <button
                  onClick={copyPhone}
                  className="flex-1 flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors px-2 py-1.5 rounded hover:bg-muted/50 min-w-0"
                >
                  <Copy className="h-4 w-4 shrink-0" />
                  <span className="truncate">{phoneFmt}</span>
                </button>
                {wa && (
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
              </div>
            )}
            {loc && (
              <p className="text-xs text-muted-foreground pt-1">
                📍 {loc.cidade} / {loc.estado}
              </p>
            )}
          </div>
        )}

        {/* TABS */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid grid-cols-5 w-full h-auto rounded-xl bg-surface-2/60 p-1 backdrop-blur-sm">
            <TabsTrigger value="informacoes" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Informações
            </TabsTrigger>
            <TabsTrigger value="reuniao" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Reunião
            </TabsTrigger>
            <TabsTrigger value="copilot" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Copilot 🧠
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informacoes" className="mt-4">
            <Accordion type="multiple" className="space-y-2">
              {/* Oportunidade */}
              <AccordionItem
                value="oportunidade"
                className="border border-border/40 rounded-lg bg-background/30 px-4"
              >
                <AccordionTrigger className="text-[11px] font-semibold tracking-widest uppercase text-foreground hover:no-underline py-3">
                  Informações da oportunidade
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  <HoverEditField
                    label="Nome da oportunidade"
                    value={form.nome_oportunidade ?? ""}
                    onChange={(v) => set("nome_oportunidade", v)}
                  />
                  <HoverEditField
                    label="Valor EF (entrada)"
                    value={form.valor_ef != null ? String(form.valor_ef) : ""}
                    onChange={(v) => set("valor_ef", v)}
                    type="number"
                  />
                  <HoverEditField
                    label="Fee mensal"
                    value={form.valor_fee != null ? String(form.valor_fee) : ""}
                    onChange={(v) => set("valor_fee", v)}
                    type="number"
                  />
                  <HoverEditField
                    label="Valor total do contrato"
                    value={form.valor_total != null ? String(form.valor_total) : ""}
                    onChange={(v) => set("valor_total", v)}
                    type="number"
                  />
                  <HoverEditField
                    label="Fechamento previsto"
                    value={form.data_fechamento_previsto ?? ""}
                    onChange={(v) => set("data_fechamento_previsto", v)}
                    type="date"
                  />
                  {form.etapa === "fechado_perdido" && (
                    <HoverEditField
                      label="Motivo da perda"
                      value={form.motivo_perda ?? ""}
                      onChange={(v) => set("motivo_perda", v)}
                      multiline
                    />
                  )}
                  <HoverEditField
                    label="Notas internas"
                    value={form.notas ?? ""}
                    onChange={(v) => set("notas", v)}
                    multiline
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Lead vinculado — TODOS os campos do CRM Lead, somente leitura */}
              <AccordionItem
                value="lead"
                className="border border-border/40 rounded-lg bg-background/30 px-4"
              >
                <AccordionTrigger className="text-[11px] font-semibold tracking-widest uppercase text-foreground hover:no-underline py-3">
                  Informações do lead
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  {!lead ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhum lead vinculado a esta oportunidade.</p>
                  ) : (
                    <LeadReadOnlyFields lead={lead} />
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Qualificação — campos de qualificação do lead vinculado, somente leitura */}
              <AccordionItem
                value="qualificacao"
                className="border border-border/40 rounded-lg bg-background/30 px-4"
              >
                <AccordionTrigger className="text-[11px] font-semibold tracking-widest uppercase text-foreground hover:no-underline py-3">
                  Qualificação
                </AccordionTrigger>
                <AccordionContent className="pb-2">
                  {!lead ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhum lead vinculado a esta oportunidade.</p>
                  ) : (
                    <div>
                      <ReadOnlyRow label="Qualificação" value={lead.qualificacao} />
                      <ReadOnlyRow label="Site" value={lead.site} />
                      <ReadOnlyRow label="Instagram" value={lead.instagram} />
                      <ReadOnlyRow label="Temperatura" value={lead.temperatura} />
                      <ReadOnlyRow
                        label="Reunião agendada"
                        value={lead.data_reuniao_agendada ? new Date(lead.data_reuniao_agendada).toLocaleString("pt-BR") : null}
                      />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="tarefas" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Tarefas da oportunidade
              </p>
              <Button size="sm" onClick={() => setTarefaDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nova tarefa
              </Button>
            </div>
            {form.id && (
              <OportunidadeTimeline
                oportunidadeId={form.id}
                hideNotaComposer
                onlyTarefas
                tarefaDialogOpen={tarefaDialogOpen}
                onTarefaDialogOpenChange={setTarefaDialogOpen}
              />
            )}
          </TabsContent>

          <TabsContent value="reuniao" className="mt-4">
            <div className="px-4 py-3 border border-border/40 rounded-lg bg-background/30 space-y-4">
              {/* TOPO FIXO: Temperatura + ações */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                    Temperatura
                  </p>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-2/50 border border-border/40">
                    {[
                      { id: "quente", label: "Quente", emoji: "🔥", on: "bg-temp-hot/20 text-temp-hot ring-1 ring-temp-hot/50 shadow-ios-sm" },
                      { id: "morno", label: "Morno", emoji: "🌤️", on: "bg-temp-warm/20 text-temp-warm ring-1 ring-temp-warm/50 shadow-ios-sm" },
                      { id: "frio", label: "Frio", emoji: "❄️", on: "bg-temp-cold/20 text-temp-cold ring-1 ring-temp-cold/50 shadow-ios-sm" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => set("temperatura", t.id)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-[13px] font-display font-medium transition-all duration-200 ease-ios flex items-center justify-center gap-1.5",
                          form.temperatura === t.id
                            ? t.on
                            : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated/60",
                        )}
                      >
                        <span className="text-base leading-none">{t.emoji}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end pb-0.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={arquivarReuniaoAtual}
                    disabled={!((form.transcricao_reuniao ?? "").trim().length >= 20) || addReuniao.isPending}
                    className="h-9 text-[11px]"
                    title="Arquivar transcrição atual e iniciar uma nova reunião"
                  >
                    <Archive className="h-3.5 w-3.5 mr-1.5" />
                    + Nova reunião
                  </Button>
                </div>
              </div>

              {/* REUNIÕES ANTERIORES (arquivadas) */}
              {reunioesArquivadas.length > 0 && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Reuniões anteriores ({reunioesArquivadas.length})
                  </p>
                  <div className="space-y-1.5">
                    {reunioesArquivadas.map((r: any) => (
                      <Collapsible key={r.id}>
                        <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-surface-2/40 border border-border/40 hover:bg-surface-2/60 transition-colors text-left group">
                          <span className="text-xs font-medium text-foreground truncate">
                            {r.titulo || `Reunião — ${new Date(r.created_at).toLocaleDateString("pt-BR")}`}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 shrink-0" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 py-3 border border-t-0 border-border/40 rounded-b-md bg-background/20">
                            <div className="prose prose-sm prose-invert max-w-none
                              prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
                              prose-p:text-sm prose-p:text-foreground/85 prose-p:leading-relaxed prose-p:my-1
                              prose-strong:text-foreground
                              prose-ul:my-1 prose-li:text-sm prose-li:text-foreground/80
                              prose-hr:my-2 prose-hr:border-border/40">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.descricao ?? ""}</ReactMarkdown>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}

              {/* RESUMO IA — primeira coisa que aparece após transcrição */}
              {(aiLoadingResumo || aiResumo) && (
                <div className="rounded-lg border border-border/40 bg-surface-2/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Resumo IA <span className="text-muted-foreground/60">· Sonnet 4.5</span>
                    </p>
                    <div className="flex items-center gap-1">
                      {aiResumo && (
                        <>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={aplicarResumoNasNotas}>
                            Adicionar às notas
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={handleReprocessSummary}
                            disabled={aiLoadingResumo}
                            title="Reprocessar com Opus 4.5 (não cria nova tarefa)"
                          >
                            {aiLoadingResumo ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reprocessar (Opus)"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {aiLoadingResumo && !aiResumo ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Gerando resumo da reunião…
                    </div>
                  ) : (
                    <div className="prose prose-sm prose-invert max-w-none
                      prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
                      prose-h2:text-[13px] prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-primary prose-h2:mt-4 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border/40
                      prose-h3:text-xs prose-h3:uppercase prose-h3:tracking-wider prose-h3:text-muted-foreground prose-h3:mt-3 prose-h3:mb-1
                      prose-p:text-sm prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:my-1.5
                      prose-strong:text-foreground prose-strong:font-semibold
                      prose-ul:my-1.5 prose-ul:space-y-1 prose-li:text-sm prose-li:text-foreground/85 prose-li:marker:text-primary/60
                      prose-hr:my-3 prose-hr:border-border/40
                      prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[11px] prose-code:before:content-none prose-code:after:content-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResumo}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* INDICADOR de tarefa sendo gerada (será criada automaticamente em Tarefas) */}
              {aiLoadingTarefa && !aiTarefa && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <ListTodo className="h-3.5 w-3.5 text-primary" />
                  Sugerindo próxima tarefa (Opus 4.5) — será criada automaticamente na aba Tarefas…
                </div>
              )}

              {/* TRANSCRIÇÃO ATIVA — readonly por padrão, edita ao clicar */}
              <div className="border-t border-border/40 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Transcrição da reunião atual
                  </p>
                  {!transcricaoEditing && (form.transcricao_reuniao ?? "").trim().length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setTranscricaoEditing(true)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
                {transcricaoEditing || !((form.transcricao_reuniao ?? "").trim().length > 0) ? (
                  <Textarea
                    autoFocus={transcricaoEditing}
                    rows={10}
                    value={form.transcricao_reuniao ?? ""}
                    onChange={(e) => set("transcricao_reuniao", e.target.value)}
                    onBlur={() => {
                      if ((form.transcricao_reuniao ?? "").trim().length > 0) setTranscricaoEditing(false);
                    }}
                    placeholder="Cole aqui a transcrição completa da reunião — dores, decisores, objeções, próximos passos..."
                    className="text-sm resize-none"
                  />
                ) : (
                  <div className="relative">
                    <div
                      onClick={() => setTranscricaoEditing(true)}
                      className={cn(
                        "cursor-text rounded-md border border-border/40 bg-background/40 p-3 text-sm text-foreground/85 whitespace-pre-wrap hover:border-border/70 transition-all overflow-hidden",
                        transcricaoExpanded ? "max-h-none" : "max-h-[200px]",
                      )}
                      title="Clique para editar"
                    >
                      {form.transcricao_reuniao}
                    </div>
                    {!transcricaoExpanded && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-md bg-gradient-to-t from-background/95 to-transparent" />
                    )}
                    <div className="flex justify-center -mt-2 relative z-10">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 w-6 p-0 rounded-full"
                        onClick={() => setTranscricaoExpanded((v) => !v)}
                        title={transcricaoExpanded ? "Recolher" : "Expandir"}
                      >
                        {transcricaoExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                  Salvamento automático após 600ms. Resumo (Sonnet 4.5) e tarefa (Opus 4.5) gerados automaticamente — tarefa aparece na aba Tarefas com prazo sugerido.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            {form.id && <OportunidadeTimeline oportunidadeId={form.id} />}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
