import { useState } from "react";
import V4Header from "@/components/V4Header";
import FilterBar from "@/components/FilterBar";
import FunnelCard from "@/components/FunnelCard";
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

  // Mock data - será substituído pela integração com Google Sheets
  const funnelData = {
    leadsComprados: 150,
    contatoRealizado: 120,
    reuniaoAgendada: 80,
    reuniaoRealizada: 65,
    contratoAssinado: 25,
  };

  const conversionFunnelData = {
    mql: funnelData.leadsComprados,
    cr: funnelData.contatoRealizado,
    ra: funnelData.reuniaoAgendada,
    rr: funnelData.reuniaoRealizada,
    ass: funnelData.contratoAssinado,
    cplMedio: 45.80,
    custoCR: 57.25,
    cpa: 85.75,
    cprr: 105.50,
    ticketMedio: 3500.00,
  };

  const calculatePercentage = (value: number, total: number) => {
    return total > 0 ? (value / total) * 100 : 0;
  };

  const crPercent = calculatePercentage(funnelData.contatoRealizado, funnelData.leadsComprados);
  const raPercent = calculatePercentage(funnelData.reuniaoAgendada, funnelData.contatoRealizado);
  const rrPercent = calculatePercentage(funnelData.reuniaoRealizada, funnelData.reuniaoAgendada);
  const assPercent = calculatePercentage(funnelData.contratoAssinado, funnelData.reuniaoRealizada);
  const winRate = calculatePercentage(funnelData.contratoAssinado, funnelData.leadsComprados);

  // Mock data for charts
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
      <FilterBar filters={filters} onFilterChange={handleFilterChange} />
      
      <main className="container mx-auto px-6 py-8">
        {/* Funil Section */}
        <section className="mb-12">
          <h2 className="mb-8 font-heading text-4xl tracking-wider text-foreground">FUNIL DE CONVERSÃO</h2>
          
          <ConversionFunnel data={conversionFunnelData} />
        </section>

        {/* Insights Section */}
        <section className="mb-12">
          <h2 className="mb-6 font-heading text-3xl text-primary">INSIGHTS DE COMPRA</h2>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <InsightChart 
              title="CONVERSÃO POR PERÍODO" 
              data={periodoData} 
              dataKey="conversao" 
              xAxisKey="name" 
            />
            <InsightChart 
              title="TIER X CONVERSÃO" 
              data={tierData} 
              dataKey="conversao" 
              xAxisKey="name" 
            />
            <InsightChart 
              title="URGÊNCIA X QUALIDADE" 
              data={urgencyData} 
              dataKey="conversao" 
              xAxisKey="name" 
            />
            <InsightChart 
              title="CARGO X CONVERSÃO" 
              data={cargoData} 
              dataKey="conversao" 
              xAxisKey="name" 
            />
            <InsightChart 
              title="DESCRIÇÃO X CONVERSÃO" 
              data={descriptionData} 
              dataKey="conversao" 
              xAxisKey="name" 
            />
            <InsightChart 
              title="E-MAIL DOMÍNIO X GRATUITO" 
              data={emailData} 
              dataKey="conversao" 
              xAxisKey="name" 
            />
          </div>
        </section>

        {/* Cruzamentos Section */}
        <section>
          <h2 className="mb-6 font-heading text-3xl text-primary">CRUZAMENTOS</h2>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-sm border border-primary/30 bg-card p-6">
              <h3 className="mb-4 font-heading text-lg text-primary">CARGO X PERÍODO</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Dono + Manhã</span>
                  <span className="font-medium text-primary">42%</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Gestor + Tarde</span>
                  <span className="font-medium text-primary">35%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outros + Noite</span>
                  <span className="font-medium text-primary">18%</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-sm border border-primary/30 bg-card p-6">
              <h3 className="mb-4 font-heading text-lg text-primary">URGÊNCIA X PERÍODO</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Alta + Manhã</span>
                  <span className="font-medium text-primary">48%</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">Média + Tarde</span>
                  <span className="font-medium text-primary">32%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Baixa + Noite</span>
                  <span className="font-medium text-primary">15%</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-sm border border-primary/30 bg-card p-6">
              <h3 className="mb-4 font-heading text-lg text-primary">TIER X PERÍODO</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">500k+ + Manhã</span>
                  <span className="font-medium text-primary">52%</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">100k-500k + Tarde</span>
                  <span className="font-medium text-primary">38%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">0-100k + Noite</span>
                  <span className="font-medium text-primary">22%</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
