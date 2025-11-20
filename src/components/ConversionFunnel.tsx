import { useState } from "react";
import LeadsDialog from "./LeadsDialog";
import { isPositive } from "@/utils/dataProcessor";

interface Lead {
  LEAD: string;
  DATA: string;
  "C.R"?: string;
  "R.A"?: string;
  "R.R"?: string;
  ASS?: string;
  CANAL?: string;
  TIER?: string;
  URGÊNCIA?: string;
  CARGO?: string;
  "E-MAIL"?: string;
  CPL?: string;
  "DATA DA ASSINATURA"?: string;
}

interface FunnelStage {
  title: string;
  total: number;
  conversionRate: number;
  costLabel: string;
  costValue: number;
  barColor: string;
  stageKey: string;
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
  leads: Lead[];
  filters: {
    startDate: string;
    endDate: string;
  };
}
const ConversionFunnel = ({ data, leads, filters }: ConversionFunnelProps) => {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const getLeadsForStage = (stageKey: string): Lead[] => {
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);

    console.log(`Getting leads for stage: ${stageKey}`);
    console.log(`Total leads available: ${leads.length}`);

    let result: Lead[] = [];

    switch (stageKey) {
      case "mql":
        result = leads;
        break;
      case "cr":
        result = leads.filter(l => {
          const crValue = l["C.R"];
          const isPos = isPositive(crValue);
          if (isPos) console.log(`CR Lead: ${l.LEAD}, C.R value: "${crValue}"`);
          return isPos;
        });
        break;
      case "ra":
        result = leads.filter(l => {
          const raValue = l["R.A"];
          const isPos = isPositive(raValue);
          if (isPos) console.log(`RA Lead: ${l.LEAD}, R.A value: "${raValue}"`);
          return isPos;
        });
        break;
      case "rr":
        result = leads.filter(l => {
          const rrValue = l["R.R"];
          const isPos = isPositive(rrValue);
          if (isPos) console.log(`RR Lead: ${l.LEAD}, R.R value: "${rrValue}"`);
          return isPos;
        });
        break;
      case "ass":
        result = leads.filter(l => {
          const dataAssinatura = l["DATA DA ASSINATURA"];
          if (!dataAssinatura || dataAssinatura.trim() === "") return false;
          const signatureDate = new Date(dataAssinatura);
          const inRange = signatureDate >= startDate && signatureDate <= endDate;
          if (inRange) console.log(`ASS Lead: ${l.LEAD}, Date: ${dataAssinatura}`);
          return inRange;
        });
        break;
      default:
        result = [];
    }

    console.log(`Stage ${stageKey}: Found ${result.length} leads`);
    if (result.length > 0) {
      console.log(`First lead:`, result[0]);
    }
    return result;
  };

  const handleStageClick = (stageKey: string) => {
    setSelectedStage(stageKey);
    setDialogOpen(true);
  };

  const stages: FunnelStage[] = [
    {
      title: "Leads Comprados (MQL)",
      total: data.mql,
      conversionRate: 0,
      costLabel: "CPMQL",
      costValue: data.cplMedio,
      barColor: "bg-[hsl(217,91%,60%)]",
      stageKey: "mql",
    },
    {
      title: "Contato Realizado (C.R)",
      total: data.cr,
      conversionRate: data.mql > 0 ? (data.cr / data.mql) * 100 : 0,
      costLabel: "Custo p/ C.R",
      costValue: data.custoCR,
      barColor: "bg-[hsl(271,76%,53%)]",
      stageKey: "cr",
    },
    {
      title: "Reunião Agendada (R.A)",
      total: data.ra,
      conversionRate: data.cr > 0 ? (data.ra / data.cr) * 100 : 0,
      costLabel: "CPA",
      costValue: data.cpa,
      barColor: "bg-[hsl(24,95%,53%)]",
      stageKey: "ra",
    },
    {
      title: "Reunião Realizada (R.R)",
      total: data.rr,
      conversionRate: data.ra > 0 ? (data.rr / data.ra) * 100 : 0,
      costLabel: "CPRR",
      costValue: data.cprr,
      barColor: "bg-[hsl(38,92%,50%)]",
      stageKey: "rr",
    },
    {
      title: "Contrato Assinado (ASS)",
      total: data.ass,
      conversionRate: data.rr > 0 ? (data.ass / data.rr) * 100 : 0,
      costLabel: "Ticket Médio",
      costValue: data.ticketMedio,
      barColor: "bg-[hsl(142,76%,36%)]",
      stageKey: "ass",
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
      <div className="flex items-center justify-center animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}>
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
              onClick={() => handleStageClick(stage.stageKey)}
              className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/30 animate-fade-in cursor-pointer hover:scale-[1.02]"
              style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'backwards' }}
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
          <div 
            key={index} 
            className="text-center animate-fade-in"
            style={{ animationDelay: `${(index + 1) * 150 + 100}ms`, animationFillMode: 'backwards' }}
          >
            <p className="mb-1 font-body text-xs text-muted-foreground">{rate.label}</p>
            <p className="font-heading text-2xl font-bold text-foreground">{rate.rate.toFixed(1)}%</p>
          </div>
        ))}
      </div>

      <LeadsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leads={selectedStage ? getLeadsForStage(selectedStage) : []}
        stageTitle={selectedStage ? stages.find(s => s.stageKey === selectedStage)?.title || "" : ""}
      />
    </div>
  );
};
export default ConversionFunnel;
