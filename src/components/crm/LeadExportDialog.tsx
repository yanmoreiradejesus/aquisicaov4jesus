import { useMemo, useState } from "react";
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

type ColKey = "empresa" | "nome" | "etapa" | "telefone";

const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "empresa", label: "Empresa" },
  { key: "nome", label: "Nome" },
  { key: "etapa", label: "Etapa do CRM" },
  { key: "telefone", label: "Telefone" },
];

const etapaLabel = (id: string) => LEAD_ETAPAS.find((e) => e.id === id)?.label ?? id;

const csvEscape = (val: string) => {
  if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
};

export const LeadExportDialog = ({ open, onOpenChange, leads }: Props) => {
  const [cols, setCols] = useState<Record<ColKey, boolean>>({
    empresa: true,
    nome: true,
    etapa: true,
    telefone: true,
  });
  const [excludePending, setExcludePending] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedKeys = useMemo(() => COLUMNS.filter((c) => cols[c.key]).map((c) => c.key), [cols]);

  const handleExport = async () => {
    if (selectedKeys.length === 0) {
      toast({ title: "Selecione ao menos uma coluna", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let exportable = [...leads];

      if (excludePending) {
        // Buscar leads com tarefas pendentes (concluida=false, tipo=tarefa)
        const { data, error } = await supabase
          .from("crm_atividades" as any)
          .select("lead_id")
          .eq("tipo", "tarefa")
          .eq("concluida", false);
        if (error) throw error;
        const pendingIds = new Set((data ?? []).map((a: any) => a.lead_id).filter(Boolean));
        exportable = exportable.filter((l) => !pendingIds.has(l.id));
      }

      const header = selectedKeys.map((k) => COLUMNS.find((c) => c.key === k)!.label);
      const rows = exportable.map((l) =>
        selectedKeys.map((k) => {
          if (k === "etapa") return etapaLabel(l.etapa);
          if (k === "telefone") return formatPhone(l.telefone) || "";
          return l[k] ?? "";
        }),
      );

      const csv = [header, ...rows]
        .map((r) => r.map((v) => csvEscape(String(v))).join(","))
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase">
            Exportar leads em CSV
          </DialogTitle>
          <DialogDescription>
            Escolha as colunas que deseja exportar e os filtros aplicáveis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Colunas
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-surface-1/40 hover:bg-surface-2/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={cols[c.key]}
                    onCheckedChange={(v) => setCols((s) => ({ ...s, [c.key]: !!v }))}
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Filtros
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
          <Button onClick={handleExport} disabled={loading || selectedKeys.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            {loading ? "Exportando..." : "Exportar CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
