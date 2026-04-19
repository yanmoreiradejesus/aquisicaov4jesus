import { useState, useMemo, useCallback } from "react";
import { useGoogleSheetsData, Lead } from "@/hooks/useGoogleSheetsData";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Target, Video, DollarSign, TrendingUp,
  ArrowRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend, Line, ComposedChart, Cell,
} from "recharts";

/* ─── helpers ─── */
const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const MES_SHORT: Record<string, string> = {
  Janeiro:"Jan",Fevereiro:"Fev",Março:"Mar",Abril:"Abr",
  Maio:"Mai",Junho:"Jun",Julho:"Jul",Agosto:"Ago",
  Setembro:"Set",Outubro:"Out",Novembro:"Nov",Dezembro:"Dez",
};
const mesIndex = (m: string) => MESES_PT.indexOf(m);
const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtCur = (n: number) =>
  n >= 10000
    ? `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`
    : `R$ ${fmt(Math.round(n))}`;
const fmtCurFull = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const CANAIS = ["Facebook","Google","Organico","Institucional","Independente","Linkedin","TikTok","Instagram"];

/* ─── normalise lead from sheets ─── */
interface NormLead {
  lead: string; cr: number; ra: boolean; rr: boolean; ass: boolean;
  data: string; cpmql: number; canal: string; tier: string;
  booking: number | null; ef: number | null; mes: string; ano: number;
}

