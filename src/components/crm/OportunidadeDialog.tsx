import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPORTUNIDADE_ETAPAS } from "@/hooks/useCrmOportunidades";
import { Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oportunidade: any | null;
  onSave: (op: any) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
}

const empty = {
  nome_oportunidade: "",
  etapa: "proposta",
  valor_ef: "",
  valor_fee: "",
  valor_total: "",
  data_fechamento_previsto: "",
  motivo_perda: "",
  notas: "",
};

export const OportunidadeDialog = ({ open, onOpenChange, oportunidade, onSave, onDelete }: Props) => {
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        oportunidade
          ? {
              ...oportunidade,
              valor_ef: oportunidade.valor_ef ?? "",
              valor_fee: oportunidade.valor_fee ?? "",
              valor_total: oportunidade.valor_total ?? "",
              data_fechamento_previsto: oportunidade.data_fechamento_previsto ?? "",
              motivo_perda: oportunidade.motivo_perda ?? "",
              notas: oportunidade.notas ?? "",
            }
          : empty
      );
    }
  }, [open, oportunidade]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nome_oportunidade?.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        ...form,
        valor_ef: form.valor_ef === "" ? null : Number(form.valor_ef),
        valor_fee: form.valor_fee === "" ? null : Number(form.valor_fee),
        data_fechamento_previsto: form.data_fechamento_previsto || null,
        motivo_perda: form.motivo_perda?.trim() || null,
        notas: form.notas?.trim() || null,
      };
      delete payload.lead;
      delete payload.valor_total;
      delete payload.created_at;
      delete payload.updated_at;
      await onSave(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!oportunidade?.id || !onDelete) return;
    if (!confirm("Excluir esta oportunidade?")) return;
    await onDelete(oportunidade.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase">
            {oportunidade?.id ? "Editar Oportunidade" : "Nova Oportunidade"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Nome *</Label>
            <Input value={form.nome_oportunidade} onChange={(e) => set("nome_oportunidade", e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Etapa</Label>
            <Select value={form.etapa} onValueChange={(v) => set("etapa", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPORTUNIDADE_ETAPAS.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Fechamento previsto</Label>
            <Input type="date" value={form.data_fechamento_previsto || ""} onChange={(e) => set("data_fechamento_previsto", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Valor EF (entrada)</Label>
            <Input type="number" step="0.01" value={form.valor_ef} onChange={(e) => set("valor_ef", e.target.value)} placeholder="0,00" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Fee mensal</Label>
            <Input type="number" step="0.01" value={form.valor_fee} onChange={(e) => set("valor_fee", e.target.value)} placeholder="0,00" />
          </div>

          {form.etapa === "fechado_perdido" && (
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Motivo da perda</Label>
              <Textarea rows={2} value={form.motivo_perda} onChange={(e) => set("motivo_perda", e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          {oportunidade?.id && onDelete ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
              <Trash2 className="h-4 w-4 mr-1.5" /> Excluir
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving || !form.nome_oportunidade?.trim()}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
