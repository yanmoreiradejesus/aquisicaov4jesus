import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface QualificacaoPayload {
  qualificacao: string;
  temperatura: string;
  data_reuniao_agendada: string; // ISO
  reuniao_local?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialValue?: string | null;
  initialTemperatura?: string | null;
  initialDataReuniao?: string | null;
  initialLocal?: string | null;
  onConfirm: (payload: QualificacaoPayload) => Promise<void> | void;
}

const TEMPERATURAS = [
  { id: "Quente", emoji: "🔥", classes: "border-red-500/40 bg-red-500/10 text-red-300", active: "border-red-500 bg-red-500/20 text-red-200" },
  { id: "Morno", emoji: "🌤️", classes: "border-amber-500/40 bg-amber-500/10 text-amber-300", active: "border-amber-500 bg-amber-500/20 text-amber-200" },
  { id: "Frio", emoji: "❄️", classes: "border-sky-500/40 bg-sky-500/10 text-sky-300", active: "border-sky-500 bg-sky-500/20 text-sky-200" },
];

export const QualificacaoDialog = ({
  open,
  onOpenChange,
  initialValue,
  initialTemperatura,
  initialDataReuniao,
  initialLocal,
  onConfirm,
}: Props) => {
  const [value, setValue] = useState("");
  const [temperatura, setTemperatura] = useState<string>("");
  const [dataReuniao, setDataReuniao] = useState<Date | undefined>(undefined);
  const [hora, setHora] = useState<string>("");
  const [local, setLocal] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? "");
      setTemperatura(initialTemperatura ?? "");
      if (initialDataReuniao) {
        const d = new Date(initialDataReuniao);
        setDataReuniao(d);
        setHora(format(d, "HH:mm"));
      } else {
        setDataReuniao(undefined);
        setHora("");
      }
      setLocal(initialLocal ?? "");
    }
  }, [open, initialValue, initialTemperatura, initialDataReuniao, initialLocal]);

  const buildIso = (): string | null => {
    if (!dataReuniao || !hora) return null;
    const [hh, mm] = hora.split(":").map(Number);
    if (isNaN(hh) || isNaN(mm)) return null;
    const d = new Date(dataReuniao);
    d.setHours(hh, mm, 0, 0);
    return d.toISOString();
  };

  const iso = buildIso();
  const canSubmit = !!value.trim() && !!temperatura && !!iso;

  const submit = async () => {
    if (!canSubmit || !iso) return;
    setSaving(true);
    try {
      await onConfirm({
        qualificacao: value.trim(),
        temperatura,
        data_reuniao_agendada: iso,
        reuniao_local: local.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase">
            Qualificação + reunião
          </DialogTitle>
          <DialogDescription>
            Antes de avançar para <strong>Reunião agendada</strong>, registre a qualificação, temperatura e os dados da reunião.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Temperatura */}
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

          {/* Qualificação */}
          <div className="space-y-2">
            <Label htmlFor="qualificacao" className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Detalhes da qualificação *
            </Label>
            <Textarea
              id="qualificacao"
              autoFocus
              rows={5}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ex.: Dor principal — gerar leads B2B. Faturamento ~R$ 800k/mês. Decisor: CEO. Urgência alta."
              className="text-sm resize-none"
            />
          </div>

          {/* Data + Hora reunião */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Data da reunião *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9",
                      !dataReuniao && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataReuniao ? format(dataReuniao, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataReuniao}
                    onSelect={setDataReuniao}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hora-reuniao" className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Horário *
              </Label>
              <Input
                id="hora-reuniao"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Local / link opcional */}
          <div className="space-y-2">
            <Label htmlFor="local-reuniao" className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Local ou link da reunião <span className="opacity-60">(opcional)</span>
            </Label>
            <Input
              id="local-reuniao"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Google Meet, Zoom, endereço..."
              className="h-9"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!canSubmit || saving}>
            {saving ? "Salvando..." : "Confirmar e avançar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
