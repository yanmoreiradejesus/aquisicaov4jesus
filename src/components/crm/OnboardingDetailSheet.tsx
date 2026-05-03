import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Building2, ExternalLink, FileText, Copy, RefreshCw, CheckCircle2, Flame, Pencil, X, Save, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  const [divergence, setDivergence] = useState<{
    status: "idle" | "loading" | "ok" | "error" | "no_contract" | "extract_failed";
    has_divergence?: boolean;
    divergences?: { campo: string; valor_sistema: string; valor_contrato: string; observacao: string }[];
    valores_contrato?: {
      valor_fee: number | null;
      valor_ef: number | null;
      data_inicio: string | null;
      categoria_produtos: string | null;
    } | null;
    resumo?: string;
    error?: string;
    cached?: boolean;
  }>({ status: "idle" });
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

  const runDivergenceCheck = async (force = false) => {
    if (!form?.id) return;
    setDivergence({ status: "loading" });
    try {
      const { data, error } = await supabase.functions.invoke("validate-contract-divergence", {
        body: { account_id: form.id, force },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDivergence({
        status: data?.status === "no_contract" ? "no_contract" : data?.status === "extract_failed" ? "extract_failed" : "ok",
        has_divergence: !!data?.has_divergence,
        divergences: data?.divergences ?? [],
        valores_contrato: data?.valores_contrato ?? null,
        resumo: data?.resumo ?? "",
        cached: !!data?.cached,
      });
      // Atualiza o form local para refletir o cache salvo
      if (force || !form.contract_validation) {
        setForm((prev: any) => ({
          ...prev,
          contract_validation: {
            has_divergence: !!data?.has_divergence,
            divergences: data?.divergences ?? [],
            valores_contrato: data?.valores_contrato ?? null,
            resumo: data?.resumo ?? "",
            validated_at: data?.validated_at,
          },
          contract_validation_at: data?.validated_at,
          contract_validation_url: prev?.oportunidade?.contrato_url,
        }));
      }
    } catch (e: any) {
      setDivergence({ status: "error", error: e?.message || "Falha ao validar" });
    }
  };

  // Hidrata estado de divergência a partir do cache salvo no banco
  useEffect(() => {
    if (!form?.id) return;
    const cached = form?.contract_validation;
    const cachedUrl = form?.contract_validation_url;
    const currentUrl = form?.oportunidade?.contrato_url;
    if (cached && cachedUrl && cachedUrl === currentUrl) {
      setDivergence({
        status: "ok",
        has_divergence: !!cached.has_divergence,
        divergences: cached.divergences ?? [],
        valores_contrato: cached.valores_contrato ?? null,
        resumo: cached.resumo ?? "",
        cached: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id]);

  // Roda validação automaticamente apenas quando NÃO há cache válido
  useEffect(() => {
    if (!open || !form?.id) return;
    if (!form?.oportunidade?.contrato_url) return;
    if (divergence.status !== "idle") return;
    const cached = form?.contract_validation;
    const cachedUrl = form?.contract_validation_url;
    if (cached && cachedUrl === form.oportunidade.contrato_url) return;
    runDivergenceCheck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form?.id, form?.oportunidade?.contrato_url]);

  // Reseta validação quando muda de account
  useEffect(() => {
    setDivergence({ status: "idle" });
  }, [account?.id]);

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

  const startEditContrato = () => {
    // Campos com divergência detectada pela IA: pré-preenche com o valor do CONTRATO.
    const divergentes = new Set(
      divergence.has_divergence ? (divergence.divergences ?? []).map((d) => d.campo) : []
    );
    const sugeridos = divergence.valores_contrato ?? null;
    const pick = <T,>(campo: string, sugerido: T | null | undefined, atual: T): T => {
      if (divergentes.has(campo) && sugerido !== null && sugerido !== undefined && sugerido !== ("" as any)) {
        return sugerido as T;
      }
      return atual;
    };
    setContratoForm({
      nivel_consciencia: pick("categoria_produtos", sugeridos?.categoria_produtos, op?.nivel_consciencia ?? ""),
      valor_fee: pick("valor_fee", sugeridos?.valor_fee, op?.valor_fee ?? 0),
      valor_ef: pick("valor_ef", sugeridos?.valor_ef, op?.valor_ef ?? 0),
      info_deal: op?.info_deal ?? "",
      data_inicio_contrato: pick("data_inicio", sugeridos?.data_inicio, form.data_inicio_contrato ?? ""),
      data_fim_contrato: form.data_fim_contrato ?? "",
    });
    setEditingContrato(true);
  };

  const cancelEditContrato = () => {
    setEditingContrato(false);
    setContratoForm(null);
  };

  const handleSaveContrato = async () => {
    if (!op?.id || !contratoForm) return;
    setSavingContrato(true);
    try {
      const changed: string[] = [];
      const opPatch: any = {};
      if ((op.nivel_consciencia ?? "") !== contratoForm.nivel_consciencia) {
        opPatch.nivel_consciencia = contratoForm.nivel_consciencia || null;
        changed.push("Categoria de produtos");
      }
      const newFee = Number(contratoForm.valor_fee) || 0;
      const newEf = Number(contratoForm.valor_ef) || 0;
      const oldFee = Number(op.valor_fee) || 0;
      const oldEf = Number(op.valor_ef) || 0;
      if (newFee !== oldFee) {
        opPatch.valor_fee = newFee;
        changed.push("Valor Fee");
      }
      if (newEf !== oldEf) {
        opPatch.valor_ef = newEf;
        changed.push("Valor EF");
      }
      if ((op.info_deal ?? "") !== (contratoForm.info_deal ?? "")) {
        opPatch.info_deal = contratoForm.info_deal || null;
        changed.push("Informações do deal");
      }

      const accPatch: any = {};
      if ((form.data_inicio_contrato ?? "") !== (contratoForm.data_inicio_contrato ?? "")) {
        accPatch.data_inicio_contrato = contratoForm.data_inicio_contrato || null;
        changed.push("Início do contrato");
      }
      if ((form.data_fim_contrato ?? "") !== (contratoForm.data_fim_contrato ?? "")) {
        accPatch.data_fim_contrato = contratoForm.data_fim_contrato || null;
        changed.push("Fim do contrato");
      }

      if (changed.length === 0) {
        toast({ title: "Nada para atualizar" });
        setEditingContrato(false);
        setSavingContrato(false);
        return;
      }

      // 1. Update oportunidade
      if (Object.keys(opPatch).length > 0) {
        const { error } = await supabase
          .from("crm_oportunidades" as any)
          .update(opPatch)
          .eq("id", op.id);
        if (error) throw error;
      }

      // 2. Update account
      if (Object.keys(accPatch).length > 0) {
        const { error } = await supabase
          .from("accounts" as any)
          .update(accPatch)
          .eq("id", form.id);
        if (error) throw error;
      }

      // 3. Recalcular cobranças pendentes
      let cobrancasAtualizadas = 0;
      if (newEf !== oldEf) {
        const { data, error } = await supabase
          .from("cobrancas" as any)
          .update({ valor: newEf })
          .eq("oportunidade_id", op.id)
          .eq("tipo", "ef")
          .eq("status", "pendente")
          .select("id");
        if (error) throw error;
        cobrancasAtualizadas += (data as any[])?.length ?? 0;
      }
      if (newFee !== oldFee) {
        const { data, error } = await supabase
          .from("cobrancas" as any)
          .update({ valor: newFee })
          .eq("oportunidade_id", op.id)
          .eq("tipo", "fee_recorrente")
          .eq("status", "pendente")
          .select("id");
        if (error) throw error;
        cobrancasAtualizadas += (data as any[])?.length ?? 0;
      }

      // 4. Log de auditoria
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("crm_atividades" as any).insert({
        oportunidade_id: op.id,
        lead_id: op.lead_id ?? null,
        tipo: "observacao",
        titulo: "Contrato ajustado no Pré GC",
        descricao: `Campos alterados: ${changed.join(", ")}.${
          cobrancasAtualizadas > 0 ? ` ${cobrancasAtualizadas} cobrança(s) pendente(s) recalculada(s).` : ""
        }`,
        usuario_id: userData.user?.id ?? null,
      });

      // 5. Atualiza form local + invalida queries
      setForm((prev: any) => ({
        ...prev,
        ...accPatch,
        oportunidade: { ...prev.oportunidade, ...opPatch },
      }));
      qc.invalidateQueries({ queryKey: ["onboarding_accounts"] });
      qc.invalidateQueries({ queryKey: ["crm_oportunidades"] });
      qc.invalidateQueries({ queryKey: ["cobrancas"] });

      toast({
        title: "Contrato atualizado",
        description: `${changed.join(", ")}${
          cobrancasAtualizadas > 0 ? ` · ${cobrancasAtualizadas} cobrança(s) pendente(s) recalculada(s)` : ""
        }`,
      });
      setEditingContrato(false);
      setContratoForm(null);
      // Revalida divergência com os novos dados
      setDivergence({ status: "idle" });
      setTimeout(() => runDivergenceCheck(true), 300);
    } catch (e: any) {
      toast({ title: "Erro ao atualizar contrato", description: e.message, variant: "destructive" });
    } finally {
      setSavingContrato(false);
    }
  };

  const canEditContrato = form.onboarding_status !== "concluida";

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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-semibold tracking-[-0.01em] text-foreground/90">
                    Contrato & Informações Gerais
                  </h3>
                  {divergence.status === "loading" && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Validando…
                    </span>
                  )}
                  {divergence.status === "ok" && divergence.has_divergence && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> Divergência
                    </span>
                  )}
                  {divergence.status === "ok" && !divergence.has_divergence && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                      <ShieldCheck className="h-3 w-3" /> Conferido
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {!editingContrato && form?.oportunidade?.contrato_url && (
                    <Button size="sm" variant="ghost" onClick={() => runDivergenceCheck(true)} disabled={divergence.status === "loading"}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${divergence.status === "loading" ? "animate-spin" : ""}`} />
                      Revalidar
                    </Button>
                  )}
                  {!editingContrato && canEditContrato && (
                    <Button
                      size="sm"
                      variant={divergence.status === "ok" && divergence.has_divergence ? "default" : "ghost"}
                      onClick={startEditContrato}
                      className={divergence.status === "ok" && divergence.has_divergence ? "bg-amber-500/90 hover:bg-amber-500 text-amber-950" : ""}
                    >
                      {divergence.status === "ok" && divergence.has_divergence ? (
                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                      ) : (
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Editar contrato
                    </Button>
                  )}
                  {editingContrato && (
                    <>
                      <Button size="sm" variant="ghost" onClick={cancelEditContrato} disabled={savingContrato}>
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveContrato} disabled={savingContrato}>
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                        {savingContrato ? "Salvando..." : "Salvar"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {divergence.status === "ok" && divergence.has_divergence && divergence.divergences && divergence.divergences.length > 0 && (
                <Alert className="border-amber-500/40 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <AlertTitle className="text-amber-200 text-sm">Divergência detectada entre contrato e CRM</AlertTitle>
                  <AlertDescription className="text-[12px] text-foreground/80">
                    {divergence.resumo && <p className="mb-2">{divergence.resumo}</p>}
                    <ul className="space-y-1.5">
                      {divergence.divergences.map((d, i) => (
                        <li key={i} className="leading-snug">
                          <span className="font-semibold text-amber-200">
                            {{
                              valor_fee: "Valor Fee",
                              valor_ef: "Valor EF",
                              data_inicio: "Início do contrato",
                              data_fim: "Fim do contrato",
                              categoria_produtos: "Categoria de produtos",
                            }[d.campo] || d.campo}:
                          </span>{" "}
                          CRM = <span className="tabular-nums">{d.valor_sistema || "—"}</span> · Contrato ={" "}
                          <span className="tabular-nums">{d.valor_contrato || "—"}</span>
                          {d.observacao && <span className="block text-muted-foreground text-[11px] mt-0.5">{d.observacao}</span>}
                        </li>
                      ))}
                    </ul>
                    {canEditContrato && (
                      <p className="mt-2 text-[11px] text-amber-200/80">Use <strong>Editar contrato</strong> para alinhar os dados.</p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {divergence.status === "extract_failed" && (
                <p className="text-[11px] text-muted-foreground">
                  Não foi possível extrair o PDF para validar automaticamente. Confira manualmente.
                </p>
              )}
              {divergence.status === "error" && (
                <p className="text-[11px] text-destructive">
                  Falha na validação automática: {divergence.error}
                </p>
              )}


              {!editingContrato ? (
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
              ) : (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3 text-[13px]">
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    Ajuste para refletir o contrato assinado. Cobranças ainda <strong>pendentes</strong> serão recalculadas. Cobranças já pagas não são alteradas.
                  </p>
                  {contratoSignedUrl && (
                    <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/40">
                      <span className="text-muted-foreground">Contrato assinado</span>
                      <a
                        href={contratoSignedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        Abrir PDF <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Categoria de produtos</Label>
                    <Select
                      value={contratoForm?.nivel_consciencia || ""}
                      onValueChange={(v) => setContratoForm((p: any) => ({ ...p, nivel_consciencia: v }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORIA_PRODUTOS_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor Fee mensal (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1.5"
                        value={contratoForm?.valor_fee ?? 0}
                        onChange={(e) => setContratoForm((p: any) => ({ ...p, valor_fee: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor EF (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="mt-1.5"
                        value={contratoForm?.valor_ef ?? 0}
                        onChange={(e) => setContratoForm((p: any) => ({ ...p, valor_ef: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-muted-foreground">Valor total</span>
                    <span className="text-foreground/90 font-semibold tabular-nums">
                      {fmtBRL((Number(contratoForm?.valor_ef) || 0) + (Number(contratoForm?.valor_fee) || 0))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Início do contrato</Label>
                      <Input
                        type="date"
                        className="mt-1.5"
                        value={contratoForm?.data_inicio_contrato ?? ""}
                        onChange={(e) => setContratoForm((p: any) => ({ ...p, data_inicio_contrato: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fim do contrato</Label>
                      <Input
                        type="date"
                        className="mt-1.5"
                        value={contratoForm?.data_fim_contrato ?? ""}
                        onChange={(e) => setContratoForm((p: any) => ({ ...p, data_fim_contrato: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Informações do deal</Label>
                    <Textarea
                      className="mt-1.5 min-h-[80px]"
                      value={contratoForm?.info_deal ?? ""}
                      onChange={(e) => setContratoForm((p: any) => ({ ...p, info_deal: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {!editingContrato && op?.info_deal && (
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
