import { useMemo, useEffect, useState } from "react";
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
import {
  Users,
  Activity,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const ymd = (d: Date) => d.toISOString().split("T")[0];

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const getCurrentMonthRange = () => {
  const now = new Date();
  return {
    start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const FunilCrm = () => {
  const initial = getCurrentMonthRange();

  const [startDate, setStartDate] = usePersistedState<string>("funil-crm:start", initial.start);
  const [endDate, setEndDate] = usePersistedState<string>("funil-crm:end", initial.end);
  const [pipe, setPipe] = usePersistedState<Pipe>("funil-crm:pipe", "todos");
  const [lente, setLente] = usePersistedState<Lente>("funil-crm:lente", "evento");
  const [filters, setFilters] = usePersistedState<CrmFunnelFilters>("funil-crm:filters", {});

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

  // Tendência: últimos 6 meses ancorados no endDate (mantém filtros aplicados)
  const trendData = useMemo(() => {
    const anchor = new Date(endDate + "T00:00:00");
    const result: { mes: string; MQL: number; RR: number; ASS: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
      const mStart = ymd(d);
      const mEnd = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      const r = calcFunilCrm({
        leads,
        oportunidades,
        startDate: mStart,
        endDate: mEnd,
        lente,
        pipe,
        filters,
      });
      result.push({
        mes: monthLabels[d.getMonth()],
        MQL: r.mql,
        RR: r.rr,
        ASS: r.ass,
      });
    }
    return result;
  }, [leads, oportunidades, endDate, lente, pipe, filters]);

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

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl space-y-8 px-4 lg:px-8 py-8 animate-fade-in">
        <header>
          <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">
            Revenue
          </p>
          <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-foreground tracking-[-0.02em]">
            Funil CRM
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Performance do funil comercial direto do CRM — leads e oportunidades em tempo real.
          </p>
        </header>

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
            <section className="space-y-4">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">
                RESUMO DO FUNIL
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  icon={Users}
                  label="MQL no período"
                  value={funilData.mql.toLocaleString("pt-BR")}
                  hint="Leads que entraram conforme a lente selecionada"
                />
                <KpiCard
                  icon={Activity}
                  label="Conversão MQL → Ganho"
                  value={`${funilData.conversaoGeral.toFixed(1)}%`}
                  hint="Taxa de fechamento ponta a ponta"
                />
                <KpiCard
                  icon={TrendingUp}
                  label="Ticket médio"
                  value={formatBRL(funilData.ticketMedio)}
                  hint="EF + Fee médio das oportunidades ganhas"
                />
                <KpiCard
                  icon={DollarSign}
                  label="Receita gerada"
                  value={formatBRL(funilData.receitaTotal)}
                  hint="Soma de EF + Fee dos contratos do período"
                />
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">FUNIL</h2>
              <FunilCrmStages data={funilData} />
            </section>

            <section className="space-y-4">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">
                TENDÊNCIA — ÚLTIMOS 6 MESES
              </h2>
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="MQL" stroke="hsl(217,91%,60%)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="RR" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="ASS" stroke="hsl(142,76%,36%)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
}) => (
  <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-5 hover:border-primary/30 transition-colors">
    <div className="flex items-center justify-between mb-3">
      <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <p className="font-display text-2xl lg:text-3xl font-bold text-foreground tabular-nums">{value}</p>
    {hint && <p className="font-body text-[11px] text-muted-foreground/70 mt-2 leading-snug">{hint}</p>}
  </div>
);

export default FunilCrm;
