interface FunnelComparisonProps {
  idealData: {
    mql: number;
    cr: number;
    ra: number;
    rr: number;
    ass: number;
  };
  realData: {
    mql: number;
    cr: number;
    ra: number;
    rr: number;
    ass: number;
  };
}

const FunnelComparison = ({ idealData, realData }: FunnelComparisonProps) => {
  const stages = [
    {
      title: "Leads Comprados (MQL)",
      ideal: idealData.mql,
      real: realData.mql,
      barColor: "bg-[hsl(217,91%,60%)]",
    },
    {
      title: "Contato Realizado (C.R)",
      ideal: idealData.cr,
      real: realData.cr,
      idealConv: idealData.mql > 0 ? (idealData.cr / idealData.mql) * 100 : 0,
      realConv: realData.mql > 0 ? (realData.cr / realData.mql) * 100 : 0,
      barColor: "bg-[hsl(271,76%,53%)]",
    },
    {
      title: "Reunião Agendada (R.A)",
      ideal: idealData.ra,
      real: realData.ra,
      idealConv: idealData.cr > 0 ? (idealData.ra / idealData.cr) * 100 : 0,
      realConv: realData.cr > 0 ? (realData.ra / realData.cr) * 100 : 0,
      barColor: "bg-[hsl(24,95%,53%)]",
    },
    {
      title: "Reunião Realizada (R.R)",
      ideal: idealData.rr,
      real: realData.rr,
      idealConv: idealData.ra > 0 ? (idealData.rr / idealData.ra) * 100 : 0,
      realConv: realData.ra > 0 ? (realData.rr / realData.ra) * 100 : 0,
      barColor: "bg-[hsl(38,92%,50%)]",
    },
    {
      title: "Contrato Assinado (ASS)",
      ideal: idealData.ass,
      real: realData.ass,
      idealConv: idealData.rr > 0 ? (idealData.ass / idealData.rr) * 100 : 0,
      realConv: realData.rr > 0 ? (realData.ass / realData.rr) * 100 : 0,
      barColor: "bg-[hsl(142,76%,36%)]",
    },
  ];

  const maxTotal = Math.max(
    ...stages.map((s) => Math.max(s.ideal, s.real))
  );

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const idealBarWidth = maxTotal > 0 ? (stage.ideal / maxTotal) * 100 : 0;
        const realBarWidth = maxTotal > 0 ? (stage.real / maxTotal) * 100 : 0;
        const gap = stage.real - stage.ideal;
        const gapPercentage = stage.ideal > 0 ? (gap / stage.ideal) * 100 : 0;

        return (
          <div
            key={index}
            className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/30"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-body text-base font-semibold text-foreground">{stage.title}</h3>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-body text-xs text-muted-foreground">Ideal</p>
                  <p className="font-heading text-2xl font-bold text-foreground">{stage.ideal}</p>
                </div>
                <div className="text-right">
                  <p className="font-body text-xs text-muted-foreground">Real</p>
                  <p className="font-heading text-2xl font-bold text-foreground">{stage.real}</p>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="font-body text-xs text-muted-foreground">Gap</p>
                  <p className={`font-heading text-xl font-bold ${gap >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {gap >= 0 ? '+' : ''}{gap}
                  </p>
                  <p className={`font-body text-xs ${gap >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {gap >= 0 ? '+' : ''}{gapPercentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Barras de progresso comparativas */}
            <div className="space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-body text-xs text-muted-foreground">Ideal</span>
                  {stage.idealConv !== undefined && (
                    <span className="font-body text-xs text-muted-foreground">
                      Conv: <span className="font-semibold text-foreground">{stage.idealConv.toFixed(1)}%</span>
                    </span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className={`h-full transition-all duration-500 ${stage.barColor} opacity-50`}
                    style={{ width: `${idealBarWidth}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-body text-xs text-muted-foreground">Real</span>
                  {stage.realConv !== undefined && (
                    <span className="font-body text-xs text-muted-foreground">
                      Conv: <span className="font-semibold text-foreground">{stage.realConv.toFixed(1)}%</span>
                    </span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className={`h-full transition-all duration-500 ${stage.barColor}`}
                    style={{ width: `${realBarWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FunnelComparison;
