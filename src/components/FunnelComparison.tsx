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
  targetRates: {
    mql_to_cr_rate: number;
    cr_to_ra_rate: number;
    ra_to_rr_rate: number;
    rr_to_ass_rate: number;
  };
}

const FunnelComparison = ({ idealData, realData, targetRates }: FunnelComparisonProps) => {
  const stages = [
    {
      title: "Leads Comprados (MQL)",
      ideal: idealData.mql,
      realizado: realData.mql,
      barColor: "bg-[hsl(217,91%,60%)]",
    },
    {
      title: "Contato Realizado (C.R)",
      ideal: idealData.cr,
      realizado: realData.cr,
      targetConv: targetRates.mql_to_cr_rate,
      idealizadoConv: idealData.mql > 0 ? (idealData.cr / idealData.mql) * 100 : 0,
      realizadoConv: realData.mql > 0 ? (realData.cr / realData.mql) * 100 : 0,
      barColor: "bg-[hsl(271,76%,53%)]",
    },
    {
      title: "Reunião Agendada (R.A)",
      ideal: idealData.ra,
      realizado: realData.ra,
      targetConv: targetRates.cr_to_ra_rate,
      idealizadoConv: idealData.cr > 0 ? (idealData.ra / idealData.cr) * 100 : 0,
      realizadoConv: realData.cr > 0 ? (realData.ra / realData.cr) * 100 : 0,
      barColor: "bg-[hsl(24,95%,53%)]",
    },
    {
      title: "Reunião Realizada (R.R)",
      ideal: idealData.rr,
      realizado: realData.rr,
      targetConv: targetRates.ra_to_rr_rate,
      idealizadoConv: idealData.ra > 0 ? (idealData.rr / idealData.ra) * 100 : 0,
      realizadoConv: realData.ra > 0 ? (realData.rr / realData.ra) * 100 : 0,
      barColor: "bg-[hsl(38,92%,50%)]",
    },
    {
      title: "Contrato Assinado (ASS)",
      ideal: idealData.ass,
      realizado: realData.ass,
      targetConv: targetRates.rr_to_ass_rate,
      idealizadoConv: idealData.rr > 0 ? (idealData.ass / idealData.rr) * 100 : 0,
      realizadoConv: realData.rr > 0 ? (realData.ass / realData.rr) * 100 : 0,
      barColor: "bg-[hsl(142,76%,36%)]",
    },
  ];

  const maxTotal = Math.max(
    ...stages.map((s) => Math.max(s.ideal, s.realizado))
  );

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const idealBarWidth = maxTotal > 0 ? (stage.ideal / maxTotal) * 100 : 0;
        const realizadoBarWidth = maxTotal > 0 ? (stage.realizado / maxTotal) * 100 : 0;
        
        // Para MQL não há gap de conversão
        const convGap = stage.targetConv !== undefined 
          ? (stage.realizadoConv || 0) - stage.targetConv
          : 0;

        return (
          <div
            key={index}
            className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/30 opacity-0 animate-fade-in"
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-body text-base font-semibold text-foreground">{stage.title}</h3>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-body text-xs text-muted-foreground">Ideal</p>
                  <p className="font-heading text-2xl font-bold text-foreground">{stage.ideal}</p>
                </div>
                <div className="text-right">
                  <p className="font-body text-xs text-muted-foreground">Realizado</p>
                  <p className="font-heading text-2xl font-bold text-foreground">{stage.realizado}</p>
                </div>
                {stage.targetConv !== undefined && (
                  <div className="text-right min-w-[100px]">
                    <p className="font-body text-xs text-muted-foreground">Gap Conv.</p>
                    <p className={`font-heading text-xl font-bold ${convGap >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {convGap >= 0 ? '+' : ''}{convGap.toFixed(1)}%
                    </p>
                    <p className="font-body text-xs text-muted-foreground">
                      Meta: {stage.targetConv}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Barras de progresso comparativas */}
            <div className="space-y-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-body text-xs text-muted-foreground">Ideal</span>
                  {stage.idealizadoConv !== undefined && (
                    <span className="font-body text-xs text-muted-foreground">
                      Conv: <span className="font-semibold text-foreground">{stage.idealizadoConv.toFixed(1)}%</span>
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
                  <span className="font-body text-xs text-muted-foreground">Realizado</span>
                  {stage.realizadoConv !== undefined && (
                    <span className="font-body text-xs text-muted-foreground">
                      Conv: <span className="font-semibold text-foreground">{stage.realizadoConv.toFixed(1)}%</span>
                    </span>
                  )}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                  <div
                    className={`h-full transition-all duration-500 ${stage.barColor}`}
                    style={{ width: `${realizadoBarWidth}%` }}
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
