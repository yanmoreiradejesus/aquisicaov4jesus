import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Texto mostrado no header */
  title?: string;
  description?: string;
  initialValue?: string | null;
  onConfirm: (responsavelId: string) => Promise<void> | void;
}

/**
 * Dialog mínimo para escolher o closer responsável.
 * Usado quando lead vai para "Reunião agendada" ou "Reunião realizada" sem responsável.
 * Lista apenas usuários do departamento Receitas.
 */
export const ResponsavelPickerDialog = ({
  open,
  onOpenChange,
  title = "Selecione o closer responsável",
  description = "Antes de avançar, defina quem é o closer responsável por esta reunião.",
  initialValue,
  onConfirm,
}: Props) => {
  const { profiles } = useProfilesList({ departamento: "Receitas" });
  const [value, setValue] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(initialValue ?? "");
  }, [open, initialValue]);

  const submit = async () => {
    if (!value) return;
    setSaving(true);
    try {
      await onConfirm(value);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label className="text-xs">Closer responsável *</Label>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um usuário de Receitas" />
            </SelectTrigger>
            <SelectContent>
              {profiles.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum usuário de Receitas disponível
                </div>
              ) : (
                profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {profileLabel(p)}
                    {p.cargo ? <span className="text-muted-foreground"> · {p.cargo}</span> : null}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!value || saving}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
