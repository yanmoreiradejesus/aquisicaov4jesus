import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import {
  Check,
  Copy,
  MessageCircle,
  Pencil,
  Trash2,
  AlertCircle,
  Calendar,
  CalendarIcon,
  ExternalLink,
  Loader2,
  Plus,
  CalendarClock,
  RefreshCw,
} from "lucide-react";
import { formatPhone, whatsappNumber, locationFromPhone, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";
import { LeadTimeline } from "./LeadTimeline";
import { QualificacaoDialog } from "./QualificacaoDialog";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any | null;
  onSave: (lead: any) => Promise<void> | void;
  onChangeEtapa: (id: string, etapa: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

/** Deriva o Tier a partir do faturamento */
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

/** Stepper estilo Salesforce: chevrons conectados com barra preenchida até a etapa atual */
const SalesforceStepper = ({
  currentIdx,
  onStep,
}: {
  currentIdx: number;
  onStep: (id: string) => void;
}) => {
  return (
    <div className="flex w-full overflow-hidden rounded-md border border-border/40 bg-muted/10">
      {LEAD_ETAPAS.map((e, i) => {
        const isCurrent = i === currentIdx;
        const isPast = i < currentIdx;
        const isDone = isPast || isCurrent;
        const isLast = i === LEAD_ETAPAS.length - 1;

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
              zIndex: LEAD_ETAPAS.length - i,
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

export const LeadDetailSheet = ({ open, onOpenChange, lead, onSave, onChangeEtapa, onDelete }: Props) => {
  const [form, setForm] = useState<any>(null);
  const [qualOpen, setQualOpen] = useState(false);
  const [pendingEtapa, setPendingEtapa] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("informacoes");
  const [tarefaDialogOpen, setTarefaDialogOpen] = useState(false);
  const [closerId, setCloserId] = useState<string>("");
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [extraAttendees, setExtraAttendees] = useState<{ email: string; nome: string; funcao: string }[]>([]);
  const { toast } = useToast();
  const {
    isConnected: googleConnected,
    emailGoogle,
    loading: googleLoading,
    connect: connectGoogle,
    createEvent: createGoogleEvent,
    disconnect: disconnectGoogle,
  } = useGoogleCalendar();

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("approved", true)
      .order("full_name", { ascending: true })
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  useEffect(() => {
    if (open) {
      setForm(lead);
      setActiveTab("informacoes");
    }
  }, [open, lead]);

  const tier = useMemo(() => tierFromFaturamento(form?.faturamento), [form?.faturamento]);

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
    if (etapaId === "reuniao_agendada" && (!form.qualificacao?.trim() || !form.temperatura)) {
      setPendingEtapa(etapaId);
      setQualOpen(true);
      return;
    }
    await onChangeEtapa(form.id, etapaId);
    setForm((p: any) => ({ ...p, etapa: etapaId }));
    if (etapaId === "reuniao_agendada") setActiveTab("reuniao");
  };

  const handleConfirmQualificacao = async (qualificacao: string, temperatura: string) => {
    const updated = { ...form, qualificacao, temperatura };
    await onSave({ ...updated, tier });
    if (pendingEtapa) {
      await onChangeEtapa(form.id, pendingEtapa);
      setForm({ ...updated, etapa: pendingEtapa });
      if (pendingEtapa === "reuniao_agendada") setActiveTab("reuniao");
      setPendingEtapa(null);
    } else {
      setForm(updated);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-screen sm:max-w-[min(96vw,1400px)] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl tracking-wider uppercase pr-10">
            {form.empresa || form.nome}
          </SheetTitle>
        </SheetHeader>

        {/* STEPPER estilo Salesforce */}
        <div className="mt-6 mb-6">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
            Etapa do funil
          </p>
          <SalesforceStepper currentIdx={currentIdx} onStep={handleStep} />
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

        {/* TABS principais */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid grid-cols-5 w-full h-auto">
            <TabsTrigger value="informacoes" className="text-[11px] py-2">
              Informações
            </TabsTrigger>
            <TabsTrigger value="tarefas" className="text-[11px] py-2">
              Tarefas
            </TabsTrigger>
            <TabsTrigger value="qualificacao" className="text-[11px] py-2">
              Qualificação
            </TabsTrigger>
            <TabsTrigger value="reuniao" className="text-[11px] py-2">
              Reunião
            </TabsTrigger>
            <TabsTrigger value="historico" className="text-[11px] py-2">
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* TAB: Informações */}
          <TabsContent value="informacoes" className="mt-4">
            <div className="px-4 py-2 border border-border/40 rounded-lg bg-background/30">
              <HoverEditField label="Nome" value={form.nome ?? ""} onChange={(v) => set("nome", v)} />
              <HoverEditField label="Empresa" value={form.empresa ?? ""} onChange={(v) => set("empresa", v)} />
              <HoverEditField label="Telefone" value={form.telefone ?? ""} onChange={(v) => set("telefone", v)} />
              <HoverEditField label="E-mail" value={form.email ?? ""} onChange={(v) => set("email", v)} />
              <HoverEditField label="Cargo" value={form.cargo ?? ""} onChange={(v) => set("cargo", v)} />
              <HoverEditField label="Faturamento" value={form.faturamento ?? ""} onChange={(v) => set("faturamento", v)} />

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
            </div>
          </TabsContent>

          {/* TAB: Tarefas */}
          <TabsContent value="tarefas" className="mt-4">
            <div className="flex justify-end mb-3">
              <Button size="sm" onClick={() => setTarefaDialogOpen(true)}>
                <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
                Nova tarefa
              </Button>
            </div>
            {form.id && (
              <LeadTimeline
                leadId={form.id}
                hideNotaComposer
                tarefaDialogOpen={tarefaDialogOpen}
                onTarefaDialogOpenChange={setTarefaDialogOpen}
              />
            )}
          </TabsContent>

          {/* TAB: Qualificação */}
          <TabsContent value="qualificacao" className="mt-4">
            <div className="px-4 py-3 border border-border/40 rounded-lg bg-background/30 space-y-4">
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                  Temperatura *
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "Quente", emoji: "🔥", base: "border-red-500/40 bg-red-500/10 text-red-300", on: "border-red-500 bg-red-500/20 text-red-200 ring-2 ring-red-500/40" },
                    { id: "Morno", emoji: "🌤️", base: "border-amber-500/40 bg-amber-500/10 text-amber-300", on: "border-amber-500 bg-amber-500/20 text-amber-200 ring-2 ring-amber-500/40" },
                    { id: "Frio", emoji: "❄️", base: "border-sky-500/40 bg-sky-500/10 text-sky-300", on: "border-sky-500 bg-sky-500/20 text-sky-200 ring-2 ring-sky-500/40" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("temperatura", t.id)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm font-medium transition-all",
                        form.temperatura === t.id ? t.on : `${t.base} opacity-70 hover:opacity-100`,
                      )}
                    >
                      <span className="mr-1">{t.emoji}</span>
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>

              <HoverEditField
                label="Instagram da empresa"
                value={form.instagram ?? ""}
                onChange={(v) => set("instagram", v)}
              />
              <HoverEditField
                label="Site da empresa"
                value={form.site ?? ""}
                onChange={(v) => set("site", v)}
              />

              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-2">
                  Detalhes da qualificação *
                </p>
                <Textarea
                  rows={8}
                  value={form.qualificacao ?? ""}
                  onChange={(e) => set("qualificacao", e.target.value)}
                  placeholder="Ex.: Dor principal — gerar leads B2B. Faturamento ~R$ 800k/mês. Já testou Meta Ads sem ROI. Decisor: CEO. Urgência alta, quer começar em 30 dias."
                  className="text-sm resize-none"
                />
              </div>
            </div>
          </TabsContent>

          {/* TAB: Informações da Reunião */}
          <TabsContent value="reuniao" className="mt-4">
            <div className="px-4 py-4 border border-border/40 rounded-lg bg-muted/10 space-y-4">
              {(!form.qualificacao?.trim() || !form.temperatura) && (
                <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Preencha a <strong>qualificação</strong> e a <strong>temperatura</strong> do lead na aba Qualificação antes de criar o invite.
                  </span>
                </div>
              )}

              {/* Data + Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1 block">
                    Data da reunião
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-9 w-full justify-start text-left font-normal text-sm",
                          !form.data_reuniao_agendada && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.data_reuniao_agendada
                          ? format(new Date(form.data_reuniao_agendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={form.data_reuniao_agendada ? new Date(form.data_reuniao_agendada) : undefined}
                        onSelect={(d) => {
                          if (!d) {
                            set("data_reuniao_agendada", null);
                            return;
                          }
                          const existing = form.data_reuniao_agendada
                            ? new Date(form.data_reuniao_agendada)
                            : null;
                          const hh = existing ? existing.getHours() : 10;
                          const mm = existing ? existing.getMinutes() : 0;
                          const newDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm);
                          set("data_reuniao_agendada", newDate.toISOString());
                        }}
                        initialFocus
                        locale={ptBR}
                        defaultMonth={form.data_reuniao_agendada ? new Date(form.data_reuniao_agendada) : new Date()}
                        fromYear={new Date().getFullYear() - 1}
                        toYear={new Date().getFullYear() + 3}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1 block">
                    Hora
                  </label>
                  <Input
                    type="time"
                    value={
                      form.data_reuniao_agendada
                        ? (() => {
                            const dt = new Date(form.data_reuniao_agendada);
                            return `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
                          })()
                        : ""
                    }
                    onChange={(e) => {
                      const timeStr = e.target.value;
                      if (!timeStr) return;
                      const [hh, mm] = timeStr.split(":").map(Number);
                      const base = form.data_reuniao_agendada
                        ? new Date(form.data_reuniao_agendada)
                        : new Date();
                      base.setHours(hh, mm, 0, 0);
                      set("data_reuniao_agendada", base.toISOString());
                    }}
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Closer */}
              <div>
                <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1 block">
                  Closer responsável
                </label>
                <Select value={closerId} onValueChange={setCloserId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione o closer" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name || p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Convidados adicionais */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                    Convidados adicionais
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      setExtraAttendees((arr) => [...arr, { email: "", nome: "", funcao: "" }])
                    }
                  >
                    <UserPlus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {extraAttendees.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/70 italic">
                    Nenhum convidado extra. Adicione para incluir no invite e nas notas.
                  </p>
                )}
                {extraAttendees.map((a, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                    <Input
                      placeholder="Nome"
                      value={a.nome}
                      onChange={(e) =>
                        setExtraAttendees((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x))
                        )
                      }
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Função"
                      value={a.funcao}
                      onChange={(e) =>
                        setExtraAttendees((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, funcao: e.target.value } : x))
                        )
                      }
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="email@empresa.com"
                      type="email"
                      value={a.email}
                      onChange={(e) =>
                        setExtraAttendees((arr) =>
                          arr.map((x, i) => (i === idx ? { ...x, email: e.target.value } : x))
                        )
                      }
                      className="h-8 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setExtraAttendees((arr) => arr.filter((_, i) => i !== idx))}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Avisos / Estado do Google */}
              {(!form.data_reuniao_agendada || !form.email) ? (
                <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Preencha {!form.email && "e-mail do lead"}
                    {!form.email && !form.data_reuniao_agendada && " e "}
                    {!form.data_reuniao_agendada && "data da reunião"} para criar o invite no Google Calendar.
                  </span>
                </div>
              ) : googleConnected === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão…
                </div>
              ) : !googleConnected ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Conecte seu Google Calendar para criar o evento e enviar o convite automaticamente para o lead.
                  </p>
                  <Button size="sm" variant="outline" onClick={connectGoogle} disabled={googleLoading}>
                    {googleLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Calendar className="h-4 w-4 mr-1" />}
                    Conectar Google Calendar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.google_event_id && (
                    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/10">
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span className="text-foreground">Evento criado · convite enviado para {form.email}</span>
                      </div>
                      {form.google_event_link && (
                        <a
                          href={form.google_event_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Conectado como <span className="text-foreground">{emailGoogle}</span>.
                    {form.google_event_id
                      ? " Adicione novos convidados acima e clique em Atualizar invite para reenviar."
                      : " O lead receberá um convite com link do Google Meet."}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          const validExtras = extraAttendees.filter(
                            (a) => a.email.trim() && /\S+@\S+\.\S+/.test(a.email)
                          );
                          const res = await createGoogleEvent(form.id, {
                            closerId: closerId || null,
                            extraAttendees: validExtras,
                          });
                          setForm((p: any) => ({
                            ...p,
                            google_event_id: res.event_id,
                            google_event_link: res.event_link,
                          }));
                          setExtraAttendees([]);
                          toast({
                            title: form.google_event_id ? "Invite atualizado!" : "Evento criado!",
                            description: `Convite enviado para ${form.email}`,
                          });
                        } catch (e: any) {
                          toast({
                            title: "Falha ao processar invite",
                            description: e?.message ?? String(e),
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={googleLoading}
                    >
                      {googleLoading ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : form.google_event_id ? (
                        <RefreshCw className="h-4 w-4 mr-1" />
                      ) : (
                        <Calendar className="h-4 w-4 mr-1" />
                      )}
                      {form.google_event_id ? "Atualizar invite" : "Criar evento no Google Calendar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={disconnectGoogle} disabled={googleLoading}>
                      Desconectar
                    </Button>
                  </div>
                </div>
              )}

              {form.etapa !== "reuniao_agendada" && (
                <p className="text-[11px] text-muted-foreground/70 italic">
                  Mova o lead para "Reunião agendada" para ativar a criação do evento.
                </p>
              )}
            </div>
          </TabsContent>

          {/* TAB: Histórico (notas + tarefas + log) */}
          <TabsContent value="historico" className="mt-4">
            {form.id && (
              <LeadTimeline
                leadId={form.id}
                tarefaDialogOpen={tarefaDialogOpen}
                onTarefaDialogOpenChange={setTarefaDialogOpen}
              />
            )}
          </TabsContent>
        </Tabs>

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
