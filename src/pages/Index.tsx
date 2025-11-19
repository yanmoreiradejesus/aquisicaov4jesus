import { useState } from "react";
import V4Header from "@/components/V4Header";
import FilterBar from "@/components/FilterBar";
import InsightChart from "@/components/InsightChart";
import ConversionFunnel from "@/components/ConversionFunnel";

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

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const conversionFunnelData = {
    mql: 150,
    cr: 120,
    ra: 80,
    rr: 65,
    ass: 25,
    cplMedio: 45.80,
    custoCR: 57.25,
    cpa: 85.75,
    cprr: 105.50,
    ticketMedio: 3500.00,
  };

  const periodoData = [
    { name: "Manhã", conversao: 35 },
    { name: "Tarde", conversao: 28 },
    { name: "Noite", conversao: 22 },
    { name: "Madrugada", conversao: 15 },
  ];

  const tierData = [
    { name: "0-100k", conversao: 18 },
    { name: "100k-500k", conversao: 32 },
    { name: "500k+", conversao: 45 },
  ];

  const urgencyData = [
    { name: "Alta", conversao: 42 },
    { name: "Média", conversao: 28 },
    { name: "Baixa", conversao: 15 },
  ];

  const cargoData = [
    { name: "Dono", conversao: 48 },
    { name: "Gestor", conversao: 32 },
    { name: "Outros", conversao: 12 },
  ];

  const descriptionData = [
    { name: "Com descrição", conversao: 38 },
    { name: "Sem descrição", conversao: 18 },
  ];

  const emailData = [
    { name: "Domínio", conversao: 42 },
    { name: "Gratuito", conversao: 22 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      
      <main className="container mx-auto max-w-7xl space-y-8 px-4 lg:px-8 py-8">
        <div>
          <h1 className="mb-2 font-heading text-3xl lg:text-4xl font-bold text-foreground">DASHBOARD</h1>
          <p className="font-body text-sm text-muted-foreground">Visão geral e funil de conversão</p>
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
