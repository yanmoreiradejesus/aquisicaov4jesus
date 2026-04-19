import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialValue?: string | null;
  initialTemperatura?: string | null;
  onConfirm: (qualificacao: string, temperatura: string) => Promise<void> | void;
}

const TEMPERATURAS = [
  { id: "Quente", emoji: "🔥", classes: "border-red-500/40 bg-red-500/10 text-red-300", active: "border-red-500 bg-red-500/20 text-red-200" },
  { id: "Morno", emoji: "🌤️", classes: "border-amber-500/40 bg-amber-500/10 text-amber-300", active: "border-amber-500 bg-amber-500/20 text-amber-200" },
  { id: "Frio", emoji: "❄️", classes: "border-sky-500/40 bg-sky-500/10 text-sky-300", active: "border-sky-500 bg-sky-500/20 text-sky-200" },
];

export const QualificacaoDialog = ({ open, onOpenChange, initialValue, initialTemperatura, onConfirm }: Props) => {
  const [value, setValue] = useState("");
  const [temperatura, setTemperatura] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? "");
      setTemperatura(initialTemperatura ?? "");
    }
  }, [open, initialValue, initialTemperatura]);

  const submit = async () => {
    if (!value.trim() || !temperatura) return;
    setSaving(true);
    try {
      await onConfirm(value.trim(), temperatura);
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
            Antes de avançar para <strong>Reunião agendada</strong>, registre os detalhes da qualificação e a temperatura do lead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Temperatura *
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPERATURAS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemperatura(t.id)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-all",
                    temperatura === t.id ? t.active : t.classes,
                    temperatura === t.id ? "ring-2 ring-offset-2 ring-offset-background" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <span className="mr-1">{t.emoji}</span>
                  {t.id}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qualificacao" className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Detalhes da qualificação *
            </Label>
            <Textarea
              id="qualificacao"
              autoFocus
              rows={7}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ex.: Dor principal — gerar leads B2B. Faturamento ~R$ 800k/mês. Já testou Meta Ads sem ROI. Decisor: CEO. Urgência alta, quer começar em 30 dias."
              className="text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!value.trim() || !temperatura || saving}>
            {saving ? "Salvando..." : "Confirmar e avançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
