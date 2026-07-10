import { useMemo, useState } from "react";
import { Search, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
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

const fmtBRL = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));

const fmtDate = (v?: string | null) =>
  !v ? "—" : new Date(v + (v.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");

const STATUS_OPTS: (CobrancaStatus | "all")[] = ["all", "pendente", "pago", "atrasado", "cancelado"];

const AdminFinanceiro = () => {
  const { data: cobrancas = [], isLoading } = useCobrancas();
  const [search, setSearch] = usePersistedState<string>("admin:financeiro:search", "");
  const [statusFilter, setStatusFilter] = usePersistedState<string>("admin:financeiro:status", "all");
  const [tipoFilter, setTipoFilter] = usePersistedState<string>("admin:financeiro:tipo", "all");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Reclassifica atrasados on-the-fly (para não depender de job)
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

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground">
              Cobranças geradas automaticamente a partir dos contratos fechados.
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Total contratado" value={fmtBRL(kpis.total)} />
          <KpiCard label="Pago" value={fmtBRL(kpis.pago)} tone="emerald" />
          <KpiCard label="A receber" value={fmtBRL(kpis.pendente)} tone="amber" />
          <KpiCard label="Atrasado" value={fmtBRL(kpis.atrasado)} tone="red" />
        </div>

        {/* Filtros */}
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

        {/* Tabela */}
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma cobrança encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.account?.cliente_nome || "—"}
                      {c.oportunidade?.nome_oportunidade ? (
                        <div className="text-[11px] text-muted-foreground">
                          {c.oportunidade.nome_oportunidade}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{COBRANCA_TIPO_LABEL[c.tipo]}</TableCell>
                    <TableCell>
                      {c.parcela_num && c.parcela_total
                        ? `${c.parcela_num}/${c.parcela_total}`
                        : "—"}
                    </TableCell>
                    <TableCell>{fmtDate(c.vencimento)}</TableCell>
                    <TableCell className="text-right font-mono">{fmtBRL(c.valor)}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${COBRANCA_STATUS_COLOR[c.status]}`}
                      >
                        {COBRANCA_STATUS_LABEL[c.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.data_pagamento ? fmtDate(c.data_pagamento) : "—"}
                      {c.forma_pagamento ? (
                        <div className="text-[11px]">{c.forma_pagamento}</div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "red"
          ? "text-red-300"
          : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
};

export default AdminFinanceiro;
