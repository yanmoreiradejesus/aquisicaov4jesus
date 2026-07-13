import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useCreateTarefa, PRIORIDADE_LABEL, type TarefaPrioridade } from "@/hooks/useTarefas";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { useProjetos } from "@/hooks/useProjetos";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projetoIdDefault?: string | null;
}

interface EtapaDraft {
  nome: string;
  funcao: string;
  responsavel_id: string | null;
  dias: string;
}

export function NovaTarefaDialog({ open, onOpenChange, projetoIdDefault }: Props) {
  const { profiles } = useProfilesList({});
  const { data: projetos = [] } = useProjetos();
  const create = useCreateTarefa();
  const { toast } = useToast();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [projetoId, setProjetoId] = useState<string>(projetoIdDefault ?? "");
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>("media");
  const [prazoFinal, setPrazoFinal] = useState("");
  const [etapas, setEtapas] = useState<EtapaDraft[]>([
    { nome: "", funcao: "", responsavel_id: null, dias: "" },
  ]);

  // Delta em dias entre hoje e o prazo final (referência para distribuir dias por etapa)
  const deltaDias = (() => {
    if (!prazoFinal) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const fim = new Date(prazoFinal + "T00:00:00");
    return Math.max(0, Math.round((fim.getTime() - hoje.getTime()) / 86400000));
  })();
  const somaDias = etapas.reduce((s, e) => s + (Number(e.dias) || 0), 0);

  const reset = () => {
    setTitulo(""); setDescricao(""); setProjetoId(projetoIdDefault ?? "");
    setPrioridade("media"); setPrazoFinal("");
    setEtapas([{ nome: "", funcao: "", responsavel_id: null, dias: "" }]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...etapas];
    const to = idx + dir;
    if (to < 0 || to >= next.length) return;
    [next[idx], next[to]] = [next[to], next[idx]];
    setEtapas(next);
  };

  // Converte "dias" cumulativos em uma data ISO (yyyy-mm-dd) a partir de hoje
  const dataFromDias = (cumDias: number): string | null => {
    if (!cumDias || cumDias <= 0) return null;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + cumDias);
    return d.toISOString().slice(0, 10);
  };

  const handleSave = async () => {
    if (!titulo.trim()) return toast({ title: "Título obrigatório", variant: "destructive" });
    const etapasValidas = etapas.filter((e) => e.nome.trim());
    if (!etapasValidas.length) return toast({ title: "Adicione pelo menos uma etapa", variant: "destructive" });
    let cum = 0;
    const etapasPayload = etapasValidas.map((e) => {
      const dias = Number(e.dias) || 0;
      cum += dias;
      return {
        nome: e.nome.trim(),
        funcao: e.funcao || null,
        responsavel_id: e.responsavel_id,
        prazo: dias > 0 ? dataFromDias(cum) : null,
      };
    });
    try {
      await create.mutateAsync({
        titulo: titulo.trim(),
        descricao: descricao || undefined,
        projeto_id: projetoId || null,
        escopo: null,
        prioridade,
        prazo_final: prazoFinal || null,
        etapas: etapasPayload,
      });
      toast({ title: "Tarefa criada" });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Criar campanha Meta Ads..." />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Projeto</Label>
              <Select value={projetoId || "none"} onValueChange={(v) => setProjetoId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem projeto</SelectItem>
                  {projetos.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome || p.cliente_nome || "—"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as TarefaPrioridade)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORIDADE_LABEL) as TarefaPrioridade[]).map((k) => (
                    <SelectItem key={k} value={k}>{PRIORIDADE_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Prazo final</Label>
              <Input type="date" value={prazoFinal} onChange={(e) => setPrazoFinal(e.target.value)} />
              {deltaDias !== null && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {deltaDias} dia(s) entre hoje e o prazo final · distribuído nas etapas: {somaDias} dia(s)
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/40 bg-background/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Fluxo de etapas</h3>
              <Button size="sm" variant="ghost" onClick={() =>
                setEtapas([...etapas, { nome: "", funcao: "", responsavel_id: null, dias: "" }])
              }>
                <Plus className="h-4 w-4 mr-1" /> Etapa
              </Button>
            </div>
            {etapas.map((e, idx) => (
              <div key={idx} className="rounded-md border border-border/50 p-3 space-y-2 relative">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-semibold">#{idx + 1}</span>
                  <Input placeholder="Nome da etapa" value={e.nome} onChange={(ev) => {
                    const n = [...etapas]; n[idx].nome = ev.target.value; setEtapas(n);
                  }} className="flex-1" />
                  <Button size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === etapas.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEtapas(etapas.filter((_, i) => i !== idx))} disabled={etapas.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Função (ex: Designer)" value={e.funcao} onChange={(ev) => {
                    const n = [...etapas]; n[idx].funcao = ev.target.value; setEtapas(n);
                  }} />
                  <Select value={e.responsavel_id ?? "none"} onValueChange={(v) => {
                    const n = [...etapas]; n[idx].responsavel_id = v === "none" ? null : v; setEtapas(n);
                  }}>
                    <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={0} placeholder="Dias" value={e.dias} onChange={(ev) => {
                    const n = [...etapas]; n[idx].dias = ev.target.value; setEtapas(n);
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending}>Criar tarefa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
