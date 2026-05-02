import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Building2, ExternalLink, FileText, Copy, RefreshCw, CheckCircle2, Flame, Pencil, X, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingCopilot } from "./OnboardingCopilot";
import { CopyLinkButton } from "./CopyLinkButton";
import { DetailShell } from "./DetailShell";

import ReactMarkdown from "react-markdown";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any | null;
  onSave: (acc: any) => Promise<void>;
  fullPage?: boolean;
  backTo?: string;
}

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (s: string) => (s ? new Date(s).toISOString() : null);

const fmtBRL = (v?: number | null) =>
  !v
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 0,
      }).format(Number(v));

const fmtDateTime = (iso?: string | null) =>
  !iso ? "—" : new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const fmtDate = (iso?: string | null) =>
  !iso ? "—" : new Date(iso).toLocaleDateString("pt-BR");

const CATEGORIA_PRODUTOS_LABEL: Record<string, string> = {
  saber: "Saber",
  ter: "Ter",
  executar: "Executar",
  potencializar: "Potencializar",
};

export const OnboardingDetailSheet = ({ open, onOpenChange, account, onSave, fullPage = false, backTo }: Props) => {
  const [form, setForm] = useState<any>(null);
  const [responsaveis, setResponsaveis] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [contratoSignedUrl, setContratoSignedUrl] = useState<string | null>(null);
  const [editingContrato, setEditingContrato] = useState(false);
  const [contratoForm, setContratoForm] = useState<any>(null);
  const [savingContrato, setSavingContrato] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (account) setForm({ ...account });
  }, [account]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("profiles" as any)
      .select("id, full_name, email")
      .eq("approved", true)
      .order("full_name")
      .then(({ data }) => setResponsaveis((data as any[]) ?? []));
  }, [open]);

  // Sign contrato URL when present
  useEffect(() => {
    const path = form?.oportunidade?.contrato_url;
    if (!path) {
      setContratoSignedUrl(null);
      return;
    }
    supabase.storage
      .from("contratos-assinados")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => setContratoSignedUrl(data?.signedUrl ?? null));
  }, [form?.oportunidade?.contrato_url]);

  if (!form) return null;

  const op = form.oportunidade;
  const lead = op?.lead;
  const valorTotal = (Number(op?.valor_ef) || 0) + (Number(op?.valor_fee) || 0);

  const update = (patch: Partial<typeof form>) => setForm((prev: any) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
      toast({ title: "Onboarding atualizado" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGerarRelatorio = async () => {
    setGenerating(true);
    try {
      // Roteia pela edge function única que carrega tudo (incl. extração do PDF do contrato)
      const { error } = await supabase.functions.invoke("auto-generate-pre-gc", {
        body: { account_id: form.id, force: true },
      });
      if (error) throw error;

      // Recarrega o relatório atualizado
      const { data: updated, error: selErr } = await supabase
        .from("accounts" as any)
        .select("pre_growth_class_relatorio, pre_growth_class_gerado_em")
        .eq("id", form.id)
        .maybeSingle();
      if (selErr) throw selErr;

      update({
        pre_growth_class_relatorio: (updated as any)?.pre_growth_class_relatorio ?? null,
        pre_growth_class_gerado_em: (updated as any)?.pre_growth_class_gerado_em ?? null,
      });
      toast({ title: "Relatório gerado e salvo" });
    } catch (e: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: e?.message || "Falha ao gerar",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyRelatorio = async () => {
    if (!form.pre_growth_class_relatorio) return;
    try {
      await navigator.clipboard.writeText(form.pre_growth_class_relatorio);
      toast({ title: "Relatório copiado" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  return (
    <DetailShell
      fullPage={fullPage}
      open={open}
      onOpenChange={onOpenChange}
      backTo={backTo}
      contentClassName={fullPage ? "" : "w-full sm:max-w-2xl overflow-y-auto"}
    >
        {(() => {
          const HeaderEl: any = fullPage ? "div" : SheetHeader;
          const TitleEl: any = fullPage ? "h2" : SheetTitle;
          return (
            <HeaderEl className={fullPage ? "flex flex-col text-left space-y-2" : "text-left space-y-2"}>
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                <Building2 className="h-3 w-3" /> Contrato em Onboarding
              </div>
              <div className="flex items-start justify-between gap-2 pr-10">
                <TitleEl className={fullPage ? "font-display text-2xl tracking-[-0.01em] text-foreground" : "font-display text-2xl tracking-[-0.01em]"}>
                  {form.cliente_nome}
                </TitleEl>
                {form.id && <CopyLinkButton path={`/comercial/onboarding/${form.id}`} className="mt-1" />}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{lead?.empresa || lead?.nome}</span>
                {valorTotal > 0 && <span className="font-semibold text-foreground/80">{fmtBRL(valorTotal)}</span>}
                {op?.id && (
                  <a
                    href={`/comercial/oportunidades/${op.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Ver oportunidade <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </HeaderEl>
          );
        })()}

        <Tabs defaultValue="pre-gc" className="mt-6">
          <TabsList>
            <TabsTrigger value="pre-gc">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Pré GC
            </TabsTrigger>
            <TabsTrigger value="growth">
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Growth Class
            </TabsTrigger>
            <TabsTrigger value="copilot">
              <Flame className="h-3.5 w-3.5 mr-1.5" /> Copilot
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pre-gc" className="space-y-5 mt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleGerarRelatorio}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Gerando...
                  </>
                ) : form.pre_growth_class_relatorio ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Regenerar
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Gerar relatório
                  </>
                )}
              </Button>
              {form.pre_growth_class_relatorio && (
                <Button size="sm" variant="ghost" onClick={handleCopyRelatorio}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copiar
                </Button>
              )}
              {form.pre_growth_class_gerado_em && (
                <span className="text-[11px] text-muted-foreground ml-auto">
                  Gerado em {fmtDateTime(form.pre_growth_class_gerado_em)}
                </span>
              )}
            </div>

            {form.pre_growth_class_relatorio ? (
              <div className="rounded-lg border border-border/40 bg-background/40 p-4 prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:tracking-[-0.01em] prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2 prose-h3:text-sm prose-p:text-[13px] prose-li:text-[13px] prose-strong:text-foreground prose-a:text-primary">
                <ReactMarkdown>{form.pre_growth_class_relatorio}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Relatório ainda em geração ou pendente. Clique em <strong>Gerar relatório</strong> caso não apareça em alguns instantes.
              </p>
            )}

            {/* Anexos: contrato + informações gerais */}
            <div className="space-y-3 pt-4 border-t border-border/40">
              <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground/90">
                Contrato & Informações Gerais
              </h3>

              <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Contrato assinado</span>
                  {contratoSignedUrl ? (
                    <a
                      href={contratoSignedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                    >
                      Abrir PDF <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-foreground/60">—</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Categoria de produtos</span>
                  <span className="text-foreground/90 font-medium">
                    {op?.nivel_consciencia ? CATEGORIA_PRODUTOS_LABEL[op.nivel_consciencia] : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Valor Fee mensal</span>
                  <span className="text-foreground/90 font-medium tabular-nums">{fmtBRL(op?.valor_fee)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Valor EF</span>
                  <span className="text-foreground/90 font-medium tabular-nums">{fmtBRL(op?.valor_ef)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Valor total</span>
                  <span className="text-foreground/90 font-semibold tabular-nums">{fmtBRL(valorTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Início do contrato</span>
                  <span className="text-foreground/90 font-medium tabular-nums">{fmtDate(form.data_inicio_contrato)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Fim do contrato</span>
                  <span className="text-foreground/90 font-medium tabular-nums">{fmtDate(form.data_fim_contrato)}</span>
                </div>
              </div>

              {op?.info_deal && (
                <div>
                  <Label className="text-xs text-muted-foreground">Informações do deal</Label>
                  <div className="mt-1.5 rounded-lg border border-border/40 bg-background/40 p-3 text-[13px] text-foreground/85 whitespace-pre-wrap">
                    {op.info_deal}
                  </div>
                </div>
              )}

              {op?.oportunidades_monetizacao && (
                <div>
                  <Label className="text-xs text-muted-foreground">Oportunidades de monetização (mapeadas no fechamento)</Label>
                  <div className="mt-1.5 rounded-lg border border-border/40 bg-background/40 p-3 text-[13px] text-foreground/85 whitespace-pre-wrap">
                    {op.oportunidades_monetizacao}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="growth" className="space-y-4 mt-4">
            <div>
              <Label>Expectativa do cliente</Label>
              <Textarea
                placeholder="O que o cliente espera, o que foi alinhado..."
                value={form.growth_class_expectativas ?? ""}
                onChange={(e) => update({ growth_class_expectativas: e.target.value })}
                className="mt-1.5 min-h-[100px]"
              />
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                placeholder="Observações livres da reunião..."
                value={form.growth_class_ata ?? ""}
                onChange={(e) => update({ growth_class_ata: e.target.value })}
                className="mt-1.5 min-h-[100px]"
              />
            </div>

            <div>
              <Label>Transcrição da reunião</Label>
              <Textarea
                placeholder="Cole aqui a transcrição completa da Growth Class..."
                value={form.growth_class_transcricao_reuniao ?? ""}
                onChange={(e) => update({ growth_class_transcricao_reuniao: e.target.value })}
                className="mt-1.5 min-h-[180px] font-mono text-xs"
              />
            </div>

            {form.onboarding_status !== "concluida" && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="w-full border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                  onClick={() => update({ onboarding_status: "concluida", growth_class_data_realizada: new Date().toISOString() })}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Marcar Growth Class como concluída
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  Lembre-se de clicar em <strong>Salvar</strong> para persistir.
                </p>
              </div>
            )}
            {form.onboarding_status === "concluida" && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-[13px] text-emerald-300 font-medium inline-flex items-center justify-center gap-2 w-full">
                <CheckCircle2 className="h-4 w-4" />
                Growth Class concluída
              </div>
            )}
          </TabsContent>

          <TabsContent value="copilot" className="mt-4">
            <OnboardingCopilot accountId={form.id} />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
    </DetailShell>
  );
};
