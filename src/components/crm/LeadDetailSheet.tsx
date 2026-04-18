import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { Check, ChevronRight, Copy, MessageCircle, Trash2 } from "lucide-react";
import { formatPhone, whatsappNumber, locationFromPhone, timeAgo } from "@/lib/ddd";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any | null;
  onSave: (lead: any) => Promise<void> | void;
  onChangeEtapa: (id: string, etapa: string) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

export const LeadDetailSheet = ({ open, onOpenChange, lead, onSave, onChangeEtapa, onDelete }: Props) => {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) setForm(lead);
  }, [open, lead]);

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
    await onChangeEtapa(form.id, etapaId);
    setForm((p: any) => ({ ...p, etapa: etapaId }));
  };

  const handleSave = async () => {
    if (!form.nome?.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.valor_pago === "" || payload.valor_pago == null) payload.valor_pago = null;
      else payload.valor_pago = Number(payload.valor_pago);
      if (!payload.data_aquisicao) payload.data_aquisicao = null;
      if (!payload.data_criacao_origem) payload.data_criacao_origem = null;
      await onSave(payload);
      toast({ title: "Lead atualizado" });
      onOpenChange(false);
    } finally {
      setSaving(false);
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
        <div className="bg-muted/20 border border-border/40 rounded-lg p-4 mb-6 space-y-3">
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
              📍 {loc.cidade} / {loc.estado} <span className="opacity-60">(via DDD)</span>
            </p>
          )}
        </div>

        {/* DETALHES editáveis */}
        <div className="space-y-4">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
            Detalhes
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value={form.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Faturamento</Label>
              <Input value={form.faturamento ?? ""} onChange={(e) => set("faturamento", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Segmento</Label>
              <Input value={form.segmento ?? ""} onChange={(e) => set("segmento", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Input value={form.canal ?? ""} onChange={(e) => set("canal", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tier</Label>
              <Select value={form.tier ?? ""} onValueChange={(v) => set("tier", v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_pago ?? ""}
                onChange={(e) => set("valor_pago", e.target.value)}
              />
            </div>
            {form.etapa === "desqualificado" && (
              <div className="space-y-1.5 md:col-span-2">
                <Label>Motivo da desqualificação</Label>
                <Input value={form.motivo_desqualificacao ?? ""} onChange={(e) => set("motivo_desqualificacao", e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Notas internas</Label>
              <Textarea rows={3} value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          {form.id && onDelete && (
            <Button
              variant="outline"
              onClick={() => { onDelete(form.id); onOpenChange(false); }}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.nome?.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
