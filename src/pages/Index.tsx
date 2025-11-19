import { useState, useMemo, useEffect } from "react";
import V4Header from "@/components/V4Header";
import FilterBar from "@/components/FilterBar";
import ConversionFunnel from "@/components/ConversionFunnel";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { filterLeads, calculateFunnelData, getUniqueValues } from "@/utils/dataProcessor";
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
    canal: "all",
    tier: "all",
    urgency: "all",
    cargo: "all",
    periodo: "all",
    emailType: "all",
    hasDescription: "all",
  });

  const { data: sheetsData, isLoading, error } = useGoogleSheetsData();

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredLeads = useMemo(() => {
    if (!sheetsData?.leads) return [];
    return filterLeads(sheetsData.leads, filters);
  }, [sheetsData, filters]);

  const previousPeriodLeads = useMemo(() => {
    if (!sheetsData?.leads || !filters.startDate || !filters.endDate) return [];
    
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysDiff);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    
    const prevFilters = {
      ...filters,
      startDate: prevStart.toISOString().split('T')[0],
      endDate: prevEnd.toISOString().split('T')[0]
    };
    
    return filterLeads(sheetsData.leads, prevFilters);
  }, [sheetsData, filters]);

  const conversionFunnelData = useMemo(() => {
    return calculateFunnelData(filteredLeads);
  }, [filteredLeads]);

  const previousPeriodData = useMemo(() => {
    return calculateFunnelData(previousPeriodLeads);
  }, [previousPeriodLeads]);

  const uniqueValues = useMemo(() => {
    if (!sheetsData?.leads) return {
      canais: [],
      tiers: [],
      urgencias: [],
      cargos: [],
      periodos: []
    };
    
    return {
      canais: getUniqueValues(sheetsData.leads, "CANAL"),
      tiers: getUniqueValues(sheetsData.leads, "TIER"),
      urgencias: getUniqueValues(sheetsData.leads, "URGÊNCIA"),
      cargos: getUniqueValues(sheetsData.leads, "CARGO"),
      periodos: getUniqueValues(sheetsData.leads, "PERÍODO DE COMPRA")
    };
  }, [sheetsData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando dados do Google Sheets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-destructive font-semibold">Erro ao carregar dados</p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      
      <main className="container mx-auto max-w-7xl space-y-8 px-4 lg:px-8 py-8">
        <div>
          <h1 className="mb-2 font-heading text-3xl lg:text-4xl font-bold text-foreground">DASHBOARD</h1>
          <p className="font-body text-sm text-muted-foreground">
            Visão geral e funil de conversão • {filteredLeads.length} leads
            {sheetsData?.lastUpdated && (
              <span className="ml-2 text-xs">
                • Última atualização: {new Date(sheetsData.lastUpdated).toLocaleTimeString('pt-BR')}
              </span>
            )}
          </p>
        </div>

        <FilterBar filters={filters} onFilterChange={handleFilterChange} uniqueValues={uniqueValues} />

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">FUNIL DE CONVERSÃO</h2>
          <ConversionFunnel data={conversionFunnelData} />
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">KPIs PRINCIPAIS</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* CPMQL */}
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">CPMQL (CPL Médio)</p>
              <p className="font-heading text-3xl font-bold text-foreground">R$ {conversionFunnelData.cplMedio.toFixed(2)}</p>
              {previousPeriodData.cplMedio > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {conversionFunnelData.cplMedio < previousPeriodData.cplMedio ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((1 - conversionFunnelData.cplMedio / previousPeriodData.cplMedio) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">
                        {((conversionFunnelData.cplMedio / previousPeriodData.cplMedio - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* CAC */}
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">CAC</p>
              <p className="font-heading text-3xl font-bold text-foreground">R$ {conversionFunnelData.cpa.toFixed(2)}</p>
              {previousPeriodData.cpa > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {conversionFunnelData.cpa < previousPeriodData.cpa ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((1 - conversionFunnelData.cpa / previousPeriodData.cpa) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">
                        {((conversionFunnelData.cpa / previousPeriodData.cpa - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Investimento Total */}
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">Investimento Total</p>
              <p className="font-heading text-3xl font-bold text-foreground">
                R$ {(conversionFunnelData.mql * conversionFunnelData.cplMedio).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {previousPeriodData.mql > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {((conversionFunnelData.cplMedio * conversionFunnelData.mql) < (previousPeriodData.cplMedio * previousPeriodData.mql)) ? (
                    <>
                      <TrendingDown className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {((1 - (conversionFunnelData.cplMedio * conversionFunnelData.mql) / (previousPeriodData.cplMedio * previousPeriodData.mql)) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {(((conversionFunnelData.cplMedio * conversionFunnelData.mql) / (previousPeriodData.cplMedio * previousPeriodData.mql) - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Faturamento Total */}
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">Faturamento Total</p>
              <p className="font-heading text-3xl font-bold text-success">
                R$ {(conversionFunnelData.ass * conversionFunnelData.ticketMedio).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {previousPeriodData.ass > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs">
                  {((conversionFunnelData.ticketMedio * conversionFunnelData.ass) > (previousPeriodData.ticketMedio * previousPeriodData.ass)) ? (
                    <>
                      <TrendingUp className="h-3 w-3 text-success" />
                      <span className="text-success">
                        {(((conversionFunnelData.ticketMedio * conversionFunnelData.ass) / (previousPeriodData.ticketMedio * previousPeriodData.ass) - 1) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3 w-3 text-destructive" />
                      <span className="text-destructive">
                        {((1 - (conversionFunnelData.ticketMedio * conversionFunnelData.ass) / (previousPeriodData.ticketMedio * previousPeriodData.ass)) * 100).toFixed(1)}% vs período anterior
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
