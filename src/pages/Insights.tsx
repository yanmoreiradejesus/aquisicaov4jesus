import { useState, useMemo } from "react";
import { format } from "date-fns";
import InsightsDateFilter from "@/components/InsightsDateFilter";
import PerformanceBarChart from "@/components/PerformanceBarChart";
import CrossPerformanceMatrix from "@/components/CrossPerformanceMatrix";
import { useCrmLeads } from "@/hooks/useCrmLeads";
import { useCrmOportunidades } from "@/hooks/useCrmOportunidades";
import {
  calculatePerformanceByField,
  calculateCrossPerformance,
} from "@/utils/insightsCalculator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, AlertTriangle } from "lucide-react";

const Insights = () => {
  const now = new Date();
  const [startDate, setStartDate] = useState("2025-01-01T00:00:00");
  const [endDate, setEndDate] = useState(
    format(now, "yyyy-MM-dd") + "T23:59:59",
  );

  const { data: leads, isLoading: loadingLeads, error: errorLeads } = useCrmLeads();
  const { data: oportunidades, isLoading: loadingOps, error: errorOps } = useCrmOportunidades();

  const isLoading = loadingLeads || loadingOps;
  const error = errorLeads || errorOps;

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return leads.filter((l: any) => {
      const raw = l.data_criacao_origem ?? l.created_at;
      if (!raw) return false;
      const t = new Date(raw).getTime();
      if (isNaN(t)) return false;
      return t >= start && t <= end;
    });
  }, [leads, startDate, endDate]);

  const ops = oportunidades ?? [];

  const canalPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "canal", ops),
    [filteredLeads, ops],
  );
  const tierPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "tier", ops),
    [filteredLeads, ops],
  );
  const urgenciaPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "urgencia", ops),
    [filteredLeads, ops],
  );
  const cargoPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "cargo", ops),
    [filteredLeads, ops],
  );
  const tipoProdutoPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "tipo_produto", ops),
    [filteredLeads, ops],
  );
  const origemPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "origem", ops),
    [filteredLeads, ops],
  );
  const descricaoPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "hasDescription", ops),
    [filteredLeads, ops],
  );

  const canalXTierCross = useMemo(
    () => calculateCrossPerformance(filteredLeads, "canal", "tier", ops),
    [filteredLeads, ops],
  );
  const urgenciaXCargoCross = useMemo(
    () => calculateCrossPerformance(filteredLeads, "urgencia", "cargo", ops),
    [filteredLeads, ops],
  );

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl p-4 lg:p-8">
          <div className="mb-8">
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <Skeleton className="h-16 w-full mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[400px] w-full" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl p-4 lg:p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Erro ao carregar dados
              </h2>
              <p className="text-muted-foreground">
                Não foi possível carregar os dados do CRM.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-8 p-4 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
              INSIGHTS
            </h1>
            <p className="text-muted-foreground">
              Análise de performance por segmento • {filteredLeads.length} leads no período • Fonte: CRM
            </p>
          </div>
        </div>

        <InsightsDateFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
        />

        {filteredLeads.length < 10 && filteredLeads.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning">
              Apenas {filteredLeads.length} leads no período selecionado.
              Considere expandir o intervalo de datas para uma análise mais significativa.
            </span>
          </div>
        )}

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Performance por Segmento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PerformanceBarChart title="Performance por Canal" data={canalPerformance} metric="conversionRate" />
            <PerformanceBarChart title="Performance por Tier" data={tierPerformance} metric="conversionRate" />
            <PerformanceBarChart title="Performance por Urgência" data={urgenciaPerformance} metric="conversionRate" />
            <PerformanceBarChart title="Performance por Cargo" data={cargoPerformance} metric="conversionRate" />
            <PerformanceBarChart title="Performance por Tipo de Produto" data={tipoProdutoPerformance} metric="conversionRate" />
            <PerformanceBarChart title="Performance por Origem" data={origemPerformance} metric="conversionRate" />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Descrição × Conversão
          </h2>
          <div className="max-w-xl">
            <PerformanceBarChart
              title="Impacto da Descrição Preenchida"
              data={descricaoPerformance}
              metric="conversionRate"
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Cruzamento de Dados
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CrossPerformanceMatrix
              title="Canal × Tier"
              cells={canalXTierCross}
              fieldALabel="Canal"
              fieldBLabel="Tier"
            />
            <CrossPerformanceMatrix
              title="Urgência × Cargo"
              cells={urgenciaXCargoCross}
              fieldALabel="Urgência"
              fieldBLabel="Cargo"
            />
          </div>
        </section>
      </main>
    </div>
  );
};

export default Insights;
