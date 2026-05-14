// Funil principal de Data Analytics — alimentado pelo CRM, layout no estilo do legado.
// Reusa toda a lógica de cálculo do antigo FunilCrm e adiciona o grid de KPIs estilo Index.tsx.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmLeads } from "@/hooks/useCrmLeads";
import { useCrmOportunidades } from "@/hooks/useCrmOportunidades";
import { usePersistedState } from "@/hooks/usePersistedState";
import {
  calcFunilCrm,
  getCrmUniqueValues,
  type CrmFunnelFilters,
  type Lente,
  type Pipe,
} from "@/utils/crmFunnelCalculator";
import FunilCrmStages from "@/components/funil-crm/FunilCrmStages";
import FunilCrmFilters, {
  type FunilCrmFiltersState,
} from "@/components/funil-crm/FunilCrmFilters";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar, Clock, GitBranch, TrendingDown, TrendingUp } from "lucide-react";

const ymd = (d: Date) => d.toISOString().split("T")[0];

const fmtBRL0 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const fmtBRL2 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const FunilAnalytics = () => {
  const initial = getCurrentMonthRange();

  const [startDate, setStartDate] = usePersistedState<string>("funil-analytics:start", initial.start);
  const [endDate, setEndDate] = usePersistedState<string>("funil-analytics:end", initial.end);
  const [pipe, setPipe] = usePersistedState<Pipe>("funil-analytics:pipe", "todos");
  const [lente, setLente] = usePersistedState<Lente>("funil-analytics:lente", "evento");
  const [filters, setFilters] = usePersistedState<CrmFunnelFilters>("funil-analytics:filters", {});

  const { data: leads = [], isLoading: leadsLoading } = useCrmLeads();
  const { data: oportunidades = [], isLoading: opsLoading } = useCrmOportunidades();
  const isLoading = leadsLoading || opsLoading;

  // Mapa responsavel_id -> nome
  const [profileNameById, setProfileNameById] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email");
      const map = new Map<string, string>();
      (data ?? []).forEach((p: any) => {
        map.set(p.id, p.full_name || p.email || p.id);
      });
      setProfileNameById(map);
    })();
  }, []);

  const uniqueValues = useMemo(
    () => getCrmUniqueValues(leads, profileNameById),
    [leads, profileNameById],
  );

  const funilData = useMemo(
    () => calcFunilCrm({ leads, oportunidades, startDate, endDate, lente, pipe, filters }),
    [leads, oportunidades, startDate, endDate, lente, pipe, filters],
  );

  // Período anterior — mesma janela deslocada para trás
  const previousPeriodData = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (daysDiff - 1));
    return calcFunilCrm({
      leads,
      oportunidades,
      startDate: ymd(prevStart),
      endDate: ymd(prevEnd),
      lente,
      pipe,
      filters,
    });
  }, [leads, oportunidades, startDate, endDate, lente, pipe, filters]);

  // Time to Close — média (data_fechamento_real − created_at do lead) das oportunidades ganhas no período
  const timeToClose = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T23:59:59");
    const leadById = new Map<string, any>(leads.map((l: any) => [l.id, l]));
    const ganhasNoPeriodo = oportunidades.filter((o: any) => {
      if (o.etapa !== "fechado_ganho" || !o.data_fechamento_real) return false;
      const d = new Date(o.data_fechamento_real);
      return d >= start && d <= end;
    });
    const dias = ganhasNoPeriodo
      .map((o: any) => {
        const lead = leadById.get(o.lead_id);
        const inicio = lead?.data_criacao_origem ?? lead?.created_at;
        if (!inicio) return null;
        const ms = new Date(o.data_fechamento_real).getTime() - new Date(inicio).getTime();
        return ms / (1000 * 60 * 60 * 24);
      })
      .filter((d): d is number => d != null && d >= 0);
    if (dias.length === 0) return 0;
    return dias.reduce((a, b) => a + b, 0) / dias.length;
  }, [leads, oportunidades, startDate, endDate]);

  const filtersState: FunilCrmFiltersState = { startDate, endDate, pipe, lente, filters };
  const setState = (patch: Partial<FunilCrmFiltersState>) => {
    if (patch.startDate !== undefined) setStartDate(patch.startDate);
    if (patch.endDate !== undefined) setEndDate(patch.endDate);
    if (patch.pipe !== undefined) setPipe(patch.pipe);
    if (patch.lente !== undefined) setLente(patch.lente);
    if (patch.filters !== undefined) setFilters(patch.filters);
  };
  const setFilter = <K extends keyof CrmFunnelFilters>(key: K, value: CrmFunnelFilters[K]) => {
    setFilters({ ...filters, [key]: value });
  };

  const useCreationDate = lente === "coorte";
  const toggleLente = () => setLente(useCreationDate ? "evento" : "coorte");

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl space-y-6 lg:space-y-8 px-3 sm:px-4 lg:px-8 py-4 lg:py-8">
        <FunilCrmFilters
          state={filtersState}
          setState={setState}
          setFilter={setFilter}
          uniqueValues={uniqueValues}
        />

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-32 rounded-lg bg-surface-1/40 animate-pulse" />
            <div className="h-96 rounded-lg bg-surface-1/40 animate-pulse" />
          </div>
        ) : (
          <>
            <section className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">
                  FUNIL DE VENDAS
                </h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={useCreationDate ? "default" : "outline"}
                      size="sm"
                      onClick={toggleLente}
                      className="gap-2 text-xs"
                    >
                      {useCreationDate ? <Calendar className="h-3.5 w-3.5" /> : <GitBranch className="h-3.5 w-3.5" />}
                      {useCreationDate ? "Por Data de Criação" : "Por Etapa"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {useCreationDate
                        ? "Todos os estágios filtrados pela data de entrada do lead"
                        : "Cada estágio usa sua própria data de evento (RA, RR, ASS)"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <FunilCrmStages data={funilData} />
            </section>

            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">
                KPIS PRINCIPAIS
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
                {/* CPMQL — placeholder enquanto custo de mídia não está no CRM */}
                <PlaceholderKpiCard
                  label="CPMQL"
                  delay="900ms"
                  hint="Investimento de mídia ainda não trackeado no CRM"
                />

                {/* CAC — placeholder */}
                <PlaceholderKpiCard
                  label="CAC"
                  delay="1050ms"
                  hint="Depende do investimento de mídia (em breve no CRM)"
                />

                {/* Investimento Total — placeholder */}
                <PlaceholderKpiCard
                  label="Investimento Total"
                  delay="1200ms"
                  hint="Depende do investimento de mídia (em breve no CRM)"
                />

                {/* Faturamento Total */}
                <KpiCard
                  label="Faturamento Total"
                  value={fmtBRL2(funilData.receitaTotal)}
                  valueClassName="text-success"
                  delay="1350ms"
                  trend={
                    previousPeriodData && previousPeriodData.receitaTotal > 0
                      ? {
                          better: funilData.receitaTotal > previousPeriodData.receitaTotal,
                          pct:
                            funilData.receitaTotal > previousPeriodData.receitaTotal
                              ? (funilData.receitaTotal / previousPeriodData.receitaTotal - 1) * 100
                              : (1 - funilData.receitaTotal / previousPeriodData.receitaTotal) * 100,
                          higherIsBetter: true,
                        }
                      : undefined
                  }
                />

                {/* Time to Close */}
                <KpiCard
                  label="Time to Close"
                  icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  value={timeToClose > 0 ? `${Math.round(timeToClose)} dias` : "—"}
                  delay="1500ms"
                />
              </div>
            </section>
          </>
        )}

        <footer className="pt-8 pb-4 text-center border-t border-border/30">
          <p className="font-body text-xs text-muted-foreground">
            Dados em tempo real do CRM · {new Date().toLocaleTimeString("pt-BR")}
          </p>
        </footer>
      </main>
    </div>
  );
};

