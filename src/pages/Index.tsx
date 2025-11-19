import { useState, useMemo } from "react";
import V4Header from "@/components/V4Header";
import FilterBar from "@/components/FilterBar";
import ConversionFunnel from "@/components/ConversionFunnel";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { filterLeads, calculateFunnelData } from "@/utils/dataProcessor";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [filters, setFilters] = useState({
    dateRange: "",
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

  const conversionFunnelData = useMemo(() => {
    return calculateFunnelData(filteredLeads);
  }, [filteredLeads]);

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

        <FilterBar filters={filters} onFilterChange={handleFilterChange} />

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">FUNIL DE CONVERSÃO</h2>
          <ConversionFunnel data={conversionFunnelData} />
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">KPIs PRINCIPAIS</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">CPMQL (CPL Médio)</p>
              <p className="font-heading text-3xl font-bold text-foreground">R$ {conversionFunnelData.cplMedio.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">CAC</p>
              <p className="font-heading text-3xl font-bold text-foreground">R$ {conversionFunnelData.cpa.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">Investimento Total</p>
              <p className="font-heading text-3xl font-bold text-foreground">R$ {(conversionFunnelData.mql * conversionFunnelData.cplMedio).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-6 transition-all duration-300 hover:shadow-lg">
              <p className="mb-2 font-body text-sm text-muted-foreground">Faturamento Total</p>
              <p className="font-heading text-3xl font-bold text-success">R$ {(conversionFunnelData.ass * conversionFunnelData.ticketMedio).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