function normaliseLead(l: Lead): NormLead {
  const parseNum = (v: string | undefined) => {
    if (!v || v === "" || v === "-") return null;
    const n = parseFloat(String(v).replace(/[R$\s.]/g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  };
  const parseBool = (v: string | undefined) => {
    if (!v) return false;
    const s = String(v).trim().toUpperCase();
    return s === "1" || s === "SIM" || s === "TRUE" || s === "S";
  };

  const dataStr = l.DATA || "";
  let mes = "";
  let ano = 0;
  if (dataStr) {
    const parts = dataStr.includes("/")
      ? dataStr.split("/")
      : dataStr.split("-");
    if (parts.length >= 3) {
      if (dataStr.includes("/")) {
        const m = parseInt(parts[1], 10);
        ano = parseInt(parts[2], 10);
        if (ano < 100) ano += 2000;
        mes = MESES_PT[m - 1] || "";
      } else {
        ano = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        mes = MESES_PT[m - 1] || "";
      }
    }
  }

  return {
    lead: l.LEAD || (l as any).LEADS || "",
    cr: parseBool(l["C.R"]) ? 1 : (parseNum(l["C.R"]) === 1 ? 1 : 0),
    ra: parseBool(l["R.A"]),
    rr: parseBool(l["R.R"]),
    ass: parseBool(l.ASS),
    data: dataStr,
    cpmql: parseNum(l.CPMQL) ?? 0,
    canal: l.CANAL || "",
    tier: l.TIER || "",
    booking: parseNum(l.BOOKING),
    ef: parseNum(l["E.F"]),
    mes,
    ano,
  };
}

/* ─── component ─── */
const DashboardComercial = () => {
  const { data: sheetsData, isLoading } = useGoogleSheetsData();

  /* filters */
  const [filterAno, setFilterAno] = useState<string>("todos");
  const [filterMeses, setFilterMeses] = useState<string[]>([]);
  const [filterCanais, setFilterCanais] = useState<string[]>([]);
  const [filterTiers, setFilterTiers] = useState<string[]>([]);
  const [chartMode, setChartMode] = useState<"leads_ass" | "funil" | "booking">("leads_ass");

  const allLeads = useMemo<NormLead[]>(() => {
    if (!sheetsData?.leads) return [];
    return sheetsData.leads.map(normaliseLead).filter((l) => l.lead && l.ano > 0);
  }, [sheetsData]);

  const availableAnos = useMemo(() => {
    const set = new Set(allLeads.map((l) => l.ano));
    return Array.from(set).sort();
  }, [allLeads]);

  const availableTiers = useMemo(() => {
    const set = new Set(allLeads.map((l) => l.tier).filter(Boolean));
    return Array.from(set).sort();
  }, [allLeads]);

  const filtered = useMemo(() => {
    let d = allLeads;
    if (filterAno !== "todos") d = d.filter((l) => l.ano === Number(filterAno));
    if (filterMeses.length) d = d.filter((l) => filterMeses.includes(l.mes));
    if (filterCanais.length) d = d.filter((l) => filterCanais.includes(l.canal));
    if (filterTiers.length) d = d.filter((l) => filterTiers.includes(l.tier));
    return d;
  }, [allLeads, filterAno, filterMeses, filterCanais, filterTiers]);

  const clearFilters = useCallback(() => {
    setFilterAno("todos");
    setFilterMeses([]);
    setFilterCanais([]);
    setFilterTiers([]);
  }, []);

  const hasActiveFilters = filterAno !== "todos" || filterMeses.length > 0 || filterCanais.length > 0 || filterTiers.length > 0;

  /* KPIs */
  const kpis = useMemo(() => {
    const total = filtered.length;
    const crCount = filtered.filter((l) => l.cr === 1).length;
    const raCount = filtered.filter((l) => l.ra).length;
    const rrCount = filtered.filter((l) => l.rr).length;
    const assCount = filtered.filter((l) => l.ass).length;
    const bookings = filtered.filter((l) => l.booking != null).map((l) => l.booking!);
    const bookingTotal = bookings.reduce((a, b) => a + b, 0);
    const bookingAvg = bookings.length ? bookingTotal / bookings.length : 0;
    const cpmqlAvg = total ? filtered.reduce((a, l) => a + l.cpmql, 0) / total : 0;
    const efTotal = filtered.filter((l) => l.ef != null).reduce((a, l) => a + l.ef!, 0);
    return {
      total, crCount, raCount, rrCount, assCount,
      crRate: pct(crCount, total),
      raRate: pct(raCount, total),
      rrRate: pct(rrCount, total),
      assRate: pct(assCount, total),
      rrToAss: pct(assCount, rrCount),
      bookingTotal, bookingAvg, cpmqlAvg, efTotal,
    };
  }, [filtered]);

  /* funnel */
  const funnelSteps = useMemo(() => [
    { label: "LEADS", value: kpis.total, color: "hsl(var(--primary))" },
    { label: "C.R", value: kpis.crCount, color: "#8B5CF6" },
    { label: "R.A", value: kpis.raCount, color: "#F59E0B" },
    { label: "R.R", value: kpis.rrCount, color: "#EAB308" },
    { label: "ASS", value: kpis.assCount, color: "hsl(var(--success))" },
  ], [kpis]);

  /* monthly data */
  const monthlyData = useMemo(() => {
    const map = new Map<string, { leads: number; cr: number; ra: number; rr: number; ass: number; booking: number; label: string; sortKey: number }>();
    filtered.forEach((l) => {
      const key = `${l.ano}-${mesIndex(l.mes)}`;
      const short = `${MES_SHORT[l.mes] || l.mes}/${String(l.ano).slice(2)}`;
      if (!map.has(key)) map.set(key, { leads: 0, cr: 0, ra: 0, rr: 0, ass: 0, booking: 0, label: short, sortKey: l.ano * 100 + mesIndex(l.mes) });
      const m = map.get(key)!;
      m.leads++;
      if (l.cr === 1) m.cr++;
      if (l.ra) m.ra++;
      if (l.rr) m.rr++;
      if (l.ass) m.ass++;
      if (l.booking != null) m.booking += l.booking;
    });
    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [filtered]);

  /* by canal */
  const byCanal = useMemo(() => {
    const map = new Map<string, { leads: number; ass: number }>();
    filtered.forEach((l) => {
      if (!l.canal) return;
      if (!map.has(l.canal)) map.set(l.canal, { leads: 0, ass: 0 });
      const c = map.get(l.canal)!;
      c.leads++;
      if (l.ass) c.ass++;
    });
    return Array.from(map.entries()).map(([canal, v]) => ({
      canal, ...v, rate: pct(v.ass, v.leads),
    }));
  }, [filtered]);

  const byCanal_rate = useMemo(() => [...byCanal].sort((a, b) => b.rate - a.rate), [byCanal]);
  const byCanal_vol = useMemo(() => [...byCanal].sort((a, b) => b.leads - a.leads), [byCanal]);

  /* by tier */
  const byTier = useMemo(() => {
    const map = new Map<string, { leads: number; ass: number }>();
    filtered.forEach((l) => {
      if (!l.tier) return;
      if (!map.has(l.tier)) map.set(l.tier, { leads: 0, ass: 0 });
      const t = map.get(l.tier)!;
      t.leads++;
      if (l.ass) t.ass++;
    });
    return Array.from(map.entries())
      .map(([tier, v]) => ({ tier, ...v, rate: pct(v.ass, v.leads) }))
      .sort((a, b) => b.leads - a.leads);
  }, [filtered]);

  /* booking top list */
  const bookingList = useMemo(() =>
    filtered
      .filter((l) => l.booking != null && l.booking > 0)
      .sort((a, b) => b.booking! - a.booking!)
      .slice(0, 10),
  [filtered]);

  /* booking monthly with avg line */
  const bookingMonthly = useMemo(() => {
    const avg = monthlyData.length
      ? monthlyData.reduce((s, m) => s + m.booking, 0) / monthlyData.length
      : 0;
    return monthlyData.map((m) => ({ ...m, avg }));
  }, [monthlyData]);

  const maxLeadsInTier = useMemo(() => Math.max(...byTier.map((t) => t.leads), 1), [byTier]);

  /* ─── Multi-select toggle helper ─── */
  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 lg:px-8 py-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-card p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-6 space-y-6">

        {/* ── FILTERS ── */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filterAno} onValueChange={setFilterAno}>
            <SelectTrigger className="w-[100px] h-8 text-xs bg-card border-border/50">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {availableAnos.map((a) => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mês multi */}
          <div className="relative group">
            <Button variant="outline" size="sm" className="h-8 text-xs border-border/50 bg-card">
              Mês {filterMeses.length > 0 && `(${filterMeses.length})`}
            </Button>
            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px] z-50 hidden group-hover:block">
              {MESES_PT.map((m) => (
                <button key={m} onClick={() => setFilterMeses(toggle(filterMeses, m))}
                  className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${filterMeses.includes(m) ? "bg-primary/20 text-primary" : "text-foreground hover:bg-muted"}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Canal multi */}
          <div className="relative group">
            <Button variant="outline" size="sm" className="h-8 text-xs border-border/50 bg-card">
              Canal {filterCanais.length > 0 && `(${filterCanais.length})`}
            </Button>
            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px] z-50 hidden group-hover:block">
              {CANAIS.map((c) => (
                <button key={c} onClick={() => setFilterCanais(toggle(filterCanais, c))}
                  className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${filterCanais.includes(c) ? "bg-primary/20 text-primary" : "text-foreground hover:bg-muted"}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Tier multi */}
          <div className="relative group">
            <Button variant="outline" size="sm" className="h-8 text-xs border-border/50 bg-card">
              Tier {filterTiers.length > 0 && `(${filterTiers.length})`}
            </Button>
            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px] z-50 hidden group-hover:block">
              {availableTiers.map((t) => (
                <button key={t} onClick={() => setFilterTiers(toggle(filterTiers, t))}
                  className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${filterTiers.includes(t) ? "bg-primary/20 text-primary" : "text-foreground hover:bg-muted"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {/* ── SECTION 1: KPI CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard icon={Users} title="Total de Leads" value={fmt(kpis.total)} subtitle="período filtrado" />
          <KPICard icon={Target} title="Taxa de Assinatura" value={fmtPct(kpis.assRate)} subtitle="lead → contrato" />
          <KPICard icon={Video} title="Reuniões Realizadas" value={fmt(kpis.rrCount)} subtitle={`Taxa R.A: ${fmtPct(kpis.raRate)}`} />
          <KPICard icon={DollarSign} title="Booking Total" value={fmtCurFull(kpis.bookingTotal)} subtitle={`Ticket médio: ${fmtCur(kpis.bookingAvg)}`} />
          <KPICard icon={TrendingUp} title="CPMQL Médio" value={fmtCur(kpis.cpmqlAvg)} subtitle="custo médio por lead" />
        </div>

        {/* ── SECTION 2: FUNNEL ── */}
        <div className="rounded-lg border border-border/50 bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Funil de Conversão</h2>
          <div className="flex items-end justify-between gap-2 md:gap-4 h-48">
            {funnelSteps.map((step, i) => {
              const heightPct = kpis.total ? (step.value / kpis.total) * 100 : 0;
              const prevValue = i > 0 ? funnelSteps[i - 1].value : step.value;
              const loss = prevValue > 0 ? ((prevValue - step.value) / prevValue) * 100 : 0;
              return (
                <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-foreground">{fmt(step.value)}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtPct(pct(step.value, kpis.total))}</span>
                  <div className="w-full flex items-end justify-center" style={{ height: "120px" }}>
                    <div
                      className="w-full max-w-[60px] rounded-t-md transition-all duration-500"
                      style={{ height: `${Math.max(heightPct, 4)}%`, backgroundColor: step.color }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-foreground mt-1">{step.label}</span>
                  {i > 0 && loss > 0 && (
                    <span className="text-[9px] text-destructive">-{loss.toFixed(1)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION 3: MONTHLY EVOLUTION ── */}
        <div className="rounded-lg border border-border/50 bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-medium text-muted-foreground">Evolução Mensal</h2>
            <div className="flex gap-1">
              {(["leads_ass", "funil", "booking"] as const).map((m) => (
                <Button key={m} variant={chartMode === m ? "default" : "outline"} size="sm" className="h-7 text-[10px]"
                  onClick={() => setChartMode(m)}>
                  {m === "leads_ass" ? "Leads × ASS" : m === "funil" ? "Funil Completo" : "Booking"}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === "leads_ass" ? (
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${v}%`} />
                  <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => {
                      if (name === "conv") return [`${value.toFixed(1)}%`, "Conv."];
                      return [fmt(value), name === "leads" ? "Leads" : "ASS"];
                    }} />
                  <Bar yAxisId="left" dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="leads" />
                  <Bar yAxisId="left" dataKey="ass" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="ass" />
                  <Line yAxisId="right" dataKey={(d: any) => d.leads > 0 ? (d.ass / d.leads) * 100 : 0} stroke="#F59E0B" strokeWidth={2} dot={false} name="conv" />
                </ComposedChart>
              ) : chartMode === "funil" ? (
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="cr" stackId="a" fill="#8B5CF6" name="C.R" />
                  <Bar dataKey="ra" stackId="a" fill="#F59E0B" name="R.A" />
                  <Bar dataKey="rr" stackId="a" fill="#EAB308" name="R.R" />
                  <Bar dataKey="ass" stackId="a" fill="hsl(142, 76%, 36%)" name="ASS" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </BarChart>
              ) : (
                <ComposedChart data={bookingMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtCur(v)} />
                  <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtCurFull(v), "Booking"]} />
                  <Bar dataKey="booking" radius={[4, 4, 0, 0]} name="Booking">
                    {bookingMonthly.map((entry, idx) => (
                      <Cell key={idx} fill={entry.booking > entry.avg ? "hsl(var(--success))" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                  <Line dataKey="avg" stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Média" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── SECTION 4: BY CANAL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Taxa por canal */}
          <div className="rounded-lg border border-border/50 bg-card p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Taxa de Assinatura por Canal</h2>
            <div className="space-y-3">
              {byCanal_rate.map((c) => (
                <div key={c.canal} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground">{c.canal}</span>
                    <span className="text-muted-foreground">{fmtPct(c.rate)} ({c.ass} ASS)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(c.rate, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Volume por canal */}
          <div className="rounded-lg border border-border/50 bg-card p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Volume de Leads por Canal</h2>
            <div className="space-y-3">
              {byCanal_vol.map((c) => {
                const maxVol = byCanal_vol[0]?.leads || 1;
                return (
                  <div key={c.canal} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground">{c.canal}</span>
                      <span className="text-muted-foreground">{fmt(c.leads)} ({fmtPct(pct(c.leads, kpis.total))})</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${(c.leads / maxVol) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SECTION 5: BY TIER ── */}
        <div className="rounded-lg border border-border/50 bg-card p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">Conversão por Tier</h2>
          <div className="space-y-4">
            {byTier.map((t) => (
              <div key={t.tier} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-foreground font-medium">{t.tier}</span>
                  <span className="text-muted-foreground">{fmt(t.leads)} leads · {fmt(t.ass)} ASS · {fmtPct(t.rate)}</span>
                </div>
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-muted-foreground/30 rounded-full" style={{ width: `${(t.leads / maxLeadsInTier) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: `${(t.ass / maxLeadsInTier) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── SECTION 6: BOOKING & E.F ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Booking por mês chart — already in evolution toggle, so show E.F total + Booking list */}
          <div className="rounded-lg border border-border/50 bg-card p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Booking por Mês</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={bookingMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => fmtCur(v)} />
                  <RTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtCurFull(v), ""]} />
                  <Bar dataKey="booking" radius={[4, 4, 0, 0]}>
                    {bookingMonthly.map((e, i) => (
                      <Cell key={i} fill={e.booking > e.avg ? "hsl(var(--success))" : "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                  <Line dataKey="avg" stroke="#F59E0B" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Booking list */}
          <div className="rounded-lg border border-border/50 bg-card p-6">
            <h2 className="text-sm font-medium text-muted-foreground mb-2">Top Booking</h2>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {bookingList.length === 0 && <p className="text-xs text-muted-foreground">Nenhum booking encontrado</p>}
              {bookingList.map((l, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                  <div>
                    <span className="text-foreground font-medium">{l.lead}</span>
                    <span className="text-muted-foreground ml-2">{MES_SHORT[l.mes]}/{String(l.ano).slice(2)}</span>
                  </div>
                  <span className="text-foreground font-semibold">{fmtCurFull(l.booking!)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum dado encontrado para os filtros selecionados.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Limpar filtros</Button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── KPI Card ─── */
interface KPICardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
}

const KPICard = ({ icon: Icon, title, value, subtitle }: KPICardProps) => (
  <div className="group relative overflow-hidden rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-5 transition-all duration-300 hover:shadow-lg">
    <div className="flex items-start justify-between">
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-primary/50 to-transparent opacity-50" />
  </div>
);

export default DashboardComercial;
