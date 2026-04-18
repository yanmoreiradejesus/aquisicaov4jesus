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
  onSave: (lead: any) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const empty = {
  nome: "", email: "", telefone: "", empresa: "", cargo: "",
  origem: "", tier: "", urgencia: "", etapa: "entrada", notas: "",
  motivo_desqualificacao: "",
};

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
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wider uppercase">
            {lead?.id ? "Editar Lead" : "Novo Lead"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <Input value={form.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cargo</Label>
            <Input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Input value={form.origem ?? ""} onChange={(e) => set("origem", e.target.value)} placeholder="Meta Ads, indicação..." />
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
            <Label>Urgência</Label>
            <Select value={form.urgencia ?? ""} onValueChange={(v) => set("urgencia", v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.nome?.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
