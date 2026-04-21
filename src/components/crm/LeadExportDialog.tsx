import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { LEAD_ETAPAS } from "@/hooks/useCrmLeads";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone } from "@/lib/ddd";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leads: any[];
}

const etapaLabel = (id: string) => LEAD_ETAPAS.find((e) => e.id === id)?.label ?? id;

const FIXED_COLUMNS: { label: string; get: (l: any) => string }[] = [
  { label: "Empresa", get: (l) => l.empresa ?? "" },
  { label: "Nome", get: (l) => l.nome ?? "" },
  { label: "Telefone", get: (l) => formatPhone(l.telefone) || "" },
  { label: "Etapa do CRM", get: (l) => etapaLabel(l.etapa) },
];

const csvEscape = (val: string) => {
  if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
};

export const LeadExportDialog = ({ open, onOpenChange, leads }: Props) => {
  const [etapas, setEtapas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LEAD_ETAPAS.map((e) => [e.id, true])),
  );
  const [excludePending, setExcludePending] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const allEtapasSelected = Object.values(etapas).every(Boolean);
  const selectedEtapasCount = Object.values(etapas).filter(Boolean).length;

  const toggleAllEtapas = () => {
    const next = !allEtapasSelected;
    setEtapas(Object.fromEntries(LEAD_ETAPAS.map((e) => [e.id, next])));
  };

  const handleExport = async () => {
    if (selectedEtapasCount === 0) {
      toast({ title: "Selecione ao menos uma etapa", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const allowedEtapas = new Set(
        Object.entries(etapas).filter(([, v]) => v).map(([k]) => k),
      );
      let exportable = leads.filter((l) => allowedEtapas.has(l.etapa));

      if (excludePending) {
        const { data, error } = await supabase
          .from("crm_atividades" as any)
          .select("lead_id")
          .eq("tipo", "tarefa")
          .eq("concluida", false);
        if (error) throw error;
        const pendingIds = new Set((data ?? []).map((a: any) => a.lead_id).filter(Boolean));
        exportable = exportable.filter((l) => !pendingIds.has(l.id));
      }

      const header = FIXED_COLUMNS.map((c) => c.label);
      const rows = exportable.map((l) => FIXED_COLUMNS.map((c) => c.get(l)));

      const csv = [header, ...rows]
        .map((r) => r.map((v) => csvEscape(String(v ?? ""))).join(","))
        .join("\n");

      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: `${rows.length} lead(s) exportado(s)` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase">
            Exportar leads em CSV
          </DialogTitle>
          <DialogDescription>
            Serão exportadas as colunas: Empresa, Nome, Telefone e Etapa do CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Etapas do CRM ({selectedEtapasCount}/{LEAD_ETAPAS.length})
              </Label>
              <button
                type="button"
                onClick={toggleAllEtapas}
                className="text-xs text-primary hover:underline"
              >
                {allEtapasSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LEAD_ETAPAS.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-surface-1/40 hover:bg-surface-2/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={!!etapas[e.id]}
                    onCheckedChange={(v) => setEtapas((s) => ({ ...s, [e.id]: !!v }))}
                  />
                  <span className="text-sm truncate">{e.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Filtros adicionais
            </Label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-surface-1/40 hover:bg-surface-2/40 cursor-pointer transition-colors">
              <Checkbox
                checked={excludePending}
                onCheckedChange={(v) => setExcludePending(!!v)}
              />
              <span className="text-sm">Excluir leads com tarefa pendente</span>
            </label>
          </div>

          <div className="text-xs text-muted-foreground">
            Total no kanban atual: <span className="text-foreground font-medium">{leads.length}</span> lead(s)
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={loading || selectedEtapasCount === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            {loading ? "Exportando..." : "Exportar CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
