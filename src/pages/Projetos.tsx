import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FolderKanban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjetos, agregarFinanceiro, PROJETO_STATUS_LABEL, PROJETO_STATUS_COLOR, type ProjetoStatus } from "@/hooks/useProjetos";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";
import { usePersistedState } from "@/hooks/usePersistedState";

const fmtBRL = (v?: number | null) =>
  v == null || v === 0
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v));

const fmtDate = (v?: string | null) => (!v ? "—" : new Date(v).toLocaleDateString("pt-BR"));

const STATUS_OPTS: (ProjetoStatus | "all")[] = ["all", "ativo", "em_risco", "pausado", "encerrado", "churn"];

const Projetos = () => {
  const navigate = useNavigate();
  const { data: projetos = [], isLoading } = useProjetos();
  const { profiles } = useProfilesList();

  const [search, setSearch] = usePersistedState<string>("crm:projetos:search", "");
  const [statusFilter, setStatusFilter] = usePersistedState<string>("crm:projetos:status", "all");
  const [amFilter, setAmFilter] = usePersistedState<string>("crm:projetos:am", "all");

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projetos.filter((p) => {
      if (statusFilter !== "all" && p.status_projeto !== statusFilter) return false;
      if (amFilter !== "all" && p.account?.account_manager_id !== amFilter) return false;
      if (!q) return true;
      const opp = p.account?.oportunidade;
      return [p.nome, p.account?.cliente_nome, opp?.nome_oportunidade]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [projetos, search, statusFilter, amFilter]);

  const kpis = useMemo(() => {
    const c = { total: projetos.length, ativos: 0, em_risco: 0, encerrados: 0 };
    for (const p of projetos) {
      if (p.status_projeto === "ativo") c.ativos++;
      else if (p.status_projeto === "em_risco") c.em_risco++;
      else if (p.status_projeto === "encerrado" || p.status_projeto === "churn") c.encerrados++;
    }
    return c;
  }, [projetos]);

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">
              Revenue
            </p>
            <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-foreground tracking-[-0.02em]">
              Projetos
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Banco de dados de todos os contratos que passaram pelo onboarding.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Total de projetos" value={kpis.total} />
          <KpiCard label="Ativos" value={kpis.ativos} accent="text-emerald-300" />
          <KpiCard label="Em risco" value={kpis.em_risco} accent="text-amber-300" />
          <KpiCard label="Encerrados/Churn" value={kpis.encerrados} accent="text-muted-foreground" />
        </div>

        <div className="glass rounded-2xl p-2 mb-4 flex flex-wrap items-center gap-2 shadow-ios-sm">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, projeto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl border-transparent bg-surface-2/60"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9 rounded-xl border-transparent bg-surface-2/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "Todos os status" : PROJETO_STATUS_LABEL[s as ProjetoStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={amFilter} onValueChange={setAmFilter}>
            <SelectTrigger className="w-[200px] h-9 rounded-xl border-transparent bg-surface-2/60">
              <SelectValue placeholder="Account Manager" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os AMs</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{profileLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-surface-1/60 shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FolderKanban className="mx-auto h-8 w-8 mb-3 opacity-50" />
            <p className="text-sm">Nenhum projeto ainda.</p>
            <p className="text-xs mt-1">
              Projetos aparecem aqui automaticamente quando o onboarding de uma conta é concluído.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-surface-1/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead>Cliente / Projeto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Account Manager</TableHead>
                  <TableHead>Início contrato</TableHead>
                  <TableHead className="text-right">EF</TableHead>
                  <TableHead className="text-right">Fee/mês</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Atrasado</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const fin = agregarFinanceiro(p.cobrancas);
                  const am = p.account?.account_manager_id ? profileMap[p.account.account_manager_id] : null;
                  const opp = p.account?.oportunidade;
                  return (
                    <TableRow
                      key={p.id}
                      onClick={() => navigate(`/comercial/projetos/${p.id}`)}
                      className="cursor-pointer border-border/40"
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">{p.nome}</div>
                        {opp?.nome_oportunidade && (
                          <div className="text-xs text-muted-foreground">{opp.nome_oportunidade}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${PROJETO_STATUS_COLOR[p.status_projeto]}`}>
                          {PROJETO_STATUS_LABEL[p.status_projeto]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{am ? profileLabel(am) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{fmtDate(p.account?.data_inicio_contrato)}</TableCell>
                      <TableCell className="text-right text-sm">{fmtBRL(opp?.valor_ef)}</TableCell>
                      <TableCell className="text-right text-sm">{fmtBRL(opp?.valor_fee)}</TableCell>
                      <TableCell className="text-right text-sm text-emerald-300">{fmtBRL(fin.pago)}</TableCell>
                      <TableCell className="text-right text-sm">{fmtBRL(fin.pendente)}</TableCell>
                      <TableCell className={`text-right text-sm ${fin.atrasado > 0 ? "text-red-300 font-medium" : ""}`}>
                        {fmtBRL(fin.atrasado)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(p.updated_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
};

function KpiCard({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className={`mt-1.5 font-display text-2xl font-semibold tracking-[-0.01em] ${accent ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}

export default Projetos;
