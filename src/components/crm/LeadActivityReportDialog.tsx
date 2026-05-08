import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface AtividadeRow {
  id: string;
  created_at: string;
  tipo: string;
  descricao: string | null;
  titulo: string | null;
  usuario_id: string | null;
  lead_id: string | null;
  data_agendada: string | null;
  concluida: boolean;
}

interface LeadLite { id: string; nome: string; empresa: string | null }

const todayISO = () => new Date().toISOString().slice(0, 10);

export const LeadActivityReportDialog = ({ open, onOpenChange }: Props) => {
  const { profiles } = useProfilesList();
  const [dateFrom, setDateFrom] = useState<string>(todayISO());
  const [dateTo, setDateTo] = useState<string>(todayISO());
  const [usuarioId, setUsuarioId] = useState<string>("all");
  const [rows, setRows] = useState<AtividadeRow[]>([]);
  const [leads, setLeads] = useState<Record<string, LeadLite>>({});
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const start = new Date(dateFrom); start.setHours(0, 0, 0, 0);
      const end = new Date(dateTo); end.setHours(23, 59, 59, 999);
      let q = supabase
        .from("crm_atividades")
        .select("id, created_at, tipo, descricao, titulo, usuario_id, lead_id, data_agendada, concluida")
        .not("lead_id", "is", null)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);
      if (usuarioId !== "all") q = q.eq("usuario_id", usuarioId);
      const { data } = await q;
      const list = (data ?? []) as AtividadeRow[];
      setRows(list);

      const leadIds = Array.from(new Set(list.map((r) => r.lead_id).filter(Boolean))) as string[];
      if (leadIds.length) {
        const { data: leadData } = await supabase
          .from("crm_leads")
          .select("id, nome, empresa")
          .in("id", leadIds);
        const map: Record<string, LeadLite> = {};
        (leadData ?? []).forEach((l: any) => (map[l.id] = l));
        setLeads(map);
      } else {
        setLeads({});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateFrom, dateTo, usuarioId]);

  const userLabel = (id: string | null) => {
    if (!id) return "—";
    const p = profiles.find((x) => x.id === id);
    return p ? profileLabel(p) : id.slice(0, 8);
  };

  const tipoLabel = (t: string) =>
    ({
      criacao: "Criação",
      mudanca_etapa: "Mudança de etapa",
      ligacao: "Ligação",
      whatsapp: "WhatsApp",
      email: "E-mail",
      reuniao: "Reunião",
      tarefa: "Tarefa",
      nota: "Nota",
    } as Record<string, string>)[t] || t;

  const exportCsv = () => {
    const header = ["Data/Hora", "Usuário", "Tipo", "Lead", "Empresa", "Descrição"];
    const lines = rows.map((r) => {
      const lead = r.lead_id ? leads[r.lead_id] : null;
      return [
        new Date(r.created_at).toLocaleString("pt-BR"),
        userLabel(r.usuario_id),
        tipoLabel(r.tipo),
        lead?.nome ?? "",
        lead?.empresa ?? "",
        (r.titulo || r.descricao || "").replace(/\s+/g, " "),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";");
    });
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atividades_${dateFrom}_a_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = useMemo(() => {
    const byUser: Record<string, number> = {};
    rows.forEach((r) => {
      const k = userLabel(r.usuario_id);
      byUser[k] = (byUser[k] ?? 0) + 1;
    });
    return byUser;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, profiles]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl tracking-wider uppercase flex items-center gap-2">
            <Activity className="h-5 w-5" /> Relatório de Atividades
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 py-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Usuário</Label>
            <Select value={usuarioId} onValueChange={setUsuarioId}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Todos os usuários</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span><strong className="text-foreground">{rows.length}</strong> atividade(s)</span>
            {Object.entries(grouped).slice(0, 6).map(([u, n]) => (
              <span key={u} className="px-2 py-0.5 rounded-full bg-surface-2/60">
                {u}: <strong className="text-foreground">{n}</strong>
              </span>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-md border border-border">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              Nenhuma atividade no período selecionado.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-surface-2/60 sticky top-0">
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Data/Hora</th>
                  <th className="px-3 py-2 font-semibold">Usuário</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Lead</th>
                  <th className="px-3 py-2 font-semibold">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const lead = r.lead_id ? leads[r.lead_id] : null;
                  return (
                    <tr key={r.id} className="hover:bg-surface-2/30">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{userLabel(r.usuario_id)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                          {tipoLabel(r.tipo)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {lead ? (
                          <div className="min-w-0">
                            <div className="font-medium truncate">{lead.nome}</div>
                            {lead.empresa && <div className="text-muted-foreground truncate">{lead.empresa}</div>}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.titulo || r.descricao || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
