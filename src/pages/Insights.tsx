import V4Header from "@/components/V4Header";
import InsightChart from "@/components/InsightChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, Cell } from "recharts";

const Insights = () => {
  const canalData = [
    { name: "WhatsApp", conversao: 42, investimento: 25000, receita: 105000 },
    { name: "Instagram", conversao: 28, investimento: 18000, receita: 50400 },
    { name: "E-mail", conversao: 22, investimento: 12000, receita: 26400 },
  ];

  const tierData = [
    { name: "0-100k", conversao: 18, leads: 60, contratos: 11 },
    { name: "100k-500k", conversao: 32, leads: 50, contratos: 16 },
    { name: "500k+", conversao: 45, leads: 40, contratos: 18 },
  ];

  const urgencyData = [
    { name: "Alta", conversao: 42, cpl: 38, ticket: 4200 },
    { name: "Média", conversao: 28, cpl: 45, ticket: 3500 },
    { name: "Baixa", conversao: 15, cpl: 52, ticket: 2800 },
  ];

  const cargoData = [
    { name: "Dono", conversao: 48, leads: 45, contratos: 22 },
    { name: "Gestor", conversao: 32, leads: 70, contratos: 22 },
    { name: "Outros", conversao: 12, leads: 35, contratos: 4 },
  ];

  const periodoData = [
    { name: "Manhã", conversao: 35, leads: 38, receita: 46200 },
    { name: "Tarde", conversao: 28, leads: 42, receita: 41160 },
    { name: "Noite", conversao: 22, leads: 45, receita: 34650 },
    { name: "Madrugada", conversao: 15, leads: 25, receita: 13125 },
  ];

  const emailData = [
    { name: "Domínio", conversao: 42, leads: 85, contratos: 36 },
    { name: "Gratuito", conversao: 22, leads: 65, contratos: 14 },
  ];

  const descriptionData = [
    { name: "Com descrição", conversao: 38, leads: 95, contratos: 36 },
    { name: "Sem descrição", conversao: 18, leads: 55, contratos: 10 },
  ];

  const cplVsTicketData = [
    { cpl: 38, ticket: 4200, urgencia: "Alta" },
    { cpl: 45, ticket: 3500, urgencia: "Média" },
    { cpl: 52, ticket: 2800, urgencia: "Baixa" },
    { cpl: 42, ticket: 3800, urgencia: "Alta" },
    { cpl: 48, ticket: 3200, urgencia: "Média" },
  ];

  const horarioData = [
    { hora: "8h-10h", lucro: 12500, conversao: 28 },
    { hora: "10h-12h", lucro: 18200, conversao: 35 },
    { hora: "12h-14h", lucro: 8900, conversao: 18 },
    { hora: "14h-16h", lucro: 22400, conversao: 42 },
    { hora: "16h-18h", lucro: 19800, conversao: 38 },
    { hora: "18h-20h", lucro: 15600, conversao: 25 },
  ];

  const matrizData = [
    { tier: "0-100k", urgencia: "Alta", valor: 35 },
    { tier: "0-100k", urgencia: "Média", valor: 20 },
    { tier: "0-100k", urgencia: "Baixa", valor: 10 },
    { tier: "100k-500k", urgencia: "Alta", valor: 48 },
    { tier: "100k-500k", urgencia: "Média", valor: 32 },
    { tier: "100k-500k", urgencia: "Baixa", valor: 15 },
    { tier: "500k+", urgencia: "Alta", valor: 62 },
    { tier: "500k+", urgencia: "Média", valor: 45 },
    { tier: "500k+", urgencia: "Baixa", valor: 22 },
  ];

  const palavrasData = [
    { palavra: "urgente", frequencia: 45 },
    { palavra: "crescimento", frequencia: 38 },
    { palavra: "expansão", frequencia: 32 },
    { palavra: "investimento", frequencia: 28 },
    { palavra: "equipe", frequencia: 25 },
  ];

  const getColorByValue = (value: number) => {
    if (value >= 50) return "hsl(142 76% 36%)";
    if (value >= 30) return "hsl(38 92% 50%)";
    return "hsl(0 84.2% 60.2%)";
  };

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      
      <main className="container mx-auto max-w-7xl space-y-8 px-4 lg:px-8 py-8">
        <div>
          <h1 className="mb-2 font-heading text-3xl lg:text-4xl font-bold text-foreground">INSIGHTS</h1>
          <p className="font-body text-sm text-muted-foreground">Análises detalhadas de performance</p>
        </div>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">PERFORMANCE POR SEGMENTO</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <InsightChart title="PERFORMANCE POR CANAL" data={canalData} dataKey="conversao" xAxisKey="name" />
            <InsightChart title="TIER X CONVERSÃO" data={tierData} dataKey="conversao" xAxisKey="name" />
            <InsightChart title="URGÊNCIA X QUALIDADE" data={urgencyData} dataKey="conversao" xAxisKey="name" />
            <InsightChart title="CARGO X CONVERSÃO" data={cargoData} dataKey="conversao" xAxisKey="name" />
            <InsightChart title="CONVERSÃO POR PERÍODO" data={periodoData} dataKey="conversao" xAxisKey="name" />
            <InsightChart title="E-MAIL: DOMÍNIO X GRATUITO" data={emailData} dataKey="conversao" xAxisKey="name" />
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">DESCRIÇÃO X CONVERSÃO</h2>
          <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={descriptionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                <Legend />
                <Bar dataKey="conversao" fill="hsl(var(--primary))" name="Taxa de Conversão (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">INSIGHTS AVANÇADOS</h2>
          
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
              <h3 className="mb-6 font-body text-lg font-semibold text-foreground">CPL VS TICKET MÉDIO</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="cpl" name="CPL" stroke="hsl(var(--muted-foreground))" label={{ value: 'CPL (R$)', position: 'insideBottom', offset: -5 }} />
                  <YAxis dataKey="ticket" name="Ticket" stroke="hsl(var(--muted-foreground))" label={{ value: 'Ticket Médio (R$)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={cplVsTicketData} fill="hsl(var(--primary))" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
              <h3 className="mb-6 font-body text-lg font-semibold text-foreground">HORÁRIO MAIS LUCRATIVO</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={horarioData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="hora" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                  <Legend />
                  <Bar dataKey="lucro" fill="hsl(var(--success))" name="Lucro (R$)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">MATRIZ FATURAMENTO × URGÊNCIA</h2>
          <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="font-body text-sm font-semibold text-muted-foreground"></div>
              <div className="font-body text-sm font-semibold text-center text-foreground">Alta</div>
              <div className="font-body text-sm font-semibold text-center text-foreground">Média</div>
              <div className="font-body text-sm font-semibold text-center text-foreground">Baixa</div>
              
              {["0-100k", "100k-500k", "500k+"].map((tier) => (
                <>
                  <div key={tier} className="font-body text-sm font-semibold text-foreground">{tier}</div>
                  {["Alta", "Média", "Baixa"].map((urgencia) => {
                    const item = matrizData.find(d => d.tier === tier && d.urgencia === urgencia);
                    return (
                      <div
                        key={`${tier}-${urgencia}`}
                        className="rounded-lg p-4 text-center transition-all duration-300 hover:scale-105"
                        style={{ backgroundColor: getColorByValue(item?.valor || 0) + "33" }}
                      >
                        <p className="font-heading text-2xl font-bold text-foreground">{item?.valor}%</p>
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">PALAVRAS MAIS COMUNS (DESCRIÇÕES VENCEDORAS)</h2>
          <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={palavrasData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                <YAxis dataKey="palavra" type="category" stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                <Bar dataKey="frequencia" fill="hsl(var(--success))" name="Frequência" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Insights;
