import { useMemo, useState } from "react";
import { Search, DollarSign } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCobrancas,
  COBRANCA_STATUS_LABEL,
  COBRANCA_STATUS_COLOR,
  COBRANCA_TIPO_LABEL,
  type CobrancaStatus,
} from "@/hooks/useCobrancas";
import { usePersistedState } from "@/hooks/usePersistedState";
import AFaturarDialog, { type AFaturarRow } from "@/components/admin/AFaturarDialog";

const fmtBRL = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtDate = (v?: string | null) =>
  !v ? "—" : new Date(v + (v.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");

const STATUS_OPTS: (CobrancaStatus | "all")[] = ["all", "pendente", "pago", "atrasado", "cancelado"];

function useAFaturar() {
  return useQuery({
    queryKey: ["accounts", "a-faturar"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("accounts")
        .select(
          "id, cliente_nome, oportunidade_id, created_at, forma_pagamento, qtd_parcelas, modelo_contrato, forma_pagamento_ef, qtd_parcelas_ef, valor_ef_override, dia_vencimento_primeiro_ef, dia_vencimento_demais_ef, forma_pagamento_recorrente, qtd_parcelas_recorrente, valor_fee_override, dia_vencimento_primeiro_recorrente, dia_vencimento_demais_recorrente, oportunidade:crm_oportunidades(id, contrato_url, valor_ef, valor_fee)"
        )
        .eq("faturamento_status", "a_faturar")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

const AdminFinanceiro = () => {
  const [view, setView] = usePersistedState<"faturado" | "a_faturar">("admin:financeiro:view", "faturado");
  const { data: cobrancas = [], isLoading } = useCobrancas();
  const { data: aFaturar = [], isLoading: loadingAFaturar } = useAFaturar();
  const qc = useQueryClient();

  const [search, setSearch] = usePersistedState<string>("admin:financeiro:search", "");
  const [statusFilter, setStatusFilter] = usePersistedState<string>("admin:financeiro:status", "all");
  const [tipoFilter, setTipoFilter] = usePersistedState<string>("admin:financeiro:tipo", "all");
  const [dialogRow, setDialogRow] = useState<AFaturarRow | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows = useMemo(() => {
    return cobrancas.map((c) => {
      let status = c.status;
      if (status === "pendente" && c.vencimento) {
        const venc = new Date(c.vencimento + "T00:00:00");
        if (venc < today) status = "atrasado" as CobrancaStatus;
      }
      return { ...c, status };
    });
  }, [cobrancas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (tipoFilter !== "all" && c.tipo !== tipoFilter) return false;
      if (!q) return true;
      return [c.account?.cliente_nome, c.oportunidade?.nome_oportunidade, c.nota_fiscal, c.notas]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, tipoFilter]);

  const kpis = useMemo(() => {
    const acc = { total: 0, pago: 0, pendente: 0, atrasado: 0 };
    for (const c of rows) {
      const v = Number(c.valor) || 0;
      acc.total += v;
      if (c.status === "pago") acc.pago += v;
      else if (c.status === "pendente") acc.pendente += v;
      else if (c.status === "atrasado") acc.atrasado += v;
    }
    return acc;
  }, [rows]);

  const filteredAFaturar = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return aFaturar;
    return aFaturar.filter((a: any) => a.cliente_nome?.toLowerCase().includes(q));
  }, [aFaturar, search]);

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
              <p className="text-sm text-muted-foreground">
                Cobranças geradas após validação do financeiro.
              </p>
            </div>
          </div>
          <div className="inline-flex rounded-xl border border-border/60 bg-card/40 p-1">
            <button
              onClick={() => setView("faturado")}
              className={`px-4 py-1.5 text-sm rounded-lg transition ${
                view === "faturado" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Faturado
            </button>
            <button
              onClick={() => setView("a_faturar")}
              className={`px-4 py-1.5 text-sm rounded-lg transition inline-flex items-center gap-2 ${
                view === "a_faturar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              A faturar
              {aFaturar.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${view === "a_faturar" ? "bg-primary-foreground/20" : "bg-amber-500/20 text-amber-300"}`}>
                  {aFaturar.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {view === "faturado" && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <KpiCard label="Total contratado" value={fmtBRL(kpis.total)} />
              <KpiCard label="Pago" value={fmtBRL(kpis.pago)} tone="emerald" />
              <KpiCard label="A receber" value={fmtBRL(kpis.pendente)} tone="amber" />
              <KpiCard label="Atrasado" value={fmtBRL(kpis.atrasado)} tone="red" />
            </div>

            <div className="flex flex-col md:flex-row gap-2 md:items-center mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente, contrato, NF..."
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "Todos os status" : COBRANCA_STATUS_LABEL[s as CobrancaStatus]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="fee_setup">Fee setup</SelectItem>
                  <SelectItem value="fee_recorrente">Fee recorrente</SelectItem>
                  <SelectItem value="ef">EF</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma cobrança encontrada.</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.account?.cliente_nome || "—"}
                          {c.oportunidade?.nome_oportunidade ? (
                            <div className="text-[11px] text-muted-foreground">{c.oportunidade.nome_oportunidade}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{COBRANCA_TIPO_LABEL[c.tipo]}</TableCell>
                        <TableCell>{c.parcela_num && c.parcela_total ? `${c.parcela_num}/${c.parcela_total}` : "—"}</TableCell>
                        <TableCell>{fmtDate(c.vencimento)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtBRL(c.valor)}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${COBRANCA_STATUS_COLOR[c.status]}`}>
                            {COBRANCA_STATUS_LABEL[c.status]}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {c.data_pagamento ? fmtDate(c.data_pagamento) : "—"}
                          {c.forma_pagamento ? <div className="text-[11px]">{c.forma_pagamento}</div> : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {view === "a_faturar" && (
          <>
            <div className="flex flex-col md:flex-row gap-2 md:items-center mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por cliente..."
                  className="pl-9"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">EF</TableHead>
                    <TableHead className="text-right">Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingAFaturar ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                    </TableRow>
                  ) : filteredAFaturar.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        Nenhum contrato aguardando faturamento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAFaturar.map((a: any) => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() =>
                          setDialogRow({
                            id: a.id,
                            cliente_nome: a.cliente_nome,
                            oportunidade_id: a.oportunidade?.id ?? null,
                            contrato_url: a.oportunidade?.contrato_url ?? null,
                            valor_ef: a.oportunidade?.valor_ef ?? null,
                            valor_fee: a.oportunidade?.valor_fee ?? null,
                            modelo_contrato: a.modelo_contrato ?? null,
                            forma_pagamento_ef: a.forma_pagamento_ef ?? null,
                            qtd_parcelas_ef: a.qtd_parcelas_ef ?? null,
                            valor_ef_override: a.valor_ef_override ?? null,
                            dia_vencimento_primeiro_ef: (a as any).dia_vencimento_primeiro_ef ?? null,
                            dia_vencimento_demais_ef: (a as any).dia_vencimento_demais_ef ?? null,
                            forma_pagamento_recorrente: a.forma_pagamento_recorrente ?? null,
                            qtd_parcelas_recorrente: a.qtd_parcelas_recorrente ?? null,
                            valor_fee_override: a.valor_fee_override ?? null,
                            dia_vencimento_primeiro_recorrente: (a as any).dia_vencimento_primeiro_recorrente ?? null,
                            dia_vencimento_demais_recorrente: (a as any).dia_vencimento_demais_recorrente ?? null,
                          })
                        }
                      >
                        <TableCell className="font-medium">{a.cliente_nome || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmtBRL(a.oportunidade?.valor_ef)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtBRL(a.oportunidade?.valor_fee)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <AFaturarDialog
          open={!!dialogRow}
          onOpenChange={(v) => !v && setDialogRow(null)}
          row={dialogRow}
          onValidated={() => {
            qc.invalidateQueries({ queryKey: ["accounts", "a-faturar"] });
            qc.invalidateQueries({ queryKey: ["cobrancas"] });
          }}
        />
      </main>
    </div>
  );
};

const KpiCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "red";
}) => {
  const toneCls =
    tone === "emerald" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : tone === "red" ? "text-red-300" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
};

export default AdminFinanceiro;
