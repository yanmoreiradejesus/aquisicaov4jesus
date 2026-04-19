import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (motivo: string, razao: string) => Promise<void> | void;
}

const MOTIVOS = [
  "Adolescente/Criança",
  "Blocklist",
  "Cliente",
  "Cliente oculto",
  "Contatos inválidos",
  "Deixou de responder",
  "Duplicado",
  "Engano/Não Lembra",
  "Ex-cliente (detrator)",
  "Nunca respondeu",
  "Pessoa Física",
  "Sem autoridade",
  "Sem budget",
  "Sem interesse",
  "Sem timing",
  "Serviço fora de escopo",
  "SPAM",
];

export const DesqualificacaoDialog = ({ open, onOpenChange, onConfirm }: Props) => {
  const [motivo, setMotivo] = useState<string>("");
  const [razao, setRazao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMotivo("");
      setRazao("");
    }
  }, [open]);

  const submit = async () => {
    if (!motivo || !razao.trim()) return;
    setSaving(true);
    try {
      await onConfirm(motivo, razao.trim());
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
            Desqualificar lead
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo e descreva a razão. Ambos são obrigatórios para mover o lead para a coluna <strong>Desqualificado</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Motivo *
            </Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="razao" className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Razão da desqualificação *
            </Label>
            <Textarea
              id="razao"
              autoFocus
              rows={5}
              value={razao}
              onChange={(e) => setRazao(e.target.value)}
              placeholder="Descreva o contexto: o que foi dito, qual a objeção principal, o que aprendemos para próximos leads similares…"
              className="text-sm resize-none"
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!motivo || !razao.trim() || saving}
            variant="destructive"
          >
            {saving ? "Salvando..." : "Confirmar desqualificação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
