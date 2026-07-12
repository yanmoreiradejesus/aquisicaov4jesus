import { useMemo, useRef, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { useToast } from "@/hooks/use-toast";
import { useExpansoes, EXPANSAO_ETAPAS, type ExpansaoRow, type ExpansaoTipoGanho } from "@/hooks/useExpansoes";
import { useProjetos } from "@/hooks/useProjetos";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { ExpansaoColumn } from "@/components/expansao/ExpansaoColumn";
import { ExpansaoCard } from "@/components/expansao/ExpansaoCard";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

type FormState = {
  id?: string;
  projeto_id: string;
  titulo: string;
  descricao: string;
  valor_estimado: string;
  responsavel_id: string;
};

const emptyForm: FormState = {
  projeto_id: "",
  titulo: "",
  descricao: "",
  valor_estimado: "",
  responsavel_id: "",
};

export default function Expansao() {
  const { data: expansoes = [], isLoading, upsert, updateEtapa, remove } = useExpansoes();
  const { data: projetos = [] } = useProjetos();
  const { profiles } = useProfilesList({ departamento: "Receitas" });
  const { toast } = useToast();

  const responsaveis = useMemo(() => {
    const map: Record<string, string> = {};
    profiles.forEach((p) => (map[p.id] = profileLabel(p)));
    return map;
  }, [profiles]);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [ganhoOpen, setGanhoOpen] = useState(false);
  const [ganhoTarget, setGanhoTarget] = useState<ExpansaoRow | null>(null);
  const [ganhoForm, setGanhoForm] = useState<{
    tipo: ExpansaoTipoGanho;
    fee: string;
    ef: string;
    novoFeeMensal: string;
    contratoFile: File | null;
  }>({
    tipo: "aumento_fee",
    fee: "",
    ef: "",
    novoFeeMensal: "",
    contratoFile: null,
  });
  const [perdaOpen, setPerdaOpen] = useState(false);
  const [perdaTarget, setPerdaTarget] = useState<ExpansaoRow | null>(null);
  const [perdaMotivo, setPerdaMotivo] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(scrollRef);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expansoes;
    return expansoes.filter((e) => {
      const cliente = e.projeto?.account?.cliente_nome || e.projeto?.nome || "";
      return (
        e.titulo.toLowerCase().includes(q) ||
        cliente.toLowerCase().includes(q) ||
        (e.descricao ?? "").toLowerCase().includes(q)
      );
    });
  }, [expansoes, search]);

  const byEtapa = useMemo(() => {
    const g: Record<string, ExpansaoRow[]> = { mapeada: [], proposta: [], negociacao: [], ganho: [], perdido: [] };
    filtered.forEach((e) => {
      g[e.etapa]?.push(e);
    });
    return g;
  }, [filtered]);

  const perdidas = byEtapa.perdido;

  // KPIs
  const kpis = useMemo(() => {
    const mapeado = byEtapa.mapeada.reduce((s, e) => s + (Number(e.valor_estimado) || 0), 0);
    const pipeline =
      byEtapa.proposta.reduce((s, e) => s + (Number(e.valor_estimado) || 0), 0) +
      byEtapa.negociacao.reduce((s, e) => s + (Number(e.valor_estimado) || 0), 0);
    const ganho = byEtapa.ganho.reduce(
      (s, e) => s + (Number(e.valor_aumento_fee) || 0) + (Number(e.valor_escopo_fechado) || 0),
      0,
    );
    const totalDecidido = byEtapa.ganho.length + perdidas.length;
    const conv = totalDecidido > 0 ? (byEtapa.ganho.length / totalDecidido) * 100 : 0;
    return { mapeado, pipeline, ganho, conv };
  }, [byEtapa, perdidas.length]);

  const openNew = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };
  const openEdit = (e: ExpansaoRow) => {
    setForm({
      id: e.id,
      projeto_id: e.projeto_id,
      titulo: e.titulo,
      descricao: e.descricao ?? "",
      valor_estimado: e.valor_estimado != null ? String(e.valor_estimado) : "",
      responsavel_id: e.responsavel_id ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.projeto_id) return toast({ title: "Selecione um projeto", variant: "destructive" });
    if (!form.titulo.trim()) return toast({ title: "Título obrigatório", variant: "destructive" });
    try {
      await upsert.mutateAsync({
        id: form.id,
        projeto_id: form.projeto_id,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
        responsavel_id: form.responsavel_id || null,
      } as any);
      setDialogOpen(false);
      toast({ title: form.id ? "Oportunidade atualizada" : "Oportunidade criada" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragId(null);
    const { active, over } = event;
    if (!over) return;
    const id = String(active.id);
    const to = String(over.id);
    const op = expansoes.find((e) => e.id === id);
    if (!op || op.etapa === to) return;

    if (to === "ganho") {
      const currentMrr = Number(op.projeto?.account?.mrr ?? 0);
      const feeVal = op.valor_aumento_fee != null ? Number(op.valor_aumento_fee) : 0;
      setGanhoTarget(op);
      setGanhoForm({
        tipo: op.tipo_ganho ?? "aumento_fee",
        fee: op.valor_aumento_fee != null ? String(op.valor_aumento_fee) : "",
        ef: op.valor_escopo_fechado != null ? String(op.valor_escopo_fechado) : "",
        novoFeeMensal: op.novo_fee_mensal != null ? String(op.novo_fee_mensal) : String(currentMrr + feeVal),
        contratoFile: null,
      });
      setGanhoOpen(true);
      return;
    }

    try {
      await updateEtapa.mutateAsync({ id, etapa: to as any });
    } catch (e: any) {
      toast({ title: "Erro ao mover", description: e.message, variant: "destructive" });
    }
  };

  const confirmGanho = async () => {
    if (!ganhoTarget) return;
    const tipo = ganhoForm.tipo;
    const fee = ganhoForm.fee ? Number(ganhoForm.fee) : null;
    const ef = ganhoForm.ef ? Number(ganhoForm.ef) : null;
    const temFee = tipo === "aumento_fee" || tipo === "ambos";
    const novoFee = temFee && ganhoForm.novoFeeMensal ? Number(ganhoForm.novoFeeMensal) : null;
    if (tipo === "aumento_fee" && !fee) return toast({ title: "Informe o valor do aumento de fee", variant: "destructive" });
    if (tipo === "escopo_fechado" && !ef) return toast({ title: "Informe o valor do escopo fechado", variant: "destructive" });
    if (tipo === "ambos" && (!fee || !ef)) return toast({ title: "Informe fee e escopo fechado", variant: "destructive" });
    if (temFee && (!novoFee || novoFee <= 0))
      return toast({ title: "Informe o novo fee mensal recorrente", variant: "destructive" });
    if (!ganhoTarget.contrato_path && !ganhoForm.contratoFile)
      return toast({ title: "Anexe o contrato assinado", variant: "destructive" });

    try {
      let contratoPath = ganhoTarget.contrato_path;
      if (ganhoForm.contratoFile) {
        const file = ganhoForm.contratoFile;
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `expansoes/${ganhoTarget.tenant_id}/${ganhoTarget.id}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("contratos-assinados")
          .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        contratoPath = path;
      }

      await updateEtapa.mutateAsync({
        id: ganhoTarget.id,
        etapa: "ganho",
        tipo_ganho: tipo,
        valor_aumento_fee: tipo === "escopo_fechado" ? null : fee,
        valor_escopo_fechado: tipo === "aumento_fee" ? null : ef,
        contrato_path: contratoPath,
        novo_fee_mensal: temFee ? novoFee : null,
        account_id: ganhoTarget.projeto?.account?.id ?? null,
      });
      setGanhoOpen(false);
      setGanhoTarget(null);
      toast({ title: "Expansão marcada como ganha" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const confirmPerda = async () => {
    if (!perdaTarget) return;
    try {
      await updateEtapa.mutateAsync({ id: perdaTarget.id, etapa: "perdido", motivo_perda: perdaMotivo || undefined });
      setPerdaOpen(false);
      setPerdaTarget(null);
      setPerdaMotivo("");
      toast({ title: "Oportunidade marcada como perdida" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    if (!confirm("Excluir esta oportunidade de expansão?")) return;
    try {
      await remove.mutateAsync(form.id);
      setDialogOpen(false);
      toast({ title: "Excluída" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const dragged = dragId ? expansoes.find((e) => e.id === dragId) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground mb-1">Revenue</div>
            <h1 className="text-3xl font-display font-light tracking-tight text-foreground">Expansão</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              CRM de monetização da base ativa. Cada projeto cadastrado é candidato a expansão via aumento de fee ou escopo fechado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, título…"
                className="pl-8 h-9 w-64"
              />
            </div>
            <Button onClick={openNew} className="h-9">
              <Plus className="h-4 w-4 mr-1.5" />
              Nova oportunidade
            </Button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Mapeado" value={fmtBRL(kpis.mapeado)} />
          <KpiCard label="Em proposta / negociação" value={fmtBRL(kpis.pipeline)} />
          <KpiCard label="Ganho (Fee + EF)" value={fmtBRL(kpis.ganho)} accent />
          <KpiCard label="Conversão" value={`${kpis.conv.toFixed(0)}%`} />
        </div>

        {/* Kanban */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
            {EXPANSAO_ETAPAS.map((et) => (
              <ExpansaoColumn
                key={et.id}
                id={et.id}
                label={et.label}
                color={et.color}
                expansoes={byEtapa[et.id] ?? []}
                onEdit={openEdit}
                responsaveis={responsaveis}
              />
            ))}
          </div>
          <DragOverlay>
            {dragged && (
              <ExpansaoCard
                expansao={dragged}
                onClick={() => {}}
                overlay
                responsavelNome={dragged.responsavel_id ? responsaveis[dragged.responsavel_id] : null}
              />
            )}
          </DragOverlay>
        </DndContext>

        {perdidas.length > 0 && (
          <details className="mt-6">
            <summary className="text-xs uppercase tracking-[0.18em] text-muted-foreground cursor-pointer hover:text-foreground/80">
              Perdidas ({perdidas.length})
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {perdidas.map((e) => (
                <div key={e.id} onClick={() => openEdit(e)} className="cursor-pointer">
                  <ExpansaoCard
                    expansao={e}
                    onClick={() => openEdit(e)}
                    responsavelNome={e.responsavel_id ? responsaveis[e.responsavel_id] : null}
                  />
                </div>
              ))}
            </div>
          </details>
        )}

        {isLoading && (
          <div className="text-center text-sm text-muted-foreground py-8">Carregando…</div>
        )}
      </div>

      {/* Nova/editar dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar expansão" : "Nova oportunidade de expansão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Projeto (cliente)</Label>
              <Select
                value={form.projeto_id}
                onValueChange={(v) => setForm((f) => ({ ...f, projeto_id: v }))}
                disabled={!!form.id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um projeto ativo" />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.account?.cliente_nome || p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Título da oportunidade</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder='Ex.: "Aumento de fee — Q3"'
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor estimado (R$)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={form.valor_estimado}
                  onChange={(e) => setForm((f) => ({ ...f, valor_estimado: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select
                  value={form.responsavel_id || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {profileLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição / contexto</Label>
              <Textarea
                rows={3}
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Racional da oportunidade, gatilhos, timing…"
              />
            </div>

            {form.id && (
              <div className="pt-2 border-t border-border/40 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const target = expansoes.find((e) => e.id === form.id);
                    if (!target) return;
                    setDialogOpen(false);
                    setPerdaTarget(target);
                    setPerdaMotivo(target.motivo_perda ?? "");
                    setPerdaOpen(true);
                  }}
                >
                  Marcar como perdida
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
                  Excluir
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={upsert.isPending}>
              {form.id ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ganho dialog */}
      <Dialog open={ganhoOpen} onOpenChange={(v) => { setGanhoOpen(v); if (!v) setGanhoTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar expansão como ganha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {ganhoTarget && (
              <div className="text-xs text-muted-foreground">
                {ganhoTarget.projeto?.account?.cliente_nome || ganhoTarget.projeto?.nome} — {ganhoTarget.titulo}
              </div>
            )}
            <div className="space-y-2">
              <Label>Tipo de resultado</Label>
              <RadioGroup
                value={ganhoForm.tipo}
                onValueChange={(v) => setGanhoForm((f) => ({ ...f, tipo: v as ExpansaoTipoGanho }))}
                className="space-y-1.5"
              >
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="aumento_fee" /> Aumento de fee
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="escopo_fechado" /> Escopo fechado
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="ambos" /> Ambos
                </label>
              </RadioGroup>
            </div>

            {(ganhoForm.tipo === "aumento_fee" || ganhoForm.tipo === "ambos") && (
              <div className="space-y-1.5">
                <Label>Aumento de fee mensal (R$)</Label>
                <Input
                  type="number"
                  value={ganhoForm.fee}
                  onChange={(e) => {
                    const v = e.target.value;
                    setGanhoForm((f) => {
                      const currentMrr = Number(ganhoTarget?.projeto?.account?.mrr ?? 0);
                      const auto = v ? String(currentMrr + Number(v)) : String(currentMrr);
                      return { ...f, fee: v, novoFeeMensal: auto };
                    });
                  }}
                  placeholder="0"
                />
              </div>
            )}
            {(ganhoForm.tipo === "aumento_fee" || ganhoForm.tipo === "ambos") && (
              <div className="space-y-1.5">
                <Label>
                  Novo fee mensal recorrente (R$)
                  {ganhoTarget?.projeto?.account?.mrr != null && (
                    <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                      atual: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(ganhoTarget.projeto.account.mrr))}
                    </span>
                  )}
                </Label>
                <Input
                  type="number"
                  value={ganhoForm.novoFeeMensal}
                  onChange={(e) => setGanhoForm((f) => ({ ...f, novoFeeMensal: e.target.value }))}
                  placeholder="0"
                />
                <p className="text-[10px] text-muted-foreground">
                  Valor total do fee mensal do cliente após o aumento. Substitui o MRR da conta.
                </p>
              </div>
            )}
            {(ganhoForm.tipo === "escopo_fechado" || ganhoForm.tipo === "ambos") && (
              <div className="space-y-1.5">
                <Label>Escopo fechado — valor one-shot (R$)</Label>
                <Input
                  type="number"
                  value={ganhoForm.ef}
                  onChange={(e) => setGanhoForm((f) => ({ ...f, ef: e.target.value }))}
                  placeholder="0"
                />
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <Label>Contrato assinado (PDF)</Label>
              <Input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setGanhoForm((f) => ({ ...f, contratoFile: e.target.files?.[0] ?? null }))}
                className="cursor-pointer"
              />
              {ganhoTarget?.contrato_path && !ganhoForm.contratoFile && (
                <p className="text-[10px] text-muted-foreground truncate">
                  Anexado: {ganhoTarget.contrato_path.split("/").pop()}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setGanhoOpen(false); setGanhoTarget(null); }}>
              Cancelar
            </Button>
            <Button onClick={confirmGanho} disabled={updateEtapa.isPending}>
              Confirmar ganho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Perda dialog */}
      <Dialog open={perdaOpen} onOpenChange={(v) => { setPerdaOpen(v); if (!v) { setPerdaTarget(null); setPerdaMotivo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como perdida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Motivo</Label>
            <Textarea rows={3} value={perdaMotivo} onChange={(e) => setPerdaMotivo(e.target.value)} placeholder="Ex.: preço, timing, prioridade do cliente…" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPerdaOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPerda} disabled={updateEtapa.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const KpiCard = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <div className={cn(
    "rounded-xl border border-border/50 bg-surface-2/50 backdrop-blur-sm px-4 py-3",
    accent && "border-emerald-500/30 bg-emerald-500/5"
  )}>
    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    <div className="text-lg font-display font-light tabular-nums mt-0.5">{value}</div>
  </div>
);
