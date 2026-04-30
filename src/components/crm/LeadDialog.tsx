import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: any | null;
  pipe?: "inbound" | "outbound";
  onSave: (lead: any) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const OUTBOUND_CANAIS = [
  "Prospecção fria",
  "Networking",
  "Recovery",
  "Reativação",
  "Inside box",
  "Eventos",
];

const empty = {
  // Lead Broker
  nome_produto: "", valor_pago: null, arrematador: "", data_aquisicao: "",
  faturamento: "", segmento: "", canal: "",
  nome: "", email: "", cargo: "", telefone: "", empresa: "",
  pais: "BR", documento_empresa: "", tipo_produto: "", urgencia: "",
  data_criacao_origem: "", descricao: "", cidade: "", estado: "",
  // Internos
  etapa: "entrada", tier: "", notas: "", motivo_desqualificacao: "",
};

const formatBRL = (n: any) =>
  n == null || n === "" ? "" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));

export const LeadDialog = ({ open, onOpenChange, lead, onSave, onDelete }: Props) => {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(lead ?? empty);
  }, [open, lead]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome?.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.valor_pago === "" || payload.valor_pago == null) payload.valor_pago = null;
      else payload.valor_pago = Number(payload.valor_pago);
      if (!payload.data_aquisicao) payload.data_aquisicao = null;
      if (!payload.data_criacao_origem) payload.data_criacao_origem = null;
      // created_at: converte datetime-local para ISO; se vazio em novo lead, deixa o default do banco
      if (payload.created_at) {
        const s = String(payload.created_at);
        payload.created_at = s.length <= 16 ? new Date(s).toISOString() : s;
      } else {
        delete payload.created_at;
      }
      await onSave(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border-border/60 shadow-ios-xl glass-strong animate-scale-in">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wider uppercase">
            {lead?.id ? "Editar Lead" : "Novo Lead"}
          </DialogTitle>
        </DialogHeader>

        {/* DADOS DO LEAD BROKER */}
        <div className="space-y-1 pt-2">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
            Dados do Lead Broker
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome do responsável *</Label>
            <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Input value={form.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Documento (CNPJ)</Label>
            <Input value={form.documento_empresa ?? ""} onChange={(e) => set("documento_empresa", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo</Label>
            <Input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>País</Label>
            <Input value={form.pais ?? ""} onChange={(e) => set("pais", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <Input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Input value={form.estado ?? ""} onChange={(e) => set("estado", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Faturamento</Label>
            <Input value={form.faturamento ?? ""} onChange={(e) => set("faturamento", e.target.value)} placeholder="De 101 mil à 200 mil" />
          </div>
          <div className="space-y-1.5">
            <Label>Segmento</Label>
            <Input value={form.segmento ?? ""} onChange={(e) => set("segmento", e.target.value)} placeholder="Varejo, E-commerce…" />
          </div>
          <div className="space-y-1.5">
            <Label>Canal</Label>
            <Input value={form.canal ?? ""} onChange={(e) => set("canal", e.target.value)} placeholder="facebook, orgânico…" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de produto</Label>
            <Input value={form.tipo_produto ?? ""} onChange={(e) => set("tipo_produto", e.target.value)} placeholder="Assessoria / Estruturação…" />
          </div>
          <div className="space-y-1.5">
            <Label>Urgência</Label>
            <Input value={form.urgencia ?? ""} onChange={(e) => set("urgencia", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome do produto</Label>
            <Input value={form.nome_produto ?? ""} onChange={(e) => set("nome_produto", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Valor pago (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valor_pago ?? ""}
              onChange={(e) => set("valor_pago", e.target.value)}
              placeholder={formatBRL(form.valor_pago)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Arrematador</Label>
            <Input value={form.arrematador ?? ""} onChange={(e) => set("arrematador", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de aquisição</Label>
            <Input
              type="date"
              value={form.data_aquisicao ? String(form.data_aquisicao).slice(0, 10) : ""}
              onChange={(e) => set("data_aquisicao", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de criação na origem</Label>
            <Input
              type="datetime-local"
              value={form.data_criacao_origem ? String(form.data_criacao_origem).slice(0, 16) : ""}
              onChange={(e) => set("data_criacao_origem", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data de cadastro no sistema</Label>
            <Input
              type="datetime-local"
              value={form.created_at ? String(form.created_at).slice(0, 16) : ""}
              onChange={(e) => set("created_at", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} />
          </div>
        </div>

        {/* QUALIFICAÇÃO INTERNA */}
        <div className="space-y-1 pt-4 border-t border-border">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
            Qualificação interna
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Etapa</Label>
            <Select value={form.etapa} onValueChange={(v) => set("etapa", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LEAD_ETAPAS.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {form.etapa === "desqualificado" && (
            <div className="space-y-1.5 md:col-span-2">
              <Label>Motivo da desqualificação</Label>
              <Input value={form.motivo_desqualificacao ?? ""} onChange={(e) => set("motivo_desqualificacao", e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5 md:col-span-2">
            <Label>Notas</Label>
            <Textarea rows={3} value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {lead?.id && onDelete && (
            <Button
              variant="outline"
              onClick={() => { onDelete(lead.id); onOpenChange(false); }}
              className="mr-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.nome?.trim()}
            className="rounded-xl bg-gradient-to-b from-primary to-primary/85 shadow-ios-md hover:shadow-ios-glow active:scale-[0.98] transition-all"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
