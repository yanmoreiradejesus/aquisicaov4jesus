import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { FunilCrmResult, SubStage } from "@/utils/crmFunnelCalculator";

interface Props {
  data: FunilCrmResult;
  onOpenLeads?: (stageId: "mql" | "sql" | "sal" | "ass", subId?: string) => void;
}

interface StageDef {
  id: "mql" | "sql" | "sal" | "ass";
  title: string;
  count: number;
  conv?: number;
  barColor: string;
  subs: SubStage[];
}

const FunilCrmStages = ({ data, onOpenLeads }: Props) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const stages: StageDef[] = [
    { id: "mql", title: "MQL", count: data.mql, barColor: "bg-[hsl(217,91%,60%)]", subs: data.subMql },
    { id: "sql", title: "SQL", count: data.sql, conv: data.convSqlMql, barColor: "bg-[hsl(24,95%,53%)]", subs: data.subSql },
    { id: "sal", title: "SAL", count: data.sal, conv: data.convSalSql, barColor: "bg-[hsl(38,92%,50%)]", subs: data.subSal },
    { id: "ass", title: "ASS", count: data.ass, conv: data.convAssSal, barColor: "bg-[hsl(142,76%,36%)]", subs: data.subAss },
  ];

  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

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
                    <p className="font-body text-xs text-muted-foreground">Conversão</p>
                    <p className="font-display text-xl font-semibold text-foreground tabular-nums">
                      {stage.conv.toFixed(1)}%
                    </p>
                  </div>
              </div>

              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted/30">
              <div
                className={`h-full transition-all duration-500 ${stage.barColor}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {isOpen && hasSubs && (
              <div className="mt-4 pl-6 space-y-2 animate-fade-in">
                {stage.subs
                  .filter((s) => s.count > 0)
                  .map((sub) => {
                    const subPct = stage.count > 0 ? (sub.count / stage.count) * 100 : 0;
                    const clickable = !!onOpenLeads;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => clickable && onOpenLeads!(stage.id, sub.id)}
                        disabled={!clickable}
                        className={`w-full flex items-center justify-between gap-3 py-1.5 border-b border-border/20 last:border-0 text-left transition-colors ${
                          clickable ? "hover:text-primary cursor-pointer" : "cursor-default"
                        }`}
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
                      </button>
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
