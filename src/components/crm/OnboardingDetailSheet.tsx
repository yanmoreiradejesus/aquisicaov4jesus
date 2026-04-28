import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, Building2, ExternalLink, Sparkles, FileText, Copy, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ONBOARDING_ETAPAS } from "@/hooks/useOnboarding";
import ReactMarkdown from "react-markdown";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: any | null;
  onSave: (acc: any) => Promise<void>;
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

const CATEGORIA_PRODUTOS_LABEL: Record<string, string> = {
  saber: "Saber",
  ter: "Ter",
  executar: "Executar",
  potencializar: "Potencializar",
};

export const OnboardingDetailSheet = ({ open, onOpenChange, account, onSave }: Props) => {
  const [form, setForm] = useState<any>(null);
  const [responsaveis, setResponsaveis] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

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
      // Busca atividades da oportunidade e do lead para enriquecer o contexto
      let atividades: any[] = [];
      if (op?.id) {
        const { data } = await supabase
          .from("crm_atividades" as any)
          .select("tipo, descricao, titulo, data_agendada, data_conclusao, concluida, created_at")
          .or(`oportunidade_id.eq.${op.id}${lead?.id ? `,lead_id.eq.${lead.id}` : ""}`)
          .order("created_at", { ascending: true })
          .limit(80);
        atividades = (data as any[]) ?? [];
      }

      const contexto = {
        cliente: {
          nome: form.cliente_nome,
          data_inicio_contrato: form.data_inicio_contrato,
          data_fim_contrato: form.data_fim_contrato,
          status: form.status,
        },
        lead: lead
          ? {
              nome: lead.nome,
              email: lead.email,
              telefone: lead.telefone,
              empresa: lead.empresa,
              cargo: lead.cargo,
              segmento: lead.segmento,
              faturamento: lead.faturamento,
              cidade: lead.cidade,
              estado: lead.estado,
              pais: lead.pais,
              origem: lead.origem,
              canal: lead.canal,
              tier: lead.tier,
              urgencia: lead.urgencia,
              temperatura: lead.temperatura,
              qualificacao: lead.qualificacao,
              arrematador: lead.arrematador,
              data_aquisicao: lead.data_aquisicao,
              data_criacao_origem: lead.data_criacao_origem,
              created_at: lead.created_at,
              descricao: lead.descricao,
              notas: lead.notas,
              instagram: lead.instagram,
              site: lead.site,
              briefing_mercado: lead.briefing_mercado,
              pesquisa_pre_qualificacao: lead.pesquisa_pre_qualificacao,
              data_reuniao_agendada: lead.data_reuniao_agendada,
              data_reuniao_realizada: lead.data_reuniao_realizada,
            }
          : null,
        oportunidade: op
          ? {
              nome: op.nome_oportunidade,
              etapa: op.etapa,
              temperatura: op.temperatura,
              valor_fee: op.valor_fee,
              valor_ef: op.valor_ef,
              valor_total: (Number(op.valor_ef) || 0) + (Number(op.valor_fee) || 0),
              data_proposta: op.data_proposta,
              data_fechamento_real: op.data_fechamento_real,
              categoria_produtos: op.nivel_consciencia
                ? CATEGORIA_PRODUTOS_LABEL[op.nivel_consciencia]
                : null,
              info_deal: op.info_deal,
              oportunidades_monetizacao: op.oportunidades_monetizacao,
              resumo_reuniao: op.resumo_reuniao,
              transcricao_reuniao: op.transcricao_reuniao,
              notas: op.notas,
              motivo_perda: op.motivo_perda,
            }
          : null,
        atividades: atividades.map((a) => ({
          tipo: a.tipo,
          titulo: a.titulo,
          descricao: a.descricao,
          data: a.data_agendada || a.created_at,
          concluida: a.concluida,
        })),
      };

      const { data, error } = await supabase.functions.invoke("meeting-ai", {
        body: { action: "pre_growth_class", contexto },
      });
      if (error) throw error;
      const relatorio = (data as any)?.relatorio as string | undefined;
      if (!relatorio) throw new Error("Resposta vazia da IA");

      const agora = new Date().toISOString();
      update({
        pre_growth_class_relatorio: relatorio,
        pre_growth_class_gerado_em: agora,
      });
      toast({ title: "Relatório gerado", description: "Revise e clique em Salvar para persistir." });
    } catch (e: any) {
      toast({
        title: "Erro ao gerar relatório",
        description: e?.message || "Falha ao chamar a IA",
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="text-left space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            <Building2 className="h-3 w-3" /> Contrato em Onboarding
          </div>
          <SheetTitle className="font-display text-2xl tracking-[-0.01em]">
            {form.cliente_nome}
          </SheetTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{lead?.empresa || lead?.nome}</span>
            {valorTotal > 0 && <span className="font-semibold text-foreground/80">{fmtBRL(valorTotal)}</span>}
            {op?.id && (
              <a
                href={`/comercial/oportunidades?id=${op.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Ver oportunidade <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </SheetHeader>

        <Tabs defaultValue="growth" className="mt-6">
          <TabsList>
            <TabsTrigger value="growth">
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" /> Growth Class
            </TabsTrigger>
            <TabsTrigger value="pre-gc">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Pré GC (IA)
            </TabsTrigger>
            <TabsTrigger value="info">Contrato</TabsTrigger>
          </TabsList>

          <TabsContent value="growth" className="space-y-4 mt-4">
            <div>
              <Label>Status do Onboarding</Label>
              <Select
                value={form.onboarding_status}
                onValueChange={(v) => update({ onboarding_status: v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ONBOARDING_ETAPAS.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Data agendada</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(form.growth_class_data_agendada)}
                  onChange={(e) => update({ growth_class_data_agendada: fromLocalInput(e.target.value) })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Data realizada</Label>
                <Input
                  type="datetime-local"
                  value={toLocalInput(form.growth_class_data_realizada)}
                  onChange={(e) => update({ growth_class_data_realizada: fromLocalInput(e.target.value) })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>Responsável pela reunião</Label>
              <Select
                value={form.growth_class_responsavel_id ?? "none"}
                onValueChange={(v) => update({ growth_class_responsavel_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {responsaveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Link da reunião (Google Meet)</Label>
              <Input
                type="url"
                placeholder="https://meet.google.com/..."
                value={form.growth_class_meet_link ?? ""}
                onChange={(e) => update({ growth_class_meet_link: e.target.value })}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Expectativas alinhadas</Label>
              <Textarea
                placeholder="O que o cliente espera, o que foi balizado..."
                value={form.growth_class_expectativas ?? ""}
                onChange={(e) => update({ growth_class_expectativas: e.target.value })}
                className="mt-1.5 min-h-[90px]"
              />
            </div>

            <div>
              <Label>Ata / Resumo da reunião</Label>
              <Textarea
                placeholder="Pontos discutidos, decisões tomadas..."
                value={form.growth_class_ata ?? ""}
                onChange={(e) => update({ growth_class_ata: e.target.value })}
                className="mt-1.5 min-h-[110px]"
              />
            </div>

            <div>
              <Label>Próximos passos</Label>
              <Textarea
                placeholder="Ações a serem executadas após a Growth Class..."
                value={form.growth_class_proximos_passos ?? ""}
                onChange={(e) => update({ growth_class_proximos_passos: e.target.value })}
                className="mt-1.5 min-h-[90px]"
              />
            </div>

            <div>
              <Label>Oportunidades de monetização</Label>
              <Textarea
                placeholder="Possíveis upsells, cross-sells, novas frentes..."
                value={form.growth_class_oportunidades_monetizacao ?? ""}
                onChange={(e) => update({ growth_class_oportunidades_monetizacao: e.target.value })}
                className="mt-1.5 min-h-[90px]"
              />
            </div>
          </TabsContent>

          <TabsContent value="pre-gc" className="space-y-4 mt-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
              <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-[12px] text-foreground/80 leading-relaxed">
                <p className="font-semibold mb-1">Relatório Pré Growth Class</p>
                <p>
                  Síntese gerada por IA com toda a história do cliente — origem, qualificação,
                  reuniões de vendas, oportunidades de monetização e agenda sugerida da GC.
                </p>
              </div>
            </div>

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
                    Regenerar relatório
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
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
                Nenhum relatório gerado ainda. Clique em <strong>Gerar relatório</strong> para
                consolidar todas as informações desde a captação do lead até o fechamento.
              </p>
            )}
          </TabsContent>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Cliente</Label>
                <Input
                  value={form.cliente_nome ?? ""}
                  onChange={(e) => update({ cliente_nome: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Status do contrato</Label>
                <Select value={form.status} onValueChange={(v) => update({ status: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="pausado">Pausado</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data início contrato</Label>
                <Input
                  type="date"
                  value={form.data_inicio_contrato ?? ""}
                  onChange={(e) => update({ data_inicio_contrato: e.target.value || null })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Data fim contrato</Label>
                <Input
                  type="date"
                  value={form.data_fim_contrato ?? ""}
                  onChange={(e) => update({ data_fim_contrato: e.target.value || null })}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div>
              <Label>Account Manager</Label>
              <Select
                value={form.account_manager_id ?? "none"}
                onValueChange={(v) => update({ account_manager_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {responsaveis.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notas</Label>
              <Textarea
                value={form.notas ?? ""}
                onChange={(e) => update({ notas: e.target.value })}
                className="mt-1.5 min-h-[100px]"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
