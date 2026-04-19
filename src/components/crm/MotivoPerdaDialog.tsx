import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (motivo: string) => Promise<void> | void;
}

const MOTIVOS = [
  "Sem budget",
  "Sem timing",
  "Concorrente",
  "Não respondeu",
  "Sem fit",
  "Decisão interna negativa",
  "Preço",
  "Outro",
];

export const MotivoPerdaDialog = ({ open, onOpenChange, onConfirm }: Props) => {
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setMotivo(""); setDetalhe(""); }
  }, [open]);

  const submit = async () => {
    if (!motivo) return;
    setSaving(true);
    try {
      const txt = detalhe.trim() ? `${motivo} — ${detalhe.trim()}` : motivo;
      await onConfirm(txt);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase">Marcar como perdida</DialogTitle>
          <DialogDescription>Selecione o motivo da perda da oportunidade.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">Detalhes (opcional)</Label>
            <Textarea rows={4} value={detalhe} onChange={(e) => setDetalhe(e.target.value)} placeholder="Contexto, aprendizado..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={!motivo || saving} variant="destructive">
            {saving ? "Salvando..." : "Confirmar perda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
