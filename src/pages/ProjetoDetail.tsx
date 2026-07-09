import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Plus, Trash2, Upload, Download, Loader2, Save, FileText, Circle, CheckCircle2, AlertCircle, DollarSign, Rocket, Flag, MessageSquare, Paperclip, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useProjeto, type KpiAlvo, type StackItem, type LinkItem, type TimeMember } from "@/hooks/useProjeto";
import { useProjetoAnexos, type AnexoRow } from "@/hooks/useProjetoAnexos";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { PROJETO_STATUS_LABEL, PROJETO_STATUS_COLOR, type ProjetoStatus } from "@/hooks/useProjetos";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";

const fmtBRL = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v));
const fmtDate = (v?: string | null) => (!v ? "—" : new Date(v).toLocaleDateString("pt-BR"));
const fmtBytes = (n?: number | null) => {
  if (!n) return "—";
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const STATUS_OPTS: ProjetoStatus[] = ["ativo", "em_risco", "pausado", "encerrado", "churn"];

const ProjetoDetail = () => {
  const { projetoId } = useParams<{ projetoId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: projeto, isLoading, update } = useProjeto(projetoId);
  const anexos = useProjetoAnexos(projetoId, projeto?.tenant_id);
  const { profiles } = useProfilesList();

  const [local, setLocal] = useState<any>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<any>(null);

  useEffect(() => {
    if (projeto) setLocal(projeto);
  }, [projeto?.id]); // eslint-disable-line

  useEffect(() => {
    if (!local || !projeto) return;
    const patch: any = {};
    const keys = ["nome", "status_projeto", "descricao", "objetivos", "kpis_alvo", "prazo_inicio", "prazo_fim", "stack", "links", "time", "documentacao"];
    for (const k of keys) {
      if (JSON.stringify(local[k]) !== JSON.stringify((projeto as any)[k])) patch[k] = local[k];
    }
    if (Object.keys(patch).length === 0) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await update.mutateAsync(patch);
        setSavedAt(Date.now());
      } catch (e: any) {
        toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [local]); // eslint-disable-line

  const amProfile = useMemo(() => {
    const id = local?.account?.account_manager_id;
    return id ? profiles.find((p) => p.id === id) : null;
  }, [local, profiles]);

  if (isLoading || !local) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/comercial/projetos")}>Voltar</Button>
      </div>
    );
  }

  const patch = (p: any) => setLocal((v: any) => ({ ...v, ...p }));

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full max-w-6xl mx-auto px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/comercial/projetos")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Projetos
          </Button>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {saving ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</>
            ) : savedAt ? (
              <><Save className="h-3 w-3" /> Salvo</>
            ) : null}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 mb-6 shadow-ios-sm">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-1">Projeto</p>
              <Input
                value={local.nome ?? ""}
                onChange={(e) => patch({ nome: e.target.value })}
                className="font-display text-2xl font-semibold border-none px-0 h-auto bg-transparent focus-visible:ring-0"
              />
              <p className="text-sm text-muted-foreground mt-1">
                Cliente: <span className="text-foreground">{local.account?.cliente_nome ?? "—"}</span>
                {amProfile && <> · AM: <span className="text-foreground">{profileLabel(amProfile)}</span></>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={local.status_projeto} onValueChange={(v) => patch({ status_projeto: v })}>
                <SelectTrigger className={`w-[160px] h-9 rounded-xl border ${PROJETO_STATUS_COLOR[local.status_projeto as ProjetoStatus]}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s} value={s}>{PROJETO_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate(`/comercial/onboarding/${local.account_id}`)}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Onboarding
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="visao" className="space-y-4">
          <TabsList className="glass rounded-xl flex-wrap h-auto">
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="venda">Venda</TabsTrigger>
            <TabsTrigger value="gc">Growth Class</TabsTrigger>
            <TabsTrigger value="escopo">Escopo</TabsTrigger>
            <TabsTrigger value="stack">Stack & Acessos</TabsTrigger>
            <TabsTrigger value="time">Time</TabsTrigger>
            <TabsTrigger value="doc">Documentação</TabsTrigger>
            <TabsTrigger value="anexos">Anexos</TabsTrigger>
            <TabsTrigger value="fin">Financeiro</TabsTrigger>
          </TabsList>

          {/* Visão geral — Timeline */}
          <TabsContent value="visao" className="space-y-4">
            <TimelinePanel projeto={projeto} />
          </TabsContent>

          {/* Venda */}
          <TabsContent value="venda" className="space-y-4">
            <VendaPanel projeto={projeto} onOpenOportunidade={(id) => navigate(`/comercial/oportunidades/${id}`)} />
          </TabsContent>

          {/* Growth Class */}
          <TabsContent value="gc" className="space-y-4">
            <GrowthClassPanel projeto={projeto} />
          </TabsContent>


          {/* Escopo */}
          <TabsContent value="escopo" className="space-y-4">
            <Section title="Prazos">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Início">
                  <Input type="date" value={local.prazo_inicio ?? ""} onChange={(e) => patch({ prazo_inicio: e.target.value || null })} />
                </Field>
                <Field label="Fim previsto">
                  <Input type="date" value={local.prazo_fim ?? ""} onChange={(e) => patch({ prazo_fim: e.target.value || null })} />
                </Field>
              </div>
            </Section>
            <Section title="Descrição do projeto">
              <Textarea rows={4} value={local.descricao ?? ""} onChange={(e) => patch({ descricao: e.target.value })} placeholder="O que este projeto entrega..." />
            </Section>
            <Section title="Objetivos">
              <Textarea rows={6} value={local.objetivos ?? ""} onChange={(e) => patch({ objetivos: e.target.value })} placeholder="Objetivos estratégicos, resultados esperados..." />
            </Section>
            <Section title="KPIs alvo">
              <KpisEditor value={local.kpis_alvo ?? []} onChange={(v) => patch({ kpis_alvo: v })} />
            </Section>
          </TabsContent>

          {/* Stack */}
          <TabsContent value="stack" className="space-y-4">
            <Section title="Stack (ferramentas usadas)">
              <StackEditor value={local.stack ?? []} onChange={(v) => patch({ stack: v })} />
            </Section>
            <Section title="Links & acessos">
              <LinksEditor value={local.links ?? []} onChange={(v) => patch({ links: v })} />
            </Section>
          </TabsContent>

          {/* Time */}
          <TabsContent value="time" className="space-y-4">
            <Section title="Time & responsáveis">
              <TimeEditor value={local.time ?? []} onChange={(v) => patch({ time: v })} profiles={profiles} />
            </Section>
          </TabsContent>

          {/* Doc */}
          <TabsContent value="doc" className="space-y-4">
            <Section title="Documentação, briefing, histórico e decisões">
              <Textarea
                rows={20}
                value={local.documentacao ?? ""}
                onChange={(e) => patch({ documentacao: e.target.value })}
                placeholder="Espaço livre para documentar tudo sobre o projeto. Aceita markdown simples."
                className="font-mono text-sm"
              />
            </Section>
          </TabsContent>

          {/* Anexos */}
          <TabsContent value="anexos">
            <AnexosPanel anexos={anexos.data ?? []} upload={anexos.upload} remove={anexos.remove} getSignedUrl={anexos.getSignedUrl} />
          </TabsContent>

          {/* Financeiro */}
          <TabsContent value="fin">
            <Section title="Cobranças do contrato">
              {(projeto.cobrancas?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">Sem cobranças registradas.</p>
              ) : (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-2/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Tipo</th>
                        <th className="text-left px-3 py-2">Parcela</th>
                        <th className="text-right px-3 py-2">Valor</th>
                        <th className="text-left px-3 py-2">Vencimento</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projeto.cobrancas!.map((c) => (
                        <tr key={c.id} className="border-t border-border/30">
                          <td className="px-3 py-2">{c.tipo ?? "—"}</td>
                          <td className="px-3 py-2">{c.parcela_num && c.parcela_total ? `${c.parcela_num}/${c.parcela_total}` : "—"}</td>
                          <td className="px-3 py-2 text-right">{fmtBRL(c.valor)}</td>
                          <td className="px-3 py-2">{fmtDate(c.vencimento)}</td>
                          <td className="px-3 py-2">
                            <span className={
                              c.status === "pago" ? "text-emerald-300"
                              : c.status === "atrasado" ? "text-red-300"
                              : "text-muted-foreground"
                            }>{c.status ?? "—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

/* ============= Subcomponents ============= */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

function KpisEditor({ value, onChange }: { value: KpiAlvo[]; onChange: (v: KpiAlvo[]) => void }) {
  const add = () => onChange([...value, { nome: "", meta: "", unidade: "" }]);
  const upd = (i: number, patch: Partial<KpiAlvo>) => onChange(value.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {value.map((k, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_auto] gap-2">
          <Input placeholder="KPI (ex: CAC)" value={k.nome} onChange={(e) => upd(i, { nome: e.target.value })} />
          <Input placeholder="Meta" value={k.meta} onChange={(e) => upd(i, { meta: e.target.value })} />
          <Input placeholder="Unidade" value={k.unidade ?? ""} onChange={(e) => upd(i, { unidade: e.target.value })} />
          <Button variant="ghost" size="icon" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Adicionar KPI</Button>
    </div>
  );
}

function StackEditor({ value, onChange }: { value: StackItem[]; onChange: (v: StackItem[]) => void }) {
  const add = () => onChange([...value, { ferramenta: "", categoria: "" }]);
  const upd = (i: number, patch: Partial<StackItem>) => onChange(value.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
          <Input placeholder="Ferramenta (ex: Meta Ads)" value={s.ferramenta} onChange={(e) => upd(i, { ferramenta: e.target.value })} />
          <Input placeholder="Categoria (ex: mídia paga)" value={s.categoria} onChange={(e) => upd(i, { categoria: e.target.value })} />
          <Button variant="ghost" size="icon" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Adicionar ferramenta</Button>
    </div>
  );
}

function LinksEditor({ value, onChange }: { value: LinkItem[]; onChange: (v: LinkItem[]) => void }) {
  const add = () => onChange([...value, { label: "", url: "", categoria: "outros" }]);
  const upd = (i: number, patch: Partial<LinkItem>) => onChange(value.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {value.map((l, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_140px_auto] gap-2 items-center">
          <Input placeholder="Label" value={l.label} onChange={(e) => upd(i, { label: e.target.value })} />
          <div className="flex gap-1">
            <Input placeholder="https://..." value={l.url} onChange={(e) => upd(i, { url: e.target.value })} />
            {l.url && (
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 rounded-md bg-surface-2/60 hover:bg-surface-2">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <Select value={l.categoria || "outros"} onValueChange={(v) => upd(i, { categoria: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="drive">Drive</SelectItem>
              <SelectItem value="figma">Figma</SelectItem>
              <SelectItem value="ga">Google Analytics</SelectItem>
              <SelectItem value="meta">Meta Ads</SelectItem>
              <SelectItem value="google_ads">Google Ads</SelectItem>
              <SelectItem value="dashboard">Dashboard</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Adicionar link</Button>
    </div>
  );
}

function TimeEditor({ value, onChange, profiles }: { value: TimeMember[]; onChange: (v: TimeMember[]) => void; profiles: any[] }) {
  const add = () => onChange([...value, { profile_id: null, nome_livre: "", papel: "" }]);
  const upd = (i: number, patch: Partial<TimeMember>) => onChange(value.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const del = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      {value.map((m, i) => (
        <div key={i} className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_auto] gap-2">
          <Select
            value={m.profile_id ?? "__free__"}
            onValueChange={(v) => upd(i, { profile_id: v === "__free__" ? null : v, nome_livre: v === "__free__" ? m.nome_livre ?? "" : null })}
          >
            <SelectTrigger><SelectValue placeholder="Membro" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__free__">— nome livre —</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {m.profile_id ? (
            <div className="flex items-center text-sm text-muted-foreground px-2">
              {profileLabel(profiles.find((p) => p.id === m.profile_id))}
            </div>
          ) : (
            <Input placeholder="Nome livre" value={m.nome_livre ?? ""} onChange={(e) => upd(i, { nome_livre: e.target.value })} />
          )}
          <Input placeholder="Papel (ex: Gestor de tráfego)" value={m.papel} onChange={(e) => upd(i, { papel: e.target.value })} />
          <Button variant="ghost" size="icon" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="gap-2"><Plus className="h-4 w-4" /> Adicionar membro</Button>
    </div>
  );
}

function AnexosPanel({
  anexos,
  upload,
  remove,
  getSignedUrl,
}: {
  anexos: AnexoRow[];
  upload: ReturnType<typeof useProjetoAnexos>["upload"];
  remove: ReturnType<typeof useProjetoAnexos>["remove"];
  getSignedUrl: ReturnType<typeof useProjetoAnexos>["getSignedUrl"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync(f);
      } catch (e: any) {
        toast({ title: `Falha ao enviar ${f.name}`, description: e.message, variant: "destructive" });
      }
    }
  }

  async function handleDownload(row: AnexoRow) {
    const url = await getSignedUrl(row);
    if (!url) {
      toast({ title: "Não foi possível gerar link", variant: "destructive" });
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <Section title="Anexos">
      <div className="mb-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="gap-2"
        >
          {upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Enviar arquivo
        </Button>
      </div>

      {anexos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum anexo ainda.</p>
      ) : (
        <div className="space-y-2">
          {anexos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-surface-2/40 px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm truncate">{a.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtBytes(a.size_bytes)} · {fmtDate(a.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleDownload(a)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(a)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function VendaPanel({ projeto, onOpenOportunidade }: { projeto: any; onOpenOportunidade: (id: string) => void }) {
  const op = projeto?.account?.oportunidade;
  const lead = op?.lead;
  const valorTotal = (Number(op?.valor_ef) || 0) + (Number(op?.valor_fee) || 0);

  if (!op) {
    return (
      <Section title="Venda">
        <p className="text-sm text-muted-foreground">Sem oportunidade vinculada a esta conta.</p>
      </Section>
    );
  }

  return (
    <>
      <Section title="Resumo da venda">
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Oportunidade">
            <div className="flex items-center gap-2">
              <p className="text-sm">{op.nome_oportunidade ?? "—"}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenOportunidade(op.id)}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Field>
          <Field label="Etapa"><p className="text-sm">{op.etapa ?? "—"}</p></Field>
          <Field label="Temperatura"><p className="text-sm capitalize">{op.temperatura ?? "—"}</p></Field>
          <Field label="Valor EF"><p className="text-sm">{fmtBRL(op.valor_ef)}</p></Field>
          <Field label="Valor Fee (mensal)"><p className="text-sm">{fmtBRL(op.valor_fee)}</p></Field>
          <Field label="Valor total (EF + Fee)"><p className="text-sm font-medium">{fmtBRL(valorTotal)}</p></Field>
          <Field label="Data da proposta"><p className="text-sm">{fmtDate(op.data_proposta)}</p></Field>
          <Field label="Fechamento"><p className="text-sm">{fmtDate(op.data_fechamento_real)}</p></Field>
          <Field label="Nível de consciência"><p className="text-sm capitalize">{op.nivel_consciencia ?? "—"}</p></Field>
        </div>
      </Section>

      {lead && (
        <Section title="Lead">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Nome"><p className="text-sm">{lead.nome ?? "—"}</p></Field>
            <Field label="Empresa"><p className="text-sm">{lead.empresa ?? "—"}</p></Field>
            <Field label="E-mail"><p className="text-sm break-all">{lead.email ?? "—"}</p></Field>
            <Field label="Telefone"><p className="text-sm">{lead.telefone ?? "—"}</p></Field>
            <Field label="Segmento"><p className="text-sm">{lead.segmento ?? "—"}</p></Field>
            <Field label="Faturamento"><p className="text-sm">{lead.faturamento ?? "—"}</p></Field>
          </div>
        </Section>
      )}

      {(op.info_deal || op.oportunidades_monetizacao || op.resumo_reuniao || op.notas) && (
        <Section title="Contexto comercial">
          <div className="space-y-4">
            {op.info_deal && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Info do deal</p>
                <p className="text-sm whitespace-pre-wrap">{op.info_deal}</p>
              </div>
            )}
            {op.oportunidades_monetizacao && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Oportunidades de monetização</p>
                <p className="text-sm whitespace-pre-wrap">{op.oportunidades_monetizacao}</p>
              </div>
            )}
            {op.resumo_reuniao && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Resumo da reunião</p>
                <p className="text-sm whitespace-pre-wrap">{op.resumo_reuniao}</p>
              </div>
            )}
            {op.notas && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notas</p>
                <p className="text-sm whitespace-pre-wrap">{op.notas}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Pré Growth Class (contexto da venda gerado por IA)">
        {(() => {
          const rel = projeto?.account?.pre_growth_class_relatorio ?? null;
          const geradoEm = projeto?.account?.pre_growth_class_gerado_em ?? null;
          return (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                {geradoEm ? `Gerado em ${new Date(geradoEm).toLocaleString("pt-BR")}` : "Ainda não gerado"}
              </p>
              {rel ? (
                <div className="rounded-xl bg-surface-2/40 p-4 max-h-[70vh] overflow-y-auto prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{rel}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ainda não gerado. É criado automaticamente após o fechamento da venda.
                </p>
              )}
            </>
          );
        })()}
      </Section>
    </>
  );
}

function GrowthClassPanel({ projeto }: { projeto: any }) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [relatorio, setRelatorio] = useState<string | null>(projeto?.growth_class_ia_relatorio ?? null);
  const [geradoEm, setGeradoEm] = useState<string | null>(projeto?.growth_class_ia_gerado_em ?? null);

  useEffect(() => {
    setRelatorio(projeto?.growth_class_ia_relatorio ?? null);
    setGeradoEm(projeto?.growth_class_ia_gerado_em ?? null);
  }, [projeto?.id, projeto?.growth_class_ia_relatorio, projeto?.growth_class_ia_gerado_em]);

  const expectativa = projeto?.account?.growth_class_expectativas ?? null;
  const notas = projeto?.account?.oportunidade?.notas ?? null;
  const transcricao = projeto?.account?.oportunidade?.transcricao_reuniao ?? null;
  const hasSourceMaterial = !!(expectativa || notas || transcricao);

  async function gerar(force = false) {
    setGenerating(true);
    try {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase
        .functions.invoke("generate-growth-class-summary", {
          body: { projeto_id: projeto.id, force },
        });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const rel = (data as any)?.relatorio;
      if (rel) {
        setRelatorio(rel);
        setGeradoEm(new Date().toISOString());
        toast({ title: "Resumo gerado" });
      }
    } catch (e: any) {
      toast({ title: "Falha ao gerar resumo", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  if (!hasSourceMaterial && !relatorio) {
    return (
      <Section title="Growth Class — expectativas do cliente">
        <p className="text-sm text-muted-foreground">
          Ainda não há material para gerar o resumo. Preencha a expectativa no onboarding
          ou anexe a transcrição/notas da reunião na oportunidade.
        </p>
      </Section>
    );
  }

  return (
    <>
      <Section title="Resumo de expectativas (gerado por IA)">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {geradoEm ? `Gerado em ${new Date(geradoEm).toLocaleString("pt-BR")}` : "Ainda não gerado"}
            <span className="ml-2 opacity-70">· fontes: expectativa do onboarding + transcrição + notas</span>
          </p>
          <Button
            variant={relatorio ? "outline" : "default"}
            size="sm"
            className="gap-2"
            onClick={() => gerar(!!relatorio)}
            disabled={generating || !hasSourceMaterial}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {relatorio ? "Regerar resumo" : "Gerar resumo"}
          </Button>
        </div>

        {generating && !relatorio && (
          <div className="rounded-xl bg-surface-2/40 p-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando expectativa, transcrição e notas...
          </div>
        )}

        {relatorio ? (
          <div className="rounded-xl bg-surface-1/60 border border-border/40 p-5 prose prose-sm prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-h2:text-base prose-h2:font-semibold prose-h2:text-foreground prose-ul:my-2 prose-li:my-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{relatorio}</ReactMarkdown>
          </div>
        ) : !generating ? (
          <p className="text-sm text-muted-foreground">
            Clique em "Gerar resumo" para produzir uma análise estruturada com perfil do cliente,
            expectativas de curto/médio/longo prazo, prioridades e pontos de atenção.
          </p>
        ) : null}
      </Section>

      {expectativa && (
        <Section title="Expectativa registrada no onboarding (original)">
          <div className="rounded-xl bg-surface-2/30 p-4 prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{expectativa}</ReactMarkdown>
          </div>
        </Section>
      )}
    </>
  );
}

/* ============= Timeline ============= */

type TimelineStep = {
  id: string;
  date: string | null;
  title: string;
  category: "lead" | "reuniao" | "venda" | "gc";
  tone: "success" | "info" | "neutral" | "pending";
  summary?: string | null; // markdown
  meta?: string | null;
};

function TimelinePanel({ projeto }: { projeto: any; anexos?: any[] }) {
  const acc = projeto?.account;
  const accountId = acc?.id;
  const expectativaOriginal = acc?.growth_class_expectativas ?? null;
  const expectativaRevisadaDb = acc?.growth_class_expectativas_revisado ?? null;

  const [revisadoLocal, setRevisadoLocal] = useState<string | null>(expectativaRevisadaDb);
  const triggeredRef = useRef(false);

  useEffect(() => {
    setRevisadoLocal(expectativaRevisadaDb);
    triggeredRef.current = false;
  }, [projeto?.id, expectativaRevisadaDb]);


  // Auto-revisão silenciosa quando há expectativa mas nunca foi revisada
  useEffect(() => {
    if (triggeredRef.current) return;
    if (!accountId || !expectativaOriginal) return;
    if (expectativaRevisadaDb) return;
    triggeredRef.current = true;
    revisarExpectativa(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, expectativaOriginal, expectativaRevisadaDb]);

  const op = acc?.oportunidade;
  const lead = op?.lead;
  const resumoReu = op?.resumo_reuniao || op?.notas || null;
  const gcSummary = revisadoLocal || expectativaOriginal || null;

  const steps: TimelineStep[] = [
    {
      id: "lead",
      date: lead?.created_at ?? null,
      title: "Lead cadastrado",
      category: "lead",
      tone: lead?.created_at ? "info" : "pending",
      meta: [lead?.nome, lead?.empresa].filter(Boolean).join(" · ") || null,
    },
    {
      id: "reu-ag",
      date: lead?.data_reuniao_agendada ?? null,
      title: "Reunião agendada",
      category: "reuniao",
      tone: lead?.data_reuniao_agendada ? "info" : "pending",
      summary: lead?.qualificacao || null,
    },
    {
      id: "reu-real",
      date: lead?.data_reuniao_realizada ?? null,
      title: "Reunião realizada",
      category: "reuniao",
      tone: lead?.data_reuniao_realizada ? "success" : "pending",
      summary: resumoReu,
    },
    {
      id: "venda",
      date: op?.data_fechamento_real ?? null,
      title: "Venda fechada",
      category: "venda",
      tone: op?.data_fechamento_real ? "success" : "pending",
      meta: (() => {
        const total = (Number(op?.valor_ef) || 0) + (Number(op?.valor_fee) || 0);
        return total
          ? `Valor total: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(total)}`
          : null;
      })(),
    },
    {
      id: "gc",
      date: acc?.growth_class_expectativas_revisado_em ?? null,
      title: "Growth Class — expectativa do cliente",
      category: "gc",
      tone: gcSummary ? "info" : "pending",
      summary: gcSummary,
    },
  ];

  return (
    <Section title="Timeline do projeto">
      <ol className="relative border-l border-border/50 ml-3 space-y-8 pt-1">
        {steps.map((s) => (
          <TimelineItem key={s.id} step={s} />
        ))}
      </ol>
    </Section>
  );
}

function TimelineItem({ step }: { step: TimelineStep }) {
  const { icon: Icon, dotClass, textClass } = iconForCategory(step.category, step.tone);
  const isPending = step.tone === "pending";
  return (
    <li className="ml-6">
      <span className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${dotClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <p className={`text-sm font-medium ${textClass} ${isPending ? "opacity-50" : ""}`}>{step.title}</p>
        <time className="text-xs text-muted-foreground shrink-0">
          {step.date
            ? new Date(step.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
            : "pendente"}
        </time>
      </div>
      {step.meta && (
        <p className="text-xs text-muted-foreground mt-0.5">{step.meta}</p>
      )}
      {step.summary && (
        <div className="mt-2 rounded-lg bg-surface-2/40 border border-border/30 p-3 max-h-56 overflow-y-auto prose prose-xs prose-invert max-w-none prose-p:my-1 prose-headings:mt-2 prose-headings:mb-1 prose-h2:text-xs prose-h2:font-semibold prose-h2:uppercase prose-h2:tracking-wider prose-h2:text-muted-foreground prose-ul:my-1 prose-li:my-0 text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.summary}</ReactMarkdown>
        </div>
      )}
    </li>
  );
}

function iconForCategory(cat: TimelineStep["category"], tone: TimelineStep["tone"]) {
  const toneMap = {
    success: { dotClass: "bg-emerald-500/20 text-emerald-300", textClass: "text-foreground" },
    info: { dotClass: "bg-primary/20 text-primary", textClass: "text-foreground" },
    neutral: { dotClass: "bg-surface-2 text-muted-foreground", textClass: "text-foreground" },
    pending: { dotClass: "bg-surface-2/60 text-muted-foreground/60", textClass: "text-muted-foreground" },
  } as const;
  const iconMap = {
    lead: User,
    reuniao: MessageSquare,
    venda: Rocket,
    gc: Flag,
  } as const;
  return { icon: iconMap[cat] ?? AlertCircle, ...toneMap[tone] };
}

export default ProjetoDetail;
