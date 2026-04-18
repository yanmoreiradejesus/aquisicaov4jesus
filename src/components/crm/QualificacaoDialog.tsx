import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialValue?: string | null;
  onConfirm: (qualificacao: string) => Promise<void> | void;
}

export const QualificacaoDialog = ({ open, onOpenChange, initialValue, onConfirm }: Props) => {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue ?? "");
  }, [open, initialValue]);

  const submit = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await onConfirm(value.trim());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase">
            Qualificação obrigatória
          </DialogTitle>
          <DialogDescription>
            Antes de avançar para <strong>Reunião agendada</strong>, registre os detalhes da qualificação do lead (dor, contexto, budget, decisor, urgência etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="qualificacao" className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
            Detalhes da qualificação
          </Label>
          <Textarea
            id="qualificacao"
            autoFocus
            rows={8}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ex.: Dor principal — gerar leads B2B. Faturamento ~R$ 800k/mês. Já testou Meta Ads sem ROI. Decisor: CEO. Urgência alta, quer começar em 30 dias."
            className="text-sm resize-none"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!value.trim() || saving}>
            {saving ? "Salvando..." : "Confirmar e avançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