// ── Cards ──

const KpiCard = ({
  label,
  value,
  icon,
  delay,
  trend,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  delay: string;
  trend?: { better: boolean; pct: number; higherIsBetter: boolean };
  valueClassName?: string;
}) => (
  <div
    className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-border/50 p-4 lg:p-6 transition-all duration-300 hover:shadow-lg animate-fade-in"
    style={{ animationDelay: delay, animationFillMode: "backwards" }}
  >
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <p className="font-body text-xs lg:text-sm text-muted-foreground">{label}</p>
    </div>
    <p className={`font-heading text-2xl lg:text-3xl font-bold tabular-nums ${valueClassName}`}>
      {value}
    </p>
    {trend && (
      <div className="mt-2 flex items-center gap-1 text-xs">
        {trend.better ? (
          <>
            {trend.higherIsBetter ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-success" />
            )}
            <span className="text-success">{trend.pct.toFixed(1)}% vs período anterior</span>
          </>
        ) : (
          <>
            {trend.higherIsBetter ? (
              <TrendingDown className="h-3 w-3 text-destructive" />
            ) : (
              <TrendingUp className="h-3 w-3 text-destructive" />
            )}
            <span className="text-destructive">{trend.pct.toFixed(1)}% vs período anterior</span>
          </>
        )}
      </div>
    )}
  </div>
);

const PlaceholderKpiCard = ({
  label,
  hint,
  delay,
}: {
  label: string;
  hint: string;
  delay: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div
        className="rounded-lg bg-gradient-to-br from-card to-muted/5 border border-dashed border-border/50 p-4 lg:p-6 transition-all duration-300 hover:border-border animate-fade-in cursor-help"
        style={{ animationDelay: delay, animationFillMode: "backwards" }}
      >
        <p className="mb-2 font-body text-xs lg:text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl lg:text-3xl font-bold text-muted-foreground/40 tabular-nums">
          —
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground/60 leading-snug">Em breve</p>
      </div>
    </TooltipTrigger>
    <TooltipContent>
      <p className="max-w-[200px] text-xs">{hint}</p>
    </TooltipContent>
  </Tooltip>
);

export default FunilAnalytics;
