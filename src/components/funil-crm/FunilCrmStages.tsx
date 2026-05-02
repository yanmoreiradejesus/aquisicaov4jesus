import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FunilCrmResult, SubStage } from "@/utils/crmFunnelCalculator";

interface Props {
  data: FunilCrmResult;
}

interface StageDef {
  id: string;
  title: string;
  count: number;
  conv?: number; // taxa de conversão da etapa anterior (em %)
  barColor: string;
  subs: SubStage[];
}

const FunilCrmStages = ({ data }: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const stages: StageDef[] = [
    {
      id: "mql",
      title: "MQL — Leads",
      count: data.mql,
      barColor: "bg-[hsl(217,91%,60%)]",
      subs: data.subMql,
    },
    {
      id: "cr",
      title: "CR — Contato Realizado",
      count: data.cr,
      conv: data.convCrMql,
      barColor: "bg-[hsl(271,76%,53%)]",
      subs: data.subCr,
    },
    {
      id: "ra",
      title: "RA — Reunião Agendada",
      count: data.ra,
      conv: data.convRaCr,
      barColor: "bg-[hsl(24,95%,53%)]",
      subs: data.subRa,
    },
    {
      id: "rr",
      title: "RR — Reunião Realizada",
      count: data.rr,
      conv: data.convRrRa,
      barColor: "bg-[hsl(38,92%,50%)]",
      subs: data.subRr,
    },
    {
      id: "ass",
      title: "ASS — Contrato Assinado",
      count: data.ass,
      conv: data.convAssRr,
      barColor: "bg-[hsl(142,76%,36%)]",
      subs: data.subAss,
    },
  ];

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => {
        const barWidth = (stage.count / maxCount) * 100;
        const isOpen = expanded[stage.id] ?? false;
        const hasSubs = stage.subs.some((s) => s.count > 0);

        return (
          <div
            key={stage.id}
            className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-5 transition-all duration-300 hover:shadow-lg hover:border-primary/30 opacity-0 animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <button
                onClick={() => hasSubs && toggle(stage.id)}
                className={`flex items-center gap-2 text-left ${
                  hasSubs ? "cursor-pointer hover:text-primary" : "cursor-default"
                } transition-colors`}
                disabled={!hasSubs}
              >
                {hasSubs ? (
                  isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )
                ) : (
                  <span className="w-4" />
                )}
                <h3 className="font-body text-base font-semibold text-foreground">
                  {stage.title}
                </h3>
              </button>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-body text-xs text-muted-foreground">Total</p>
                  <p className="font-display text-2xl font-bold text-foreground tabular-nums">
                    {stage.count.toLocaleString("pt-BR")}
                  </p>
                </div>
                {stage.conv !== undefined && (
                  <div className="text-right min-w-[80px]">
                    <p className="font-body text-xs text-muted-foreground">
                      Conversão
                    </p>
                    <p className="font-display text-xl font-semibold text-foreground tabular-nums">
                      {stage.conv.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted/30">
              <div
                className={`h-full transition-all duration-500 ${stage.barColor}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Drill-down */}
            {isOpen && hasSubs && (
              <div className="mt-4 pl-6 space-y-2 animate-fade-in">
                {stage.subs
                  .filter((s) => s.count > 0)
                  .map((sub) => {
                    const subPct =
                      stage.count > 0 ? (sub.count / stage.count) * 100 : 0;
                    return (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between gap-3 py-1.5 border-b border-border/20 last:border-0"
                      >
                        <span className="font-body text-sm text-muted-foreground">
                          • {sub.label}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-body text-xs text-muted-foreground tabular-nums">
                            {subPct.toFixed(1)}%
                          </span>
                          <span className="font-body text-sm font-semibold text-foreground tabular-nums min-w-[40px] text-right">
                            {sub.count.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FunilCrmStages;
