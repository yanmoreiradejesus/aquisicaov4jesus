import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, PhoneCall, Calendar, CheckCircle2, XCircle, Target, Trophy, DollarSign, TrendingUp, ListChecks } from "lucide-react";
import { useCrmActivities } from "@/hooks/useCrmActivities";
import { useProfilesList } from "@/hooks/useProfilesList";
import {
  computeSDRStats,
  computeCloserStats,
  computeTotals,
} from "@/utils/atividadesCalculator";
import { AtividadesFilters, type AtividadesFiltersValue } from "@/components/atividades/AtividadesFilters";
import { SDRRankingTable, CloserRankingTable } from "@/components/atividades/RankingTables";
import { SDRPerformanceChart } from "@/components/atividades/SDRPerformanceChart";

const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KpiCard = ({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: any;
}) => (
  <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/10 p-4 transition-colors hover:border-border">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {hint && (
            <span className="text-[10px] font-normal text-muted-foreground/70">{hint}</span>
          )}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight text-foreground truncate">
          {value}
        </div>
      </div>
      <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

const today = () => format(new Date(), "yyyy-MM-dd");
const daysAgo = (n: number) => format(subDays(new Date(), n), "yyyy-MM-dd");

const defaultFilters: AtividadesFiltersValue = {
  start: daysAgo(30),
  end: today(),
  pipe: "all",
  userId: "all",
};

const AtividadesCrm = () => {
  const [filters, setFilters] = useState<AtividadesFiltersValue>(defaultFilters);
  const startISO = `${filters.start}T00:00:00`;
  const endISO = `${filters.end}T23:59:59`;

  const { data, isLoading, error } = useCrmActivities({ startISO, endISO, pipe: filters.pipe });
  const { profiles } = useProfilesList({ departamento: "Receitas" });

  const sdr = useMemo(() => {
    if (!data) return [];
    const rows = computeSDRStats(data.sdrRows)
      // Exibe apenas SDRs com pelo menos 1 reunião agendada no período
      .filter((r) => r.reunioesAgendadas >= 1);
    return filters.userId === "all" ? rows : rows.filter((r) => r.userId === filters.userId);
  }, [data, filters.userId]);

  const closers = useMemo(() => {
    if (!data) return [];
    const rows = computeCloserStats(data.closerRows);
    return filters.userId === "all" ? rows : rows.filter((r) => r.userId === filters.userId);
  }, [data, filters.userId]);

  const totals = useMemo(() => {
    const base = computeTotals(sdr, closers, filters.userId === "all" ? data?.sdrTotals : undefined);
    // Ligações VoIP: soma somente usuários identificados (todos os SDRs, sem filtro de reuniões)
    const identifiedLigacoes = (data?.sdrRows ?? [])
      .filter((r) => filters.userId === "all" || r.user_id === filters.userId)
      .reduce((acc, r) => acc + (Number(r.ligacoes) || 0), 0);
    return { ...base, ligacoes: identifiedLigacoes };
  }, [sdr, closers, filters.userId, data?.sdrTotals, data?.sdrRows]);

  const conversionRate =
    totals.reunioesRealizadas > 0 ? (totals.conversoes / totals.reunioesRealizadas) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
            ATIVIDADES
          </h1>
          <p className="text-muted-foreground">
            Performance operacional de SDRs e Closers no período.
          </p>
        </div>

        <AtividadesFilters
          value={filters}
          onChange={setFilters}
          onReset={() => setFilters(defaultFilters)}
        />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> Erro ao carregar atividades.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Bloco SDR */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Topo do funil · SDR
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Ligações" hint="(VoIP)" value={totals.ligacoes} icon={PhoneCall} />
                <KpiCard label="Reuniões agendadas" value={totals.reunioesAgendadas} icon={Calendar} />
                <KpiCard label="Reuniões realizadas" value={totals.reunioesRealizadas} icon={CheckCircle2} />
                <KpiCard label="No-show" value={totals.noShow} icon={XCircle} />
              </div>
            </section>

            {/* Bloco Closer */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fundo do funil · Closer
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Propostas" value={totals.propostas} icon={Target} />
                <KpiCard
                  label="Ganhos"
                  value={`${totals.fechamentosGanhos} · ${fmtPct(totals.winRate)}`}
                  icon={Trophy}
                />
                <KpiCard
                  label="Conv. reuniões → ganho"
                  value={fmtPct(conversionRate)}
                  hint={`${totals.conversoes}/${totals.reunioesRealizadas}`}
                  icon={TrendingUp}
                />
                <KpiCard label="Receita" value={fmtMoney(totals.receitaTotal)} icon={DollarSign} />
              </div>
            </section>
          </>
        )}

        <Tabs defaultValue="sdr" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sdr">SDRs</TabsTrigger>
            <TabsTrigger value="closer">Closers</TabsTrigger>
          </TabsList>
          <TabsContent value="sdr">
            {isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : (
              <SDRRankingTable rows={sdr} profiles={profiles} />
            )}
          </TabsContent>
          <TabsContent value="closer">
            {isLoading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : (
              <CloserRankingTable rows={closers} profiles={profiles} />
            )}
          </TabsContent>
        </Tabs>

        {/* Gráficos compactos por indicador */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Skeleton className="h-[240px] rounded-xl" />
            <Skeleton className="h-[240px] rounded-xl" />
            <Skeleton className="h-[240px] rounded-xl" />
          </div>
        ) : (
          <SDRPerformanceChart rows={sdr} profiles={profiles} />
        )}
      </main>
    </div>
  );
};

export default AtividadesCrm;
