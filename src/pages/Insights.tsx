import { useState, useMemo } from "react";
import { format, startOfYear, subYears } from "date-fns";
import InsightsDateFilter from "@/components/InsightsDateFilter";
import PerformanceBarChart from "@/components/PerformanceBarChart";
import CrossPerformanceMatrix from "@/components/CrossPerformanceMatrix";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import {
  calculatePerformanceByField,
  calculateCrossPerformance,
} from "@/utils/insightsCalculator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, AlertTriangle } from "lucide-react";

const Insights = () => {
  // Initialize with total period starting from Jan 1, 2025 to capture all data
  const now = new Date();
  const [startDate, setStartDate] = useState("2025-01-01T00:00:00");
  const [endDate, setEndDate] = useState(
    format(now, "yyyy-MM-dd") + "T00:00:00"
  );

  const { data: sheetsData, isLoading, error } = useGoogleSheetsData();

  // Filter leads by date range
  const filteredLeads = useMemo(() => {
    if (!sheetsData?.leads) return [];

    const start = new Date(startDate);
    const end = new Date(endDate);

    return sheetsData.leads.filter((lead) => {
      if (!lead.DATA) return false;

      // Parse DD/MM/YYYY format
      const parts = lead.DATA.split("/");
      if (parts.length !== 3) return false;

      const leadDate = new Date(
        parseInt(parts[2]),
        parseInt(parts[1]) - 1,
        parseInt(parts[0])
      );

      return leadDate >= start && leadDate <= end;
    });
  }, [sheetsData?.leads, startDate, endDate]);

  // Calculate performance metrics for each segment
  const canalPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "CANAL"),
    [filteredLeads]
  );

  const tierPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "TIER"),
    [filteredLeads]
  );

  const urgenciaPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "URGÊNCIA"),
    [filteredLeads]
  );

  const cargoPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "CARGO"),
    [filteredLeads]
  );

  const periodoPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "PERÍODO DE COMPRA"),
    [filteredLeads]
  );

  const emailPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "emailType"),
    [filteredLeads]
  );

  const descricaoPerformance = useMemo(
    () => calculatePerformanceByField(filteredLeads, "hasDescription"),
    [filteredLeads]
  );

  // Calculate cross performance matrices
  const periodoXCanalCross = useMemo(
    () => calculateCrossPerformance(filteredLeads, "PERÍODO DE COMPRA", "CANAL"),
    [filteredLeads]
  );

  const urgenciaXCargoCross = useMemo(
    () => calculateCrossPerformance(filteredLeads, "URGÊNCIA", "CARGO"),
    [filteredLeads]
  );

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
  };

  // Loading skeleton
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

  // Error state
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
                Não foi possível carregar os dados da planilha.
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
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
              INSIGHTS
            </h1>
            <p className="text-muted-foreground">
              Análise de performance por segmento • {filteredLeads.length} leads no período
            </p>
          </div>
          {sheetsData?.lastUpdated && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3" />
              Atualizado: {sheetsData.lastUpdated}
            </div>
          )}
        </div>


        {/* Date Filter */}
        <InsightsDateFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
        />

        {/* Low data warning */}
        {filteredLeads.length < 10 && filteredLeads.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning">
              Apenas {filteredLeads.length} leads no período selecionado. 
              Considere expandir o intervalo de datas para uma análise mais significativa.
            </span>
          </div>
        )}

        {/* Performance by Segment Section */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Performance por Segmento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PerformanceBarChart
              title="Performance por Canal"
              data={canalPerformance}
              metric="conversionRate"
            />
            <PerformanceBarChart
              title="Performance por Tier"
              data={tierPerformance}
              metric="conversionRate"
            />
            <PerformanceBarChart
              title="Performance por Urgência"
              data={urgenciaPerformance}
              metric="conversionRate"
            />
            <PerformanceBarChart
              title="Performance por Cargo"
              data={cargoPerformance}
              metric="conversionRate"
            />
            <PerformanceBarChart
              title="Performance por Período"
              data={periodoPerformance}
              metric="conversionRate"
            />
            <PerformanceBarChart
              title="Performance por Tipo de E-mail"
              data={emailPerformance}
              metric="conversionRate"
            />
          </div>
        </section>

        {/* Description Performance */}
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

        {/* Cross Performance Matrices */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Cruzamento de Dados
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CrossPerformanceMatrix
              title="Período de Compra × Canal"
              cells={periodoXCanalCross}
              fieldALabel="Período"
              fieldBLabel="Canal"
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
