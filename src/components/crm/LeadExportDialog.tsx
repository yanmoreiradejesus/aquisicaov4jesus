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

type ColDef = {
  key: string;
  label: string;
  get: (l: any) => any;
};

const fmtDate = (v: any) => {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
};

const fmtDateTime = (v: any) => {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR");
  } catch {
    return "";
  }
};

const etapaLabel = (id: string) => LEAD_ETAPAS.find((e) => e.id === id)?.label ?? id;

const COLUMNS: ColDef[] = [
  { key: "nome", label: "Nome", get: (l) => l.nome ?? "" },
  { key: "empresa", label: "Empresa", get: (l) => l.empresa ?? "" },
  { key: "cargo", label: "Cargo", get: (l) => l.cargo ?? "" },
  { key: "email", label: "E-mail", get: (l) => l.email ?? "" },
  { key: "telefone", label: "Telefone", get: (l) => formatPhone(l.telefone) || "" },
  { key: "instagram", label: "Instagram", get: (l) => l.instagram ?? "" },
  { key: "site", label: "Site", get: (l) => l.site ?? "" },
  { key: "etapa", label: "Etapa do CRM", get: (l) => etapaLabel(l.etapa) },
  { key: "temperatura", label: "Temperatura", get: (l) => l.temperatura ?? "" },
  { key: "qualificacao", label: "Qualificação", get: (l) => l.qualificacao ?? "" },
  { key: "tier", label: "Tier", get: (l) => l.tier ?? "" },
  { key: "urgencia", label: "Urgência", get: (l) => l.urgencia ?? "" },
  { key: "canal", label: "Canal", get: (l) => l.canal ?? "" },
  { key: "origem", label: "Origem", get: (l) => l.origem ?? "" },
  { key: "segmento", label: "Segmento", get: (l) => l.segmento ?? "" },
  { key: "faturamento", label: "Faturamento", get: (l) => l.faturamento ?? "" },
  { key: "tipo_produto", label: "Tipo de Produto", get: (l) => l.tipo_produto ?? "" },
  { key: "nome_produto", label: "Nome do Produto", get: (l) => l.nome_produto ?? "" },
  { key: "documento_empresa", label: "CNPJ/Documento", get: (l) => l.documento_empresa ?? "" },
  { key: "cidade", label: "Cidade", get: (l) => l.cidade ?? "" },
  { key: "estado", label: "Estado", get: (l) => l.estado ?? "" },
  { key: "pais", label: "País", get: (l) => l.pais ?? "" },
  { key: "responsavel", label: "Responsável", get: (l) => l.responsavel?.full_name ?? l.responsavel?.email ?? "" },
  { key: "arrematador", label: "Arrematador", get: (l) => l.arrematador ?? "" },
  { key: "valor_pago", label: "Valor Pago", get: (l) => (l.valor_pago != null ? l.valor_pago : "") },
  { key: "data_aquisicao", label: "Data de Aquisição", get: (l) => fmtDate(l.data_aquisicao) },
  { key: "data_criacao_origem", label: "Data Criação Origem", get: (l) => fmtDateTime(l.data_criacao_origem) },
  { key: "data_reuniao_agendada", label: "Reunião Agendada", get: (l) => fmtDateTime(l.data_reuniao_agendada) },
  { key: "data_reuniao_realizada", label: "Reunião Realizada", get: (l) => fmtDateTime(l.data_reuniao_realizada) },
  { key: "ultimo_contato_telefonico", label: "Último Contato Telefônico", get: (l) => fmtDateTime(l.ultimo_contato_telefonico) },
  { key: "motivo_desqualificacao", label: "Motivo Desqualificação", get: (l) => l.motivo_desqualificacao ?? "" },
  { key: "descricao", label: "Descrição", get: (l) => l.descricao ?? "" },
  { key: "notas", label: "Notas", get: (l) => l.notas ?? "" },
  { key: "created_at", label: "Criado em", get: (l) => fmtDateTime(l.created_at) },
  { key: "updated_at", label: "Atualizado em", get: (l) => fmtDateTime(l.updated_at) },
];

const DEFAULT_SELECTED = new Set(["nome", "empresa", "etapa", "telefone", "email", "responsavel"]);

const csvEscape = (val: string) => {
  if (/[",\n;]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
};

export const LeadExportDialog = ({ open, onOpenChange, leads }: Props) => {
  const [cols, setCols] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, DEFAULT_SELECTED.has(c.key)])),
  );
  const [excludePending, setExcludePending] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedCols = useMemo(() => COLUMNS.filter((c) => cols[c.key]), [cols]);
  const selectedCount = selectedCols.length;
  const allSelected = selectedCount === COLUMNS.length;

  const toggleAll = () => {
    const next = !allSelected;
    setCols(Object.fromEntries(COLUMNS.map((c) => [c.key, next])));
  };

  const handleExport = async () => {
    if (selectedCount === 0) {
      toast({ title: "Selecione ao menos uma coluna", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let exportable = [...leads];

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

      const header = selectedCols.map((c) => c.label);
      const rows = exportable.map((l) => selectedCols.map((c) => c.get(l)));

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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider uppercase">
            Exportar leads em CSV
          </DialogTitle>
          <DialogDescription>
            Escolha as colunas que deseja exportar e os filtros aplicáveis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                Colunas ({selectedCount}/{COLUMNS.length})
              </Label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {COLUMNS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-surface-1/40 hover:bg-surface-2/40 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={!!cols[c.key]}
                    onCheckedChange={(v) => setCols((s) => ({ ...s, [c.key]: !!v }))}
                  />
                  <span className="text-sm truncate">{c.label}</span>
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
          <Button onClick={handleExport} disabled={loading || selectedCount === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            {loading ? "Exportando..." : "Exportar CSV"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
