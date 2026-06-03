import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { useCrmActivities } from "@/hooks/useCrmActivities";
import { useProfilesList } from "@/hooks/useProfilesList";
import {
  computeSDRStats,
  computeCloserStats,
  computeTotals,
} from "@/utils/atividadesCalculator";
import { AtividadesFilters, type AtividadesFiltersValue } from "@/components/atividades/AtividadesFilters";
import { SDRRankingTable, CloserRankingTable } from "@/components/atividades/RankingTables";

const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const KpiCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/5 p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
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

  const { data, isLoading, error } = useCrmActivities({ startISO, endISO });
  const { profiles } = useProfilesList({ departamento: "Receitas" });

  const sdr = useMemo(() => {
    if (!data) return [];
    const rows = computeSDRStats({ ...data, startISO, endISO, pipe: filters.pipe });
    return filters.userId === "all" ? rows : rows.filter((r) => r.userId === filters.userId);
  }, [data, startISO, endISO, filters.pipe, filters.userId]);

  const closers = useMemo(() => {
    if (!data) return [];
    const rows = computeCloserStats({ ...data, startISO, endISO, pipe: filters.pipe });
    return filters.userId === "all" ? rows : rows.filter((r) => r.userId === filters.userId);
  }, [data, startISO, endISO, filters.pipe, filters.userId]);

  const totals = useMemo(() => computeTotals(sdr, closers), [sdr, closers]);

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
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Tentativas" value={totals.tentativas} />
            <KpiCard label="Conectadas" value={totals.conectadas} />
            <KpiCard label="Reuniões agendadas" value={totals.reunioesAgendadas} />
            <KpiCard label="Reuniões realizadas" value={totals.reunioesRealizadas} />
            <KpiCard label="No-show" value={totals.noShow} />
            <KpiCard label="Propostas" value={totals.propostas} />
            <KpiCard label="Ganhos" value={`${totals.fechamentosGanhos} · ${fmtPct(totals.winRate)}`} />
            <KpiCard label="Receita" value={fmtMoney(totals.receitaTotal)} />
          </div>
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
      </main>
    </div>
  );
};

export default AtividadesCrm;
