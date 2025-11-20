import { useState, useMemo, useEffect } from "react";
import V4Header from "@/components/V4Header";
import FilterBar from "@/components/FilterBar";
import ConversionFunnel from "@/components/ConversionFunnel";
import FunnelSkeleton from "@/components/FunnelSkeleton";
import KPICardSkeleton from "@/components/KPICardSkeleton";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { filterLeads, calculateFunnelData, getUniqueValuesWithCount } from "@/utils/dataProcessor";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
const Index = () => {
  const getCurrentMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };
  const initialRange = getCurrentMonthRange();
  const [filters, setFilters] = useState({
    startDate: initialRange.start,
    endDate: initialRange.end,
    canal: [] as string[],
    tier: [] as string[],
    urgency: [] as string[],
    cargo: [] as string[],
    periodo: [] as string[],
    emailType: "all",
    hasDescription: "all"
  });
  const {
    data: sheetsData,
    isLoading,
    error
  } = useGoogleSheetsData();
  const handleFilterChange = (key: string, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  const filteredLeads = useMemo(() => {
    if (!sheetsData?.leads) return [];
    return filterLeads(sheetsData.leads, filters);
  }, [sheetsData, filters]);
  const {
    previousPeriodLeads,
    previousStartDate,
    previousEndDate
  } = useMemo(() => {
    if (!sheetsData?.leads || !filters.startDate || !filters.endDate) {
      return {
        previousPeriodLeads: [],
        previousStartDate: '',
        previousEndDate: ''
      };
    }
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysDiff);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStartStr = prevStart.toISOString().split('T')[0];
    const prevEndStr = prevEnd.toISOString().split('T')[0];
    const prevFilters = {
      ...filters,
      startDate: prevStartStr,
      endDate: prevEndStr
    };
    return {
      previousPeriodLeads: filterLeads(sheetsData.leads, prevFilters),
      previousStartDate: prevStartStr,
      previousEndDate: prevEndStr
    };
  }, [sheetsData, filters]);
  const conversionFunnelData = useMemo(() => {
    return calculateFunnelData(filteredLeads, filters, sheetsData?.leads || []);
  }, [filteredLeads, filters, sheetsData]);
  const previousPeriodData = useMemo(() => {
    return calculateFunnelData(previousPeriodLeads, {
      ...filters,
      startDate: previousStartDate,
      endDate: previousEndDate
    }, sheetsData?.leads || []);
  }, [previousPeriodLeads, previousStartDate, previousEndDate, filters, sheetsData]);
  const uniqueValues = useMemo(() => {
    if (!sheetsData?.leads) return {
      canais: [],
      tiers: [],
      urgencias: [],
      cargos: [],
      periodos: []
    };
    return {
      canais: getUniqueValuesWithCount(sheetsData.leads, "CANAL"),
      tiers: getUniqueValuesWithCount(sheetsData.leads, "TIER"),
      urgencias: getUniqueValuesWithCount(sheetsData.leads, "URGÊNCIA"),
      cargos: getUniqueValuesWithCount(sheetsData.leads, "CARGO"),
      periodos: getUniqueValuesWithCount(sheetsData.leads, "PERÍODO DE COMPRA")
    };
  }, [sheetsData]);
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <V4Header />
        <div className="mx-auto max-w-7xl p-4 lg:p-8 space-y-8">
          {/* Filter Bar Skeleton */}
          <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              ))}
            </div>
          </div>

          {/* Funnel Skeleton */}
          <FunnelSkeleton />

          {/* KPI Cards Skeleton */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <KPICardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (error) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive font-semibold">Erro ao carregar dados</p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <V4Header />
      
      <main className="container mx-auto max-w-7xl space-y-6 lg:space-y-8 px-3 sm:px-4 lg:px-8 py-4 lg:py-8">
        <div>
          
          <p className="font-body text-xs sm:text-sm text-muted-foreground">
            Visão geral e funil de conversão • {filteredLeads.length} leads
            {sheetsData?.lastUpdated && <span className="ml-2 text-xs">
                • Última atualização: {new Date(sheetsData.lastUpdated).toLocaleTimeString('pt-BR')}
              </span>}
          </p>
        </div>

        <FilterBar filters={filters} onFilterChange={handleFilterChange} uniqueValues={uniqueValues} />

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">FUNIL DE VENDAS    </h2>
          <ConversionFunnel 
            data={conversionFunnelData} 
            leads={filteredLeads}
            allLeads={sheetsData?.leads || []}
            filters={filters}
          />
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">KPIS PRINCIPAIS</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* CPMQL */}
            <div 
              className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: '900ms', animationFillMode: 'backwards' }}
            >
              <p className="mb-2 font-body text-sm text-muted-foreground">CPMQL  </p>
              <p className="font-heading text-3xl font-bold text-foreground">R$ {conversionFunnelData.cplMedio.toFixed(2)}</p>
              {previousPeriodData.cplMedio > 0 && <div className="mt-2 flex items-center gap-1 text-xs">
                  {conversionFunnelData.cplMedio < previousPeriodData.cplMedio ? <>
                      <TrendingDown className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((1 - conversionFunnelData.cplMedio / previousPeriodData.cplMedio) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </> : <>
                      <TrendingUp className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">
                        {((conversionFunnelData.cplMedio / previousPeriodData.cplMedio - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>}
                </div>}
            </div>

            {/* CAC */}
            <div 
              className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-4 lg:p-6 transition-all duration-300 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: '1050ms', animationFillMode: 'backwards' }}
            >
              <p className="mb-2 font-body text-xs lg:text-sm text-muted-foreground">CAC</p>
              <p className="font-heading text-2xl lg:text-3xl font-bold text-foreground">
                R$ {conversionFunnelData.ass > 0 ? (conversionFunnelData.investimentoTotal / conversionFunnelData.ass).toFixed(2) : "0.00"}
              </p>
              {previousPeriodData.ass > 0 && conversionFunnelData.ass > 0 && <div className="mt-2 flex items-center gap-1 text-xs">
                  {conversionFunnelData.investimentoTotal / conversionFunnelData.ass < previousPeriodData.investimentoTotal / previousPeriodData.ass ? <>
                      <TrendingDown className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((1 - conversionFunnelData.investimentoTotal / conversionFunnelData.ass / (previousPeriodData.investimentoTotal / previousPeriodData.ass)) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </> : <>
                      <TrendingUp className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">
                        {((conversionFunnelData.investimentoTotal / conversionFunnelData.ass / (previousPeriodData.investimentoTotal / previousPeriodData.ass) - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>}
                </div>}
            </div>

            {/* Investimento Total */}
            <div 
              className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: '1200ms', animationFillMode: 'backwards' }}
            >
              <p className="mb-2 font-body text-sm text-muted-foreground">Investimento Total</p>
              <p className="font-heading text-3xl font-bold text-foreground">
                R$ {conversionFunnelData.investimentoTotal.toLocaleString('pt-BR', {
                minimumFractionDigits: 2
              })}
              </p>
              {previousPeriodData.investimentoTotal > 0 && <div className="mt-2 flex items-center gap-1 text-xs">
                  {conversionFunnelData.investimentoTotal < previousPeriodData.investimentoTotal ? <>
                      <TrendingDown className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((1 - conversionFunnelData.investimentoTotal / previousPeriodData.investimentoTotal) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </> : <>
                      <TrendingUp className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((conversionFunnelData.investimentoTotal / previousPeriodData.investimentoTotal - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>}
                </div>}
            </div>

            {/* Faturamento Total */}
            <div 
              className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg animate-fade-in"
              style={{ animationDelay: '1350ms', animationFillMode: 'backwards' }}
            >
              <p className="mb-2 font-body text-sm text-muted-foreground">Faturamento Total</p>
              <p className="font-heading text-3xl font-bold text-success">
                R$ {conversionFunnelData.faturamentoTotal.toLocaleString('pt-BR', {
                minimumFractionDigits: 2
              })}
              </p>
              {previousPeriodData.faturamentoTotal > 0 && <div className="mt-2 flex items-center gap-1 text-xs">
                  {conversionFunnelData.faturamentoTotal > previousPeriodData.faturamentoTotal ? <>
                      <TrendingUp className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((conversionFunnelData.faturamentoTotal / previousPeriodData.faturamentoTotal - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </> : <>
                      <TrendingDown className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">
                        {((1 - conversionFunnelData.faturamentoTotal / previousPeriodData.faturamentoTotal) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>}
                </div>}
            </div>
          </div>
        </section>

        {/* Footer - Last Updated */}
        {sheetsData?.lastUpdated && (
          <footer className="pt-8 pb-4 text-center border-t border-border/30">
            <p className="font-body text-xs text-muted-foreground">
              Última atualização: {new Date(sheetsData.lastUpdated).toLocaleTimeString('pt-BR')}
            </p>
          </footer>
        )}
      </main>
    </div>;
};
export default Index;