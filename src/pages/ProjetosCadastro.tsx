import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Plus, Search, X, Upload, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type Squad = "strikers" | "fenix" | "saber";
const SQUADS: Squad[] = ["strikers", "fenix", "saber"];

interface Row {
  projeto_id: string;
  account_id: string;
  cliente_nome: string | null;
  squad: Squad | null;
  growth_class_transcricao: string | null;
  growth_class_transcricao_reuniao: string | null;
  pre_growth_class_relatorio: string | null;
  growth_class_ia_relatorio: string | null;
  oportunidade_id: string | null;
  transcricao_reuniao: string | null;
  contrato_url: string | null;
  data_reuniao_agendada: string | null;
  data_reuniao_realizada: string | null;
  lead_id: string | null;
}

type Field =
  | "data_reuniao_agendada"
  | "transcricao_reuniao"
  | "contrato_url"
  | "resumo_gc"
  | "transcricao_gc"
  | "squad";

const FIELD_LABEL: Record<Field, string> = {
  data_reuniao_agendada: "Reunião agendada",
  transcricao_reuniao: "Transcrição da reunião",
  contrato_url: "Contrato anexado",
  resumo_gc: "Resumo GC",
  transcricao_gc: "Transcrição GC",
  squad: "Squad",
};

async function fetchRows(): Promise<Row[]> {
  const { data, error } = await (supabase as any)
    .from("crm_projetos")
    .select(
      "id, account_id, account:accounts(id, cliente_nome, squad, growth_class_transcricao, growth_class_transcricao_reuniao, pre_growth_class_relatorio, oportunidade:crm_oportunidades(id, transcricao_reuniao, contrato_url, lead:crm_leads(id, data_reuniao_agendada, data_reuniao_realizada))), growth_class_ia_relatorio"
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    projeto_id: p.id,
    account_id: p.account_id,
    cliente_nome: p.account?.cliente_nome ?? null,
    squad: p.account?.squad ?? null,
    growth_class_transcricao: p.account?.growth_class_transcricao ?? null,
    growth_class_transcricao_reuniao: p.account?.growth_class_transcricao_reuniao ?? null,
    pre_growth_class_relatorio: p.account?.pre_growth_class_relatorio ?? null,
    growth_class_ia_relatorio: p.growth_class_ia_relatorio ?? null,
    oportunidade_id: p.account?.oportunidade?.id ?? null,
    transcricao_reuniao: p.account?.oportunidade?.transcricao_reuniao ?? null,
    contrato_url: p.account?.oportunidade?.contrato_url ?? null,
    data_reuniao_agendada: p.account?.oportunidade?.lead?.data_reuniao_agendada ?? null,
    data_reuniao_realizada: p.account?.oportunidade?.lead?.data_reuniao_realizada ?? null,
    lead_id: p.account?.oportunidade?.lead?.id ?? null,
  }));
}

const StatusIcon = ({ ok }: { ok: boolean }) =>
  ok ? (
    <Check className="h-4 w-4 text-emerald-400" />
  ) : (
    <Clock className="h-4 w-4 text-muted-foreground/60" />
  );

