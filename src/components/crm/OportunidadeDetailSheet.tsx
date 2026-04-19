import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { OPORTUNIDADE_ETAPAS } from "@/hooks/useCrmOportunidades";
import {
  Check,
  Copy,
  MessageCircle,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { formatPhone, whatsappNumber, locationFromPhone, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";
import { OportunidadeTimeline } from "./OportunidadeTimeline";
import { cn } from "@/lib/utils";

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
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(oportunidade);
      setActiveTab("informacoes");
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
      // normaliza
      payload.valor_ef = payload.valor_ef === "" || payload.valor_ef == null ? null : Number(payload.valor_ef);
      payload.valor_fee = payload.valor_fee === "" || payload.valor_fee == null ? null : Number(payload.valor_fee);
      payload.valor_total = payload.valor_total === "" || payload.valor_total == null ? null : Number(payload.valor_total);
      payload.data_fechamento_previsto = payload.data_fechamento_previsto || null;
      payload.motivo_perda = payload.motivo_perda?.trim() || null;
      payload.notas = payload.notas?.trim() || null;
      payload.transcricao_reuniao = payload.transcricao_reuniao?.trim() || null;
      payload.temperatura = payload.temperatura || null;
      delete payload.lead;
      Promise.resolve(onSave(payload)).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, open]);

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
          <TabsList className="grid grid-cols-4 w-full h-auto rounded-xl bg-surface-2/60 p-1 backdrop-blur-sm">
            <TabsTrigger value="informacoes" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Informações
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="reuniao" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Reunião
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-[11px] py-2 rounded-lg data-[state=active]:bg-surface-elevated data-[state=active]:shadow-ios-sm transition-all duration-200 ease-ios">
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informacoes" className="mt-4">
            <div className="px-4 py-2 border border-border/40 rounded-lg bg-background/30">
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
            </div>
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
              <div>
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

              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                  Transcrição da reunião de vendas
                </p>
                <Textarea
                  rows={12}
                  value={form.transcricao_reuniao ?? ""}
                  onChange={(e) => set("transcricao_reuniao", e.target.value)}
                  placeholder="Cole aqui a transcrição completa da reunião — dores, decisores, objeções, próximos passos..."
                  className="text-sm resize-none"
                />
                <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                  Salvamento automático após 600ms.
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
