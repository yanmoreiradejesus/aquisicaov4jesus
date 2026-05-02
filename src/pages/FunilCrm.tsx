import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCrmLeads } from "@/hooks/useCrmLeads";
import { useCrmOportunidades } from "@/hooks/useCrmOportunidades";
import { usePersistedState } from "@/hooks/usePersistedState";
import { calcFunilCrm, type Pipe, type Lente } from "@/utils/crmFunnelCalculator";
import FunilCrmStages from "@/components/funil-crm/FunilCrmStages";
import { cn } from "@/lib/utils";
import { Inbox, Send, Users, Calendar, Activity, TrendingUp, DollarSign } from "lucide-react";
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

const monthsSelect = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];
const years = ["2024", "2025", "2026"];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const FunilCrm = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = usePersistedState<string>(
    "funil-crm:mes",
    String(now.getMonth() + 1),
  );
  const [selectedYear, setSelectedYear] = usePersistedState<string>(
    "funil-crm:ano",
    String(now.getFullYear()),
  );
  const [pipe, setPipe] = usePersistedState<Pipe>("funil-crm:pipe", "todos");
  const [lente, setLente] = usePersistedState<Lente>("funil-crm:lente", "evento");

  const { data: leads = [], isLoading: leadsLoading } = useCrmLeads();
  const { data: oportunidades = [], isLoading: opsLoading } = useCrmOportunidades();
  const isLoading = leadsLoading || opsLoading;

  const mes = parseInt(selectedMonth);
  const ano = parseInt(selectedYear);

  // Cálculo principal
  const funilData = useMemo(
    () => calcFunilCrm({ leads, oportunidades, mes, ano, lente, pipe }),
    [leads, oportunidades, mes, ano, lente, pipe],
  );

  // Tendência: roda o calculador para os últimos 6 meses
  const trendData = useMemo(() => {
    const result: { mes: string; MQL: number; RR: number; ASS: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const r = calcFunilCrm({ leads, oportunidades, mes: m, ano: y, lente, pipe });
      result.push({
        mes: monthsSelect[m - 1].label.slice(0, 3),
        MQL: r.mql,
        RR: r.rr,
        ASS: r.ass,
      });
    }
    return result;
  }, [leads, oportunidades, mes, ano, lente, pipe]);

  const PipeBtn = ({ value, icon: Icon, label }: { value: Pipe; icon: any; label: string }) => (
    <button
      onClick={() => setPipe(value)}
      className={cn(
        "h-9 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 transition-all",
        pipe === value
          ? "bg-foreground text-background shadow-ios-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  const LenteBtn = ({ value, label, hint }: { value: Lente; label: string; hint: string }) => (
    <button
      onClick={() => setLente(value)}
      title={hint}
      className={cn(
        "h-9 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all",
        lente === value
          ? "bg-primary text-primary-foreground shadow-ios-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60",
      )}
    >
      {label}
    </button>
  );

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

        {/* Filtros */}
        <section className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                Período
              </label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36 border-border/50 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {monthsSelect.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-24 border-border/50 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-50">
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl glass shadow-ios-sm">
              <PipeBtn value="todos" icon={Users} label="Todos" />
              <PipeBtn value="inbound" icon={Inbox} label="Inbound" />
              <PipeBtn value="outbound" icon={Send} label="Outbound" />
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl glass shadow-ios-sm">
              <LenteBtn
                value="evento"
                label="Por evento"
                hint="Cada etapa conta no mês do seu próprio evento (RA na agendada, RR na realizada, ASS no fechamento)"
              />
              <LenteBtn
                value="coorte"
                label="Por coorte"
                hint="Conta a safra de leads que entraram no mês selecionado, mostrando quantos chegaram em cada etapa"
              />
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-32 rounded-lg bg-surface-1/40 animate-pulse" />
            <div className="h-96 rounded-lg bg-surface-1/40 animate-pulse" />
          </div>
        ) : (
          <>
            {/* KPIs */}
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

            {/* Funil */}
            <section className="space-y-4">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">
                FUNIL
              </h2>
              <FunilCrmStages data={funilData} />
            </section>

            {/* Tendência */}
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
    <p className="font-display text-2xl lg:text-3xl font-bold text-foreground tabular-nums">
      {value}
    </p>
    {hint && <p className="font-body text-[11px] text-muted-foreground/70 mt-2 leading-snug">{hint}</p>}
  </div>
);

export default FunilCrm;
