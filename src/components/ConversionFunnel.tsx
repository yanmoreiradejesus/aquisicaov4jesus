interface FunnelStage {
  title: string;
  total: number;
  conversionRate: number;
  costLabel: string;
  costValue: number;
  barColor: string;
}
interface ConversionFunnelProps {
  data: {
    mql: number;
    cr: number;
    ra: number;
    rr: number;
    ass: number;
    cplMedio: number;
    custoCR: number;
    cpa: number;
    cprr: number;
    ticketMedio: number;
  };
}
const ConversionFunnel = ({ data }: ConversionFunnelProps) => {
  const stages: FunnelStage[] = [
    {
      title: "Leads Comprados (MQL)",
      total: data.mql,
      conversionRate: 0,
      // Não mostrar conversão para MQL
      costLabel: "CPMQL",
      costValue: data.cplMedio,
      barColor: "bg-[hsl(217,91%,60%)]",
    },
    {
      title: "Contato Realizado (C.R)",
      total: data.cr,
      conversionRate: data.mql > 0 ? (data.cr / data.mql) * 100 : 0,
      costLabel: "Custo p/ C.R",
      costValue: data.custoCR,
      barColor: "bg-[hsl(271,76%,53%)]",
    },
    {
      title: "Reunião Agendada (R.A)",
      total: data.ra,
      conversionRate: data.cr > 0 ? (data.ra / data.cr) * 100 : 0,
      costLabel: "CPA",
      costValue: data.cpa,
      barColor: "bg-[hsl(24,95%,53%)]",
    },
    {
      title: "Reunião Realizada (R.R)",
      total: data.rr,
      conversionRate: data.ra > 0 ? (data.rr / data.ra) * 100 : 0,
      costLabel: "CPRR",
      costValue: data.cprr,
      barColor: "bg-[hsl(38,92%,50%)]",
    },
    {
      title: "Contrato Assinado (ASS)",
      total: data.ass,
      conversionRate: data.rr > 0 ? (data.ass / data.rr) * 100 : 0,
      costLabel: "Ticket Médio",
      costValue: data.ticketMedio,
      barColor: "bg-[hsl(142,76%,36%)]",
    },
  ];
  const intermediateRates = [
    {
      label: "MQL → C.R",
      rate: stages[1].conversionRate,
    },
    {
      label: "C.R → R.A",
      rate: stages[2].conversionRate,
    },
    {
      label: "R.A → R.R",
      rate: stages[3].conversionRate,
    },
    {
      label: "R.R → ASS",
      rate: stages[4].conversionRate,
    },
  ];
  const mqlToVenda = data.mql > 0 ? (data.ass / data.mql) * 100 : 0;
  return (
    <div className="relative grid grid-cols-[1fr_4fr_1fr] gap-6">
      {/* Left Side - MQL to VENDA */}
      <div className="flex items-center justify-center">
        <div className="text-center">
          <p className="mb-2 font-body text-xs text-muted-foreground">MQL → VENDA</p>
          <p className="font-heading text-5xl font-bold text-success">{mqlToVenda.toFixed(1)}%</p>
        </div>
      </div>

      {/* Center - Funnel Stages */}
      <div className="space-y-4">
        {stages.map((stage, index) => {
          const maxTotal = Math.max(...stages.map((s) => s.total));
          const barWidth = maxTotal > 0 ? (stage.total / maxTotal) * 100 : 0;
          return (
            <div
              key={index}
              className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/30"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-body text-base font-semibold text-foreground">{stage.title}</h3>
                <span className="font-heading text-3xl font-bold text-foreground">{stage.total}</span>
              </div>

              {/* Progress Bar */}
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted/30">
                <div
                  className={`h-full transition-all duration-500 ${stage.barColor}`}
                  style={{
                    width: `${barWidth}%`,
                  }}
                />
              </div>

              {/* Metrics */}
              <div className="flex items-center justify-between">
                {stage.conversionRate > 0 && (
                  <span className="font-body text-xs text-muted-foreground">
                    Conv: <span className="font-semibold text-foreground">{stage.conversionRate.toFixed(1)}%</span>
                  </span>
                )}
                <span
                  className={`font-body text-xs text-muted-foreground ${stage.conversionRate === 0 ? "ml-auto" : ""}`}
                >
                  {stage.costLabel}:{" "}
                  <span className="font-semibold text-foreground">
                    R${" "}
                    {stage.costValue.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right Side - Intermediate Rates */}
      <div className="flex flex-col justify-around">
        {intermediateRates.map((rate, index) => (
          <div key={index} className="text-center">
            <p className="mb-1 font-body text-xs text-muted-foreground">{rate.label}</p>
            <p className="font-heading text-2xl font-bold text-foreground">{rate.rate.toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
};
export default ConversionFunnel;
