import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { Check, ChevronRight, ChevronDown, Copy, MessageCircle, Pencil, Trash2, AlertCircle, Calendar, ExternalLink, Loader2 } from "lucide-react";
import { formatPhone, whatsappNumber, locationFromPhone, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";
import { LeadTimeline } from "./LeadTimeline";
import { QualificacaoDialog } from "./QualificacaoDialog";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any | null;
  onSave: (lead: any) => Promise<void> | void;
  onChangeEtapa: (id: string, etapa: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

/** Deriva o Tier a partir do faturamento (texto livre, ex.: "R$ 350.000", "1.5 mi", "2 milhões") */
function tierFromFaturamento(fat?: string | null): string {
  if (!fat) return "—";
  const raw = String(fat).toLowerCase().trim();
  // captura primeiro número (aceita vírgula ou ponto como decimal)
  const m = raw.match(/([\d]+(?:[.,]\d+)?)/);
  if (!m) return "—";
  let n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  if (isNaN(n)) {
    n = parseFloat(m[1].replace(",", "."));
    if (isNaN(n)) return "—";
  }
  // multiplicadores
  if (/(milhão|milhões|mi\b|mm\b)/.test(raw)) n *= 1_000_000;
  else if (/(mil\b|k\b)/.test(raw)) n *= 1_000;
  else if (/bilh/.test(raw)) n *= 1_000_000_000;

  if (n <= 100_000) return "Tiny";
  if (n <= 200_000) return "Small";
  if (n <= 4_000_000) return "Medium";
  if (n <= 16_000_000) return "Large";
  return "Enterprise";
}

/** Campo com edição hover: mostra valor; ícone de lápis aparece no hover; clicar habilita input */
const HoverEditField = ({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  return (
    <div className="group flex items-start justify-between gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1">
          {label}
        </p>
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

export const LeadDetailSheet = ({ open, onOpenChange, lead, onSave, onChangeEtapa, onDelete }: Props) => {
  const [form, setForm] = useState<any>(null);
  const [qualOpen, setQualOpen] = useState(false);
  const [pendingEtapa, setPendingEtapa] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(lead);
    }
  }, [open, lead]);

  const tier = useMemo(() => tierFromFaturamento(form?.faturamento), [form?.faturamento]);

  // Autosave com debounce
  const initialIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      initialIdRef.current = null;
      return;
    }
    if (!form?.id) return;
    // pula o primeiro render após abrir (evita salvar sem mudança)
    if (initialIdRef.current !== form.id) {
      initialIdRef.current = form.id;
      return;
    }
    if (!form.nome?.trim()) return;
    const t = setTimeout(() => {
      const payload = { ...form, tier };
      if (payload.valor_pago === "" || payload.valor_pago == null) payload.valor_pago = null;
      else payload.valor_pago = Number(payload.valor_pago);
      if (!payload.data_aquisicao) payload.data_aquisicao = null;
      if (!payload.data_criacao_origem) payload.data_criacao_origem = null;
      Promise.resolve(onSave(payload)).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, tier, open]);

  if (!form) return null;

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const currentIdx = LEAD_ETAPAS.findIndex((e) => e.id === form.etapa);
  const phoneFmt = formatPhone(form.telefone);
  const wa = whatsappNumber(form.telefone);
  const loc = locationFromPhone(form.telefone);
  const since = form.data_criacao_origem || form.data_aquisicao || form.created_at;

  const copyPhone = () => {
    if (!phoneFmt) return;
    navigator.clipboard.writeText(phoneFmt);
    toast({ title: "Telefone copiado", description: phoneFmt });
  };

  const handleStep = async (etapaId: string) => {
    if (etapaId === form.etapa) return;
    if (etapaId === "reuniao_agendada" && !form.qualificacao?.trim()) {
      setPendingEtapa(etapaId);
      setQualOpen(true);
      return;
    }
    await onChangeEtapa(form.id, etapaId);
    setForm((p: any) => ({ ...p, etapa: etapaId }));
  };

  const handleConfirmQualificacao = async (qualificacao: string) => {
    const updated = { ...form, qualificacao };
    await onSave({ ...updated, tier });
    if (pendingEtapa) {
      await onChangeEtapa(form.id, pendingEtapa);
      setForm({ ...updated, etapa: pendingEtapa });
      setPendingEtapa(null);
    } else {
      setForm(updated);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl tracking-wider uppercase">
            {form.empresa || form.nome}
          </SheetTitle>
        </SheetHeader>

        {/* STEPPER de etapas */}
        <div className="mt-6 mb-8">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-3">
            Etapa do funil
          </p>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {LEAD_ETAPAS.map((e, i) => {
              const isCurrent = i === currentIdx;
              const isPast = i < currentIdx;
              return (
                <div key={e.id} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleStep(e.id)}
                    className={`group flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-md transition-all ${
                      isCurrent
                        ? "bg-primary/15 ring-1 ring-primary/40"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-bold transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : isPast
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                      }`}
                    >
                      {isPast ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wider whitespace-nowrap ${
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {e.label}
                    </span>
                  </button>
                  {i < LEAD_ETAPAS.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* CONTATO RÁPIDO */}
        <div className="bg-muted/20 border border-border/40 rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Lead
              </p>
              <p className="text-base font-medium text-foreground">{form.nome}</p>
              {form.empresa && form.empresa !== form.nome && (
                <p className="text-xs text-muted-foreground mt-0.5">{form.empresa}</p>
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

        {/* INFORMAÇÕES DO LEAD (collapsible) */}
        <Collapsible className="mb-3">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 bg-muted/10 hover:bg-muted/20 border border-border/40 rounded-lg transition-colors group">
            <span className="text-xs font-semibold tracking-widest uppercase text-foreground">
              Informações do lead
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pt-2 pb-1 border border-t-0 border-border/40 rounded-b-lg -mt-px bg-background/30">
            <HoverEditField label="Nome" value={form.nome ?? ""} onChange={(v) => set("nome", v)} />
            <HoverEditField label="Empresa" value={form.empresa ?? ""} onChange={(v) => set("empresa", v)} />
            <HoverEditField label="Telefone" value={form.telefone ?? ""} onChange={(v) => set("telefone", v)} />
            <HoverEditField label="E-mail" value={form.email ?? ""} onChange={(v) => set("email", v)} />
            <HoverEditField label="Cargo" value={form.cargo ?? ""} onChange={(v) => set("cargo", v)} />
            <HoverEditField label="Faturamento" value={form.faturamento ?? ""} onChange={(v) => set("faturamento", v)} />

            {/* Tier — derivado, não editável */}
            <div className="flex items-start justify-between gap-3 py-2 border-b border-border/30">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1">
                  Tier <span className="text-muted-foreground/60 normal-case tracking-normal">(auto)</span>
                </p>
                <p className="text-sm text-foreground">{tier}</p>
              </div>
            </div>

            <HoverEditField label="Segmento" value={form.segmento ?? ""} onChange={(v) => set("segmento", v)} />
            <HoverEditField label="Canal" value={form.canal ?? ""} onChange={(v) => set("canal", v)} />
            <HoverEditField
              label="Valor pago (R$)"
              value={form.valor_pago != null ? String(form.valor_pago) : ""}
              onChange={(v) => set("valor_pago", v)}
            />
            {form.etapa === "desqualificado" && (
              <HoverEditField
                label="Motivo da desqualificação"
                value={form.motivo_desqualificacao ?? ""}
                onChange={(v) => set("motivo_desqualificacao", v)}
              />
            )}
            <HoverEditField label="Descrição" value={form.descricao ?? ""} onChange={(v) => set("descricao", v)} multiline />
            <HoverEditField label="Notas internas" value={form.notas ?? ""} onChange={(v) => set("notas", v)} multiline />
          </CollapsibleContent>
        </Collapsible>

        {/* QUALIFICAÇÃO (collapsible) */}
        <Collapsible className="mb-6">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 bg-muted/10 hover:bg-muted/20 border border-border/40 rounded-lg transition-colors group">
            <span className="text-xs font-semibold tracking-widest uppercase text-foreground">
              Qualificação
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pt-3 pb-3 border border-t-0 border-border/40 rounded-b-lg -mt-px bg-background/30">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
              Detalhes da qualificação
            </p>
            <Textarea
              rows={6}
              value={form.qualificacao ?? ""}
              onChange={(e) => set("qualificacao", e.target.value)}
              placeholder="Ex.: Dor principal — gerar leads B2B. Faturamento ~R$ 800k/mês. Já testou Meta Ads sem ROI. Decisor: CEO. Urgência alta, quer começar em 30 dias."
              className="text-sm resize-none"
            />
          </CollapsibleContent>
        </Collapsible>

        {/* TIMELINE: notas, tarefas e histórico */}
        {form.id && (
          <div className="mb-6">
            <LeadTimeline leadId={form.id} />
          </div>
        )}

        {form.id && onDelete && (
          <div className="flex mt-6 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => { onDelete(form.id); onOpenChange(false); }}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          </div>
        )}
      </SheetContent>

      <QualificacaoDialog
        open={qualOpen}
        onOpenChange={(v) => { setQualOpen(v); if (!v) setPendingEtapa(null); }}
        initialValue={form.qualificacao}
        onConfirm={handleConfirmQualificacao}
      />
    </Sheet>
  );
};
