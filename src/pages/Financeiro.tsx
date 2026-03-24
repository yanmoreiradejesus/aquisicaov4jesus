import { useState, useMemo, useCallback } from "react";
import V4Header from "@/components/V4Header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MOCK_DATA, filterRecords, calcKPIs, calcMonthlyData,
  calcInadByMonth, calcFormatoMix, calcTop10Clientes, calcMeioPagDist,
  calcDSOByMonth, calcTicketByMonth, calcCAGR, calcMonthlyByFormato,
  formatCurrency, formatCurrencyFull, formatPercent, formatDate, MONTH_LABELS,
  FORMATO_COLOR_MAP, VALID_FORMATOS_LIST,
  type FinancialFilters, type FinancialRecord,
} from "@/utils/financialData";
import { useFinancialData } from "@/hooks/useFinancialData";
import {
  DollarSign, TrendingUp, TrendingDown, Percent, Clock, Users, AlertTriangle,
  BarChart3, X, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from "recharts";

const CHART_COLORS = ["#4A90E2", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

const ALL_ANOS = [2024, 2025, 2026];
const ALL_MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const ALL_STATUS = ["Pago", "Em Atraso", "Em Dia"];
const ALL_FORMATOS = ["FEE","ESTRUTURAÇÃO","IMPLEMENTAÇÃO/ONE TIME","ESCOPO FECHADO","PARCELAMENTO","TCV"];
const ALL_MEIOS = ["Boleto", "Cartão", "Pix", "Crédito"];

const CURRENT_MONTH = ALL_MESES[new Date().getMonth()];
const CURRENT_YEAR = new Date().getFullYear();

type ViewMode = "mensal" | "acumulado" | "comparativo";
type MetricMode = "bruto" | "liquido" | "royalties";

const FilterDropdown = ({ label, options, selected, onChange, renderLabel }: {
  label: string;
  options: (string | number)[];
  selected: (string | number)[];
  onChange: (v: (string | number)[]) => void;
  renderLabel?: (v: string | number) => string;
}) => {
  const toggle = (val: string | number) => {
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  };
  const count = selected.length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 min-w-[100px] justify-between">
          <span className="truncate">{count > 0 ? `${label} (${count})` : label}</span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-0.5 max-h-60 overflow-auto">
          {options.map((opt) => (
            <button
              key={String(opt)}
              onClick={() => toggle(opt)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                selected.includes(opt)
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {renderLabel ? renderLabel(opt) : String(opt)}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const KPICard = ({ title, value, subtitle, icon: Icon, color = "primary" }: {
  title: string; value: string; subtitle?: string; icon: any; color?: string;
}) => (
  <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-5 transition-all duration-300 hover:shadow-lg">
    <div className="relative z-10 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
    <div className={`absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-${color}/50 to-transparent opacity-50`} />
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs space-y-1">
      <p className="font-medium text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {formatCurrencyFull(p.value)}
        </p>
      ))}
    </div>
  );
};

const Financeiro = () => {
  const { data: financialResponse, isLoading: isLoadingData } = useFinancialData();
  const [filters, setFilters] = useState<FinancialFilters>({
    anos: [CURRENT_YEAR], meses: [CURRENT_MONTH], status: [], formatos: [], meiosPag: [],
  });
  const [viewMode, setViewMode] = useState<ViewMode>("mensal");
  const [metricMode, setMetricMode] = useState<MetricMode>("bruto");
  const [inadSearch, setInadSearch] = useState("");
  const [inadPage, setInadPage] = useState(0);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);

  const rawData: FinancialRecord[] = financialResponse?.records ?? MOCK_DATA;
  const filtered = useMemo(() => filterRecords(rawData, filters), [rawData, filters]);

  // Determine reference year: selected year or max year in data
  const referenceYear = useMemo(() => {
    if (filters.anos.length > 0) return Math.max(...filters.anos);
    const allYears = rawData.map((r) => r.ano);
    return allYears.length > 0 ? Math.max(...allYears) : CURRENT_YEAR;
  }, [rawData, filters.anos]);

  const prevYear = referenceYear - 1;

  // Year-only filter for time-series: always include previous year for comparison
  const yearOnlyFiltered = useMemo(() => {
    const yearsToInclude = filters.anos.length > 0
      ? [...new Set([...filters.anos, prevYear])]
      : []; // empty = all years
    return filterRecords(rawData, { ...filters, meses: [], anos: yearsToInclude });
  }, [rawData, filters, prevYear]);

  const kpis = useMemo(() => calcKPIs(filtered), [filtered]);
  const cagr = useMemo(() => calcCAGR(rawData, referenceYear, filters.meses), [rawData, referenceYear, filters.meses]);
  const monthlyData = useMemo(() => calcMonthlyData(yearOnlyFiltered), [yearOnlyFiltered]);
  const inadByMonth = useMemo(() => calcInadByMonth(yearOnlyFiltered), [yearOnlyFiltered]);
  const formatoMix = useMemo(() => calcFormatoMix(filtered), [filtered]);
  const top10 = useMemo(() => calcTop10Clientes(filtered), [filtered]);
  const meioPagDist = useMemo(() => calcMeioPagDist(filtered), [filtered]);
  const dsoByMonth = useMemo(() => calcDSOByMonth(yearOnlyFiltered), [yearOnlyFiltered]);
  const ticketByMonth = useMemo(() => calcTicketByMonth(yearOnlyFiltered), [yearOnlyFiltered]);
  const monthlyByFormato = useMemo(() => calcMonthlyByFormato(yearOnlyFiltered), [yearOnlyFiltered]);

  const acumulado = useMemo(() => {
    let acc = 0;
    return monthlyData.map((m) => ({ ...m, acumulado: (acc += m.bruto) }));
  }, [monthlyData]);

  const comparativo = useMemo(() => {
    const monthMap = new Map<number, Record<string, number>>();
    monthlyData.forEach((m) => {
      if (!monthMap.has(m.mesIdx)) monthMap.set(m.mesIdx, {});
      const entry = monthMap.get(m.mesIdx)!;
      entry[`bruto_${m.ano}`] = m.bruto;
      entry[`liquido_${m.ano}`] = m.liquido;
      entry[`royalties_${m.ano}`] = m.royalties;
    });
    const years = [...new Set(monthlyData.map((m) => m.ano))].sort();
    return [...monthMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([mesIdx, data]) => ({ label: MONTH_LABELS[mesIdx], ...data, _years: years }));
  }, [monthlyData]);

  const inadimplentes = useMemo(() => {
    return filtered
      .filter((r) => r.status === "Em Atraso")
      .filter((r) => inadSearch === "" || r.cliente.toLowerCase().includes(inadSearch.toLowerCase()))
      .sort((a, b) => b.valor - a.valor);
  }, [filtered, inadSearch]);

  const clearFilters = () => setFilters({ anos: [], meses: [], status: [], formatos: [], meiosPag: [] });
  const hasFilters = Object.values(filters).some((v) => v.length > 0);

  const inadPageSize = 10;
  const inadTotalPages = Math.ceil(inadimplentes.length / inadPageSize);
  const inadPaged = inadimplentes.slice(inadPage * inadPageSize, (inadPage + 1) * inadPageSize);

  const clienteHistory = useMemo(() => {
    if (!selectedCliente) return [];
    return rawData
      .filter((r) => r.cliente === selectedCliente)
      .sort((a, b) => {
        const da = new Date(a.vencimento).getTime();
        const db = new Date(b.vencimento).getTime();
        return db - da;
      });
  }, [rawData, selectedCliente]);

  const dsoColor = kpis.dso < 7 ? "text-green-400" : kpis.dso < 14 ? "text-yellow-400" : "text-red-400";

  const metricKey = metricMode === "bruto" ? "bruto" : metricMode === "liquido" ? "liquido" : "royalties";
  const metricLabel = metricMode === "bruto" ? "Faturamento Bruto" : metricMode === "liquido" ? "Receita Líquida" : "Royalties";

  const years = [...new Set(monthlyData.map((m) => m.ano))].sort();

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-background">
        <V4Header />
        <div className="container mx-auto px-4 lg:px-8 py-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-80 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      <div className="container mx-auto px-4 lg:px-8 py-6 space-y-6">
        <div className="rounded-lg border border-border/50 bg-card px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterDropdown label="Ano" options={ALL_ANOS} selected={filters.anos} onChange={(v) => setFilters((f) => ({ ...f, anos: v as number[] }))} />
            <FilterDropdown
              label="Mês"
              options={ALL_MESES}
              selected={filters.meses}
              onChange={(v) => setFilters((f) => ({ ...f, meses: v as string[] }))}
              renderLabel={(v) => String(v).charAt(0).toUpperCase() + String(v).slice(1)}
            />
            <FilterDropdown label="Status" options={ALL_STATUS} selected={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v as string[] }))} />
            <FilterDropdown label="Formato" options={ALL_FORMATOS} selected={filters.formatos} onChange={(v) => setFilters((f) => ({ ...f, formatos: v as string[] }))} />
            <FilterDropdown label="Meio Pag." options={ALL_MEIOS} selected={filters.meiosPag} onChange={(v) => setFilters((f) => ({ ...f, meiosPag: v as string[] }))} />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground gap-1 h-8 ml-auto">
                <X className="h-3 w-3" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-border/50 bg-card p-12 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum registro encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Faturamento Bruto" value={formatCurrency(kpis.bruto)} icon={DollarSign} />
              <KPICard title="Receita Líquida" value={formatCurrency(kpis.liquido)} subtitle={`Margem: ${formatPercent(kpis.margem)}`} icon={TrendingUp} color="success" />
              <KPICard title="Royalties" value={formatCurrency(kpis.royalties)} icon={Percent} />
              <KPICard title="Ticket Médio" value={formatCurrency(kpis.ticketMedio)} subtitle={`${kpis.total} contratos`} icon={BarChart3} />
              <KPICard title="Inadimplência" value={formatPercent(kpis.inadRate)} subtitle={formatCurrency(kpis.inadValor)} icon={AlertTriangle} color="destructive" />
              <KPICard
                title="DSO"
                value={`${kpis.dso.toFixed(1).replace(".", ",")} dias`}
                subtitle={kpis.dso < 7 ? "Excelente" : kpis.dso < 14 ? "Atenção" : "Crítico"}
                icon={Clock}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <KPICard title="CAGR" value={formatPercent(cagr)} subtitle={`${referenceYear} vs ${prevYear}`} icon={TrendingUp} />
                  </div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Variação de faturamento: {referenceYear} comparado a {prevYear}.</p></TooltipContent>
              </Tooltip>
              <KPICard title="Clientes Únicos" value={String(kpis.clientesUnicos)} icon={Users} />
            </div>

            {/* MAIN CHART */}
            <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Evolução de Receita</h3>
                <div className="flex flex-wrap gap-2">
                  <div className="flex rounded-md border border-border/50 overflow-hidden">
                    {(["mensal", "acumulado", "comparativo"] as ViewMode[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => setViewMode(v)}
                        className={`px-3 py-1.5 text-xs font-medium transition-all ${
                          viewMode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="flex rounded-md border border-border/50 overflow-hidden">
                    {(["bruto", "liquido", "royalties"] as MetricMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetricMode(m)}
                        className={`px-3 py-1.5 text-xs font-medium transition-all ${
                          metricMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        {m === "bruto" ? "Bruto" : m === "liquido" ? "Líquido" : "Royalties"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {viewMode === "mensal" ? (
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                      <RTooltip content={<CustomTooltip />} />
                      <Bar dataKey={metricKey} fill="#4A90E2" radius={[4, 4, 0, 0]} name={metricLabel} />
                    </BarChart>
                  ) : viewMode === "acumulado" ? (
                    <AreaChart data={acumulado}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                      <RTooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="acumulado" fill="#4A90E2" fillOpacity={0.2} stroke="#4A90E2" name="Acumulado" />
                    </AreaChart>
                  ) : (
                    <BarChart data={comparativo}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                      <RTooltip content={<CustomTooltip />} />
                      {years.map((y, i) => (
                        <Bar key={y} dataKey={`${metricKey}_${y}`} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} name={String(y)} />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* RECEITA POR FORMATO (Stacked Bar) */}
            <div className="rounded-lg border border-border/50 bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Receita por Formato</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyByFormato}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                    <XAxis dataKey="label" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 11 }} />
                    <RTooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {VALID_FORMATOS_LIST.map((fmt) => (
                      <Bar key={fmt} dataKey={fmt} stackId="formato" fill={FORMATO_COLOR_MAP[fmt]} name={fmt} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SECTION 3: Acumulado + Inadimplência */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Faturamento Acumulado</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={acumulado}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 10 }} />
                      <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 10 }} />
                      <RTooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="acumulado" fill="#22C55E" fillOpacity={0.15} stroke="#22C55E" strokeWidth={2} name="Acumulado" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Inadimplência por Mês</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={inadByMonth} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                      <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 10 }} />
                      <YAxis type="category" dataKey="label" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 10 }} width={60} />
                      <RTooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: "hsl(240 10% 3.9%)", border: "1px solid hsl(240 3.7% 15.9%)" }} />
                      <Bar dataKey="rate" name="Inadimplência" radius={[0, 4, 4, 0]}>
                        {inadByMonth.map((entry, i) => (
                          <Cell key={i} fill={entry.rate <= 5 ? "#22C55E" : entry.rate <= 10 ? "#F59E0B" : "#EF4444"} />
                        ))}
                      </Bar>
                      <ReferenceLine x={inadByMonth.length > 0 ? inadByMonth.reduce((s, e) => s + e.rate, 0) / inadByMonth.length : 0} stroke="#888" strokeDasharray="3 3" label={{ value: "Média", fill: "#888", fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* SECTION 4: Ticket + Formato */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Ticket Médio por Mês</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ticketByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 3.7% 15.9%)" />
                      <XAxis dataKey="label" tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 9 }} />
                      <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fill: "hsl(240 5% 64.9%)", fontSize: 10 }} />
                      <RTooltip content={<CustomTooltip />} />
                      {(() => {
                        const avg = ticketByMonth.length > 0 ? ticketByMonth.reduce((s, t) => s + t.ticket, 0) / ticketByMonth.length : 0;
                        return <ReferenceLine y={avg} stroke="#4A90E2" strokeDasharray="3 3" label={{ value: "Média", fill: "#4A90E2", fontSize: 9 }} />;
                      })()}
                      <Line type="monotone" dataKey="ticket" stroke="#4A90E2" strokeWidth={2} dot={{ fill: "#4A90E2", r: 3 }} name="Ticket Médio" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Mix por Formato</h3>
                <div className="h-56 flex items-center">
                  <ResponsiveContainer width="60%" height="100%">
                    <PieChart>
                      <Pie data={formatoMix} dataKey="valor" nameKey="formato" cx="50%" cy="50%" innerRadius={40} outerRadius={70} label={({ formato, pct }) => `${formatPercent(pct)}`}>
                        {formatoMix.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs space-y-1">
                              <p className="font-medium text-foreground">{d.formato}</p>
                              <p className="text-muted-foreground">{formatCurrencyFull(d.valor)}</p>
                              <p className="text-muted-foreground">{formatPercent(d.pct)} do total</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-[40%] space-y-1 overflow-auto max-h-56">
                    {formatoMix.map((f, i) => (
                      <div key={f.formato} className="flex items-center gap-1.5 text-[10px]">
                        <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-muted-foreground truncate">{f.formato}</span>
                        <span className="text-foreground font-medium ml-auto">{formatPercent(f.pct)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 5: Inadimplência ativa */}
            {inadimplentes.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-card p-5 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Inadimplência Ativa ({inadimplentes.length})
                  </h3>
                  <Input
                    placeholder="Buscar cliente..."
                    value={inadSearch}
                    onChange={(e) => { setInadSearch(e.target.value); setInadPage(0); }}
                    className="w-full md:w-64 h-8 text-xs"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50">
                        <th className="text-left py-2 text-muted-foreground font-medium">Cliente</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Valor</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Vencimento</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Dias Atraso</th>
                        <th className="text-center py-2 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Formato</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inadPaged.map((r, i) => (
                        <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                          <td className="py-2 text-foreground font-medium">{r.cliente}</td>
                          <td className="py-2 text-right text-foreground">{formatCurrencyFull(r.valor)}</td>
                          <td className="py-2 text-center text-muted-foreground">{formatDate(r.vencimento)}</td>
                          <td className="py-2 text-center">
                            <Badge variant="outline" className={`text-[10px] ${
                              r.diasAtraso <= 14 ? "border-yellow-500 text-yellow-500" :
                              r.diasAtraso <= 30 ? "border-orange-500 text-orange-500" :
                              "border-red-500 text-red-500"
                            }`}>
                              {r.diasAtraso}d
                            </Badge>
                          </td>
                          <td className="py-2 text-center">
                            <Badge variant="outline" className={`text-[10px] ${
                              r.status === "Em Atraso" ? "border-red-500 text-red-500" : "border-blue-500 text-blue-500"
                            }`}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-2 text-muted-foreground">{r.formato}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {inadTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <Button variant="outline" size="sm" disabled={inadPage === 0} onClick={() => setInadPage((p) => p - 1)} className="text-xs h-7">
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">{inadPage + 1} / {inadTotalPages}</span>
                    <Button variant="outline" size="sm" disabled={inadPage >= inadTotalPages - 1} onClick={() => setInadPage((p) => p + 1)} className="text-xs h-7">
                      Próxima
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 6: Top 10 Clientes */}
            <div className="rounded-lg border border-border/50 bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Top 10 Clientes</h3>
              <div className="space-y-2">
                {top10.map((c, i) => (
                  <div key={c.cliente} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">{c.cliente}</span>
                          <Badge variant="outline" className={`text-[9px] ${
                            c.statusPredominante === "Pago" ? "border-green-500 text-green-500" : "border-red-500 text-red-500"
                          }`}>
                            {c.statusPredominante}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground font-medium">{formatCurrency(c.valor)}</span>
                          <span className="text-[10px] text-muted-foreground">({formatPercent(c.pct)})</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(c.pct * 2, 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 7: Meio de Pagamento */}
            <div className="rounded-lg border border-border/50 bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Distribuição por Meio de Pagamento</h3>
              <div className="space-y-2">
                {meioPagDist.map((m) => (
                  <div key={m.meio} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-foreground w-16">{m.meio}</span>
                    <div className="flex-1 h-6 bg-muted/20 rounded overflow-hidden relative">
                      <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${m.pct}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-foreground">
                        {m.count} ({formatPercent(m.pct)})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Financeiro;