const ProjetosCadastro = () => {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["projetos_cadastro"], queryFn: fetchRows });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ row: Row; field: Field } | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.cliente_nome ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["projetos_cadastro"] });

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">PE&G</p>
            <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-foreground tracking-[-0.02em]">
              Cadastro de projetos
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Checklist temporário. Clique em qualquer célula para editar. Alterações refletem imediatamente.
            </p>
          </div>
          <Button onClick={() => setNovoOpen(true)} className="rounded-xl">
            <Plus className="h-4 w-4 mr-1" /> Novo projeto
          </Button>
        </div>

        <div className="glass rounded-2xl p-2 mb-4 flex items-center gap-2 shadow-ios-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl border-transparent bg-surface-2/60"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-surface-1/60 shimmer" />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-surface-1/40 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="min-w-[200px]">Cliente</TableHead>
                  <TableHead>Reunião agendada</TableHead>
                  <TableHead>Transcrição reunião</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Resumo GC</TableHead>
                  <TableHead>Transcrição GC</TableHead>
                  <TableHead>Squad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const reuniaoDate = r.data_reuniao_agendada ?? r.data_reuniao_realizada;
                  const reuniaoFromRealizada = !r.data_reuniao_agendada && !!r.data_reuniao_realizada;
                  const hasReuniao = !!reuniaoDate;
                  const hasTrans = !!(r.transcricao_reuniao && r.transcricao_reuniao.trim());
                  const hasContrato = !!r.contrato_url;
                  const hasResumo = !!((r.growth_class_ia_relatorio ?? r.pre_growth_class_relatorio) ?? "").trim();
                  const hasTransGc = !!((r.growth_class_transcricao_reuniao ?? r.growth_class_transcricao ?? "").trim());
                  const hasSquad = !!r.squad;
                  const cellCls =
                    "cursor-pointer hover:bg-surface-2/40 transition-colors";

                  return (
                    <TableRow key={r.projeto_id} className="border-border/40">
                      <TableCell className="font-medium text-foreground">
                        {r.cliente_nome ?? "—"}
                      </TableCell>
                      <TableCell className={cellCls} onClick={() => setEditing({ row: r, field: "data_reuniao_agendada" })}>
                        <div className="flex items-center gap-2">
                          <StatusIcon ok={hasReuniao} />
                          <span className="text-xs text-muted-foreground">
                            {hasReuniao ? new Date(reuniaoDate!).toLocaleDateString("pt-BR") : "—"}
                            {reuniaoFromRealizada && <span className="ml-1 text-[10px] text-muted-foreground/70">(realizada)</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={cellCls} onClick={() => setEditing({ row: r, field: "transcricao_reuniao" })}>
                        <StatusIcon ok={hasTrans} />
                      </TableCell>
                      <TableCell className={cellCls} onClick={() => setEditing({ row: r, field: "contrato_url" })}>
                        <StatusIcon ok={hasContrato} />
                      </TableCell>
                      <TableCell className={cellCls} onClick={() => setEditing({ row: r, field: "resumo_gc" })}>
                        <StatusIcon ok={hasResumo} />
                      </TableCell>
                      <TableCell className={cellCls} onClick={() => setEditing({ row: r, field: "transcricao_gc" })}>
                        <StatusIcon ok={hasTransGc} />
                      </TableCell>
                      <TableCell className={cellCls} onClick={() => setEditing({ row: r, field: "squad" })}>
                        {hasSquad ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border bg-primary/10 text-primary border-primary/30 capitalize">
                            {r.squad}
                          </span>
                        ) : (
                          <StatusIcon ok={false} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                      Nenhum projeto encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      {editing && (
        <EditCellDialog
          row={editing.row}
          field={editing.field}
          onClose={() => setEditing(null)}
          onSaved={() => {
            invalidate();
            setEditing(null);
          }}
        />
      )}

      {novoOpen && (
        <NovoProjetoDialog
          onClose={() => setNovoOpen(false)}
          onCreated={() => {
            invalidate();
            setNovoOpen(false);
          }}
        />
      )}
    </div>
  );
};

/* ---------------- Edit cell ---------------- */

function EditCellDialog({ row, field, onClose, onSaved }: { row: Row; field: Field; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);

  const initial = (() => {
    switch (field) {
      case "data_reuniao_agendada":
        return row.data_reuniao_agendada ? row.data_reuniao_agendada.slice(0, 16) : "";
      case "transcricao_reuniao":
        return row.transcricao_reuniao ?? "";
      case "resumo_gc":
        return row.growth_class_ia_relatorio ?? row.pre_growth_class_relatorio ?? "";
      case "transcricao_gc":
        return row.growth_class_transcricao_reuniao ?? row.growth_class_transcricao ?? "";
      case "squad":
        return row.squad ?? "";
      case "contrato_url":
        return row.contrato_url ?? "";
    }
  })();

  const [value, setValue] = useState<string>(initial);
  const [file, setFile] = useState<File | null>(null);
  const [openingContrato, setOpeningContrato] = useState(false);

  const openContratoViaProxy = async () => {
    if (!row.oportunidade_id) {
      toast({ title: "Sem oportunidade vinculada", variant: "destructive" });
      return;
    }
    setOpeningContrato(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/download-contrato?oportunidade_id=${encodeURIComponent(row.oportunidade_id)}`;
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error(err.error ?? `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e: any) {
      toast({ title: "Não foi possível abrir o contrato", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setOpeningContrato(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (field === "data_reuniao_agendada") {
        if (!row.lead_id) throw new Error("Projeto sem lead vinculado. Não é possível editar a data.");
        const iso = value ? new Date(value).toISOString() : null;
        const { error } = await (supabase as any).from("crm_leads").update({ data_reuniao_agendada: iso }).eq("id", row.lead_id);
        if (error) throw error;
      } else if (field === "transcricao_reuniao") {
        if (!row.oportunidade_id) throw new Error("Projeto sem oportunidade vinculada.");
        const { error } = await (supabase as any)
          .from("crm_oportunidades")
          .update({ transcricao_reuniao: value || null })
          .eq("id", row.oportunidade_id);
        if (error) throw error;
      } else if (field === "resumo_gc") {
        const { error } = await (supabase as any)
          .from("accounts")
          .update({ pre_growth_class_relatorio: value || null, pre_growth_class_gerado_em: value ? new Date().toISOString() : null })
          .eq("id", row.account_id);
        if (error) throw error;
      } else if (field === "transcricao_gc") {
        const { error } = await (supabase as any)
          .from("accounts")
          .update({ growth_class_transcricao_reuniao: value || null })
          .eq("id", row.account_id);
        if (error) throw error;
      } else if (field === "squad") {
        const { error } = await (supabase as any)
          .from("accounts")
          .update({ squad: value || null })
          .eq("id", row.account_id);
        if (error) throw error;
      } else if (field === "contrato_url") {
        if (!row.oportunidade_id) throw new Error("Projeto sem oportunidade vinculada.");
        let url = value || null;
        if (file) {
          const path = `${row.account_id}/${Date.now()}-${file.name}`;
          const up = await supabase.storage.from("contratos-assinados").upload(path, file, { upsert: true });
          if (up.error) throw up.error;
          const { data: pub } = supabase.storage.from("contratos-assinados").getPublicUrl(path);
          url = pub.publicUrl;
        }
        const { error } = await (supabase as any).from("crm_oportunidades").update({ contrato_url: url }).eq("id", row.oportunidade_id);
        if (error) throw error;
      }
      toast({ title: "Atualizado" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setValue("");
    setFile(null);
    // save() will run after value clears via user pressing save; but be explicit here:
    setTimeout(save, 0);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {FIELD_LABEL[field]} — {row.cliente_nome ?? "Projeto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {field === "data_reuniao_agendada" && (
            <Input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          {(field === "transcricao_reuniao" || field === "resumo_gc" || field === "transcricao_gc") && (
            <Textarea rows={12} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Cole ou digite o conteúdo..." />
          )}
          {field === "squad" && (
            <Select value={value} onValueChange={setValue}>
              <SelectTrigger><SelectValue placeholder="Selecionar squad" /></SelectTrigger>
              <SelectContent>
                {SQUADS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {field === "contrato_url" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Link do contrato</label>
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://..." />
              </div>
              <div className="text-center text-xs text-muted-foreground">— ou —</div>
              <label className="flex items-center gap-2 rounded-xl border border-dashed border-border/60 p-3 cursor-pointer hover:bg-surface-2/40">
                <Upload className="h-4 w-4" />
                <span className="text-sm">{file ? file.name : "Enviar arquivo (PDF)"}</span>
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
              {row.contrato_url && (
                <button
                  type="button"
                  onClick={openContratoViaProxy}
                  disabled={openingContrato}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
                >
                  <ExternalLink className="h-3 w-3" />
                  {openingContrato ? "Abrindo…" : "Abrir contrato atual"}
                </button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {initial && (
            <Button variant="ghost" onClick={remove} disabled={saving} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            <Check className="h-4 w-4 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Novo projeto ---------------- */

function NovoProjetoDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState("");
  const [squad, setSquad] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nome.trim()) {
      toast({ title: "Informe o nome do cliente", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Cria account com onboarding já concluído → trigger cria o crm_projetos automaticamente
      const { error } = await (supabase as any).from("accounts").insert({
        cliente_nome: nome.trim(),
        squad: squad || null,
        onboarding_status: "concluida",
        data_inicio_contrato: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      toast({ title: "Projeto criado" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Cliente</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Squad (opcional)</label>
            <Select value={squad} onValueChange={setSquad}>
              <SelectTrigger><SelectValue placeholder="Selecionar squad" /></SelectTrigger>
              <SelectContent>
                {SQUADS.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O projeto é criado sem vínculo com o CRM. Você poderá preencher reunião agendada, transcrição, contrato e resumos direto na listagem.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjetosCadastro;
