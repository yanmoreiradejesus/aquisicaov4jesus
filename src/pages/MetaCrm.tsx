import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Settings, Plus, X, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmLeads } from "@/hooks/useCrmLeads";
import { useCrmOportunidades } from "@/hooks/useCrmOportunidades";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import FunnelSkeleton from "@/components/FunnelSkeleton";
import { calcFunilCrm } from "@/utils/crmFunnelCalculator";

// ── helpers ──
const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const getMixStatus = (real: number, meta: number): "green" | "yellow" | "red" => {
  const d = Math.abs(real - meta);
  if (d <= 5) return "green";
  if (d <= 10) return "yellow";
  return "red";
};
const getCpmqlStatus = (real: number, meta: number): "green" | "yellow" | "red" => {
  if (real <= meta) return "green";
  if (real <= meta * 1.1) return "yellow";
  return "red";
};
const statusColor: Record<string, string> = { green: "#10b981", yellow: "#f59e0b", red: "#ef4444" };

const calcExpectedLeads = (day: number, total: number, q1Pct: number, q1Lim: number) => {
  const dim = 30;
  if (day <= q1Lim) return Math.round(total * q1Pct * (day / q1Lim));
  const q1 = total * q1Pct, q2 = total * (1 - q1Pct);
  return Math.round(q1 + q2 * ((day - q1Lim) / (dim - q1Lim)));
};

const getValueColor = (real: number, expected: number) => {
  if (expected === 0) return "#10b981";
  const r = real / expected;
  if (r >= 0.85) return "#10b981";
  if (r >= 0.60) return "#f59e0b";
  return "#ef4444";
};
const getConvColor = (real: number, meta: number) => {
  const d = real - meta;
  if (d >= -1) return "#10b981";
  if (d >= -4) return "#f59e0b";
  return "#ef4444";
};

// Etapas no enum lead_etapa (sem 'desqualificado')
const ETAPAS = ["entrada", "tentativa_contato", "contato_realizado", "reuniao_agendada", "no_show", "reuniao_realizada"];
const reached = (etapa: string, target: string) => {
  const ie = ETAPAS.indexOf(etapa);
  const it = ETAPAS.indexOf(target);
  if (ie < 0 || it < 0) return false;
  // no_show conta como tendo alcançado reuniao_agendada mas não reuniao_realizada
  return ie >= it;
};

const inMonth = (raw: string | null | undefined, m: number, y: number) => {
  if (!raw) return false;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return false;
  return d.getMonth() + 1 === m && d.getFullYear() === y;
};

const MetaCrm = () => {
  const now = new Date();
  const currentDay = now.getDate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [leadsDialogOpen, setLeadsDialogOpen] = useState(false);
  const [leadsDialogStage, setLeadsDialogStage] = useState("");
  const [leadsDialogLeads, setLeadsDialogLeads] = useState<any[]>([]);

  const months = [
    { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
    { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
    { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];
  const years = ["2024", "2025", "2026"];

  const leadsQ = useCrmLeads();
  const opsQ = useCrmOportunidades();
  const allLeads = (leadsQ.data ?? []) as any[];
  const allOps = (opsQ.data ?? []) as any[];

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["mix_goals_crm", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mix_goals")
        .select("*")
        .eq("month", parseInt(selectedMonth))
        .eq("year", parseInt(selectedYear))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const m = parseInt(selectedMonth);
  const y = parseInt(selectedYear);

  // Funil MQL → SQL → SAL → ASS (alinhado com /aquisicao/funil)
  const monthRange = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const last = new Date(y, m, 0).getDate();
    return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
  }, [m, y]);

  const funilResult = useMemo(
    () =>
      calcFunilCrm({
        leads: allLeads,
        oportunidades: allOps,
        startDate: monthRange.start,
        endDate: monthRange.end,
        lente: "evento",
        pipe: "inbound",
      }),
    [allLeads, allOps, monthRange],
  );

  const funnel = {
    mql: funilResult.mql,
    sql: funilResult.sql,
    sal: funilResult.sal,
    ass: funilResult.ass,
  };

  // Leads do mês p/ mix tables (inbound, datados por MQL)
  const monthLeads = funilResult.inMqlLeads;

  const getLeadsByStage = (k: string) => {
    switch (k) {
      case "mql": return funilResult.inMqlLeads;
      case "sql": return funilResult.inSqlLeads;
      case "sal": return funilResult.inSalLeads;
      case "ass": return funilResult.inAssOps;
      default: return [];
    }
  };

  const handleStageClick = (key: string, label: string) => {
    setLeadsDialogLeads(getLeadsByStage(key));
    setLeadsDialogStage(label);
    setLeadsDialogOpen(true);
  };

  // KPI calcs
  const investimento = funilResult.investimentoTotal;
  const cpmqlMedio = funilResult.cpmqlMedio;
  const metaRevenue = funilResult.receitaTotal;

  const leadsTarget = goals?.leads_target ?? 0;
  const cpmqlTarget = goals?.cpmql_target ?? 0;
  const investTarget = goals?.investment_target ?? 0;
  const metaTarget = goals?.ef_target ?? 0;
  const q1Pct = goals?.pace_q1_pct ?? 0.7;
  const q1DiaLimite = goals?.pace_q1_dia_limite ?? 15;

  const isCurrentMonth = m === now.getMonth() + 1 && y === now.getFullYear();
  const expectedLeads = isCurrentMonth
    ? calcExpectedLeads(currentDay, Number(leadsTarget), Number(q1Pct), Number(q1DiaLimite))
    : Number(leadsTarget);

  const paceStatus = funnel.mql >= expectedLeads ? "green" : funnel.mql >= expectedLeads * 0.85 ? "yellow" : "red";
  const paceLabel = paceStatus === "green" ? "Adiantado" : paceStatus === "yellow" ? "No ritmo" : "Atrasado";
  const metaPct = Number(metaTarget) > 0 ? (metaRevenue / Number(metaTarget)) * 100 : 0;
  const metaStatus = metaPct >= 100 ? "green" : metaPct >= 70 ? "yellow" : "red";

  // Conversões esperadas:
  // cr_rate  → MQL→SQL
  // ra_rate  → SQL→SAL
  // ass_rate → SAL→ASS
  const funnelExpected = useMemo(() => {
    if (!goals) return { mql: 0, sql: 0, sal: 0, ass: 0 };
    const mqlE = expectedLeads;
    const sqlE = Math.round(mqlE * Number(goals.cr_rate ?? 0));
    const salE = Math.round(sqlE * Number(goals.ra_rate ?? 0));
    const assE = Math.round(salE * Number(goals.ass_rate ?? 0));
    return { mql: mqlE, sql: sqlE, sal: salE, ass: assE };
  }, [goals, expectedLeads]);

  // Mix tables
  const normalize = (s: string) => (s || "").toLowerCase().trim();
  const buildMix = (leads: any[], pick: (l: any) => string | null | undefined, mixGoal: any, withCpmql = false) => {
    const real: Record<string, { count: number; cpmqlSum: number }> = {};
    leads.forEach((l) => {
      const k = normalize(pick(l) ?? "");
      if (!k) return;
      if (!real[k]) real[k] = { count: 0, cpmqlSum: 0 };
      real[k].count++;
      real[k].cpmqlSum += Number(l.valor_pago) || 0;
    });
    const goalMix = (mixGoal as Record<string, any>) || {};
    const allKeys = new Set([...Object.keys(goalMix).map(normalize), ...Object.keys(real)]);
    const total = leads.length;
    return Array.from(allKeys).map((k) => {
      const ent = Object.entries(goalMix).find(([mk]) => normalize(mk) === k);
      const metaPct = ent ? ent[1].pct * 100 : 0;
      const metaLeads = ent ? ent[1].leads : 0;
      const metaCpmql = ent && withCpmql ? ent[1].cpmql ?? 0 : 0;
      const r = real[k] || { count: 0, cpmqlSum: 0 };
      const realPct = total > 0 ? (r.count / total) * 100 : 0;
      const cpmqlReal = r.count > 0 ? r.cpmqlSum / r.count : 0;
      const label = ent ? ent[0] : k;
      return {
        label, realLeads: r.count, realPct, metaLeads, metaPct,
        desvio: realPct - metaPct, cpmqlReal, metaCpmql,
        status: getMixStatus(realPct, metaPct),
        cpmqlStatus: withCpmql ? getCpmqlStatus(cpmqlReal, metaCpmql) : "green" as const,
      };
    }).sort((a, b) => b.metaPct - a.metaPct);
  };
  const tierData = useMemo(() => buildMix(monthLeads, (l) => l.tier, goals?.tier_mix, true), [monthLeads, goals]);
  const periodoData = useMemo(() => buildMix(monthLeads, (l) => l.urgencia, goals?.periodo_mix), [monthLeads, goals]);
  const canalData = useMemo(() => buildMix(monthLeads, (l) => l.canal, goals?.canal_mix), [monthLeads, goals]);

  // Settings dialog state
  const [formData, setFormData] = useState<any>({});
  const [tierRows, setTierRows] = useState<any[]>([]);
  const [periodoRows, setPeriodoRows] = useState<any[]>([]);
  const [canalRows, setCanalRows] = useState<any[]>([]);
  const [settingsTab, setSettingsTab] = useState("geral");

  useEffect(() => {
    if (dialogOpen && goals) {
      setFormData({
        investment_target: goals.investment_target ?? 45000,
        leads_target: goals.leads_target ?? 52,
        cpmql_target: goals.cpmql_target ?? 865,
        ef_target: goals.ef_target ?? 157000,
        ef_avg: goals.ef_avg ?? 22392,
        cr_rate: Math.round(Number(goals.cr_rate ?? 0.76) * 100),
        ra_rate: Math.round(Number(goals.ra_rate ?? 0.68) * 100),
        rr_rate: Math.round(Number(goals.rr_rate ?? 0.78) * 100),
        ass_rate: Math.round(Number(goals.ass_rate ?? 0.34) * 100),
        pace_q1_pct: Math.round(Number(goals.pace_q1_pct ?? 0.7) * 100),
        pace_q1_dia_limite: goals.pace_q1_dia_limite ?? 15,
      });
      const tm = (goals.tier_mix as Record<string, any>) || {};
      setTierRows(Object.entries(tm).map(([name, v]) => ({ name, pct: (v.pct * 100).toFixed(0), cpmql: v.cpmql })));
      const pm = (goals.periodo_mix as Record<string, any>) || {};
      setPeriodoRows(Object.entries(pm).map(([name, v]) => ({ name, pct: (v.pct * 100).toFixed(0) })));
      const cm = (goals.canal_mix as Record<string, any>) || {};
      setCanalRows(Object.entries(cm).map(([name, v]) => ({ name, pct: (v.pct * 100).toFixed(0) })));
    } else if (dialogOpen && !goals) {
      setFormData({
        investment_target: 45000, leads_target: 52, cpmql_target: 865, ef_target: 157000, ef_avg: 22392,
        cr_rate: 76, ra_rate: 68, rr_rate: 78, ass_rate: 34, pace_q1_pct: 70, pace_q1_dia_limite: 15,
      });
      setTierRows([]); setPeriodoRows([]); setCanalRows([]);
    }
  }, [dialogOpen, goals]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tierMix: Record<string, any> = {};
      tierRows.forEach((r) => {
        if (!r.name.trim()) return;
        tierMix[r.name.trim()] = { pct: parseFloat(r.pct) / 100, leads: Math.round((formData.leads_target || 0) * parseFloat(r.pct) / 100), cpmql: parseFloat(r.cpmql) || 0 };
      });
      const periodoMix: Record<string, any> = {};
      periodoRows.forEach((r) => {
        if (!r.name.trim()) return;
        periodoMix[r.name.trim()] = { pct: parseFloat(r.pct) / 100, leads: Math.round((formData.leads_target || 0) * parseFloat(r.pct) / 100) };
      });
      const canalMix: Record<string, any> = {};
      canalRows.forEach((r) => {
        if (!r.name.trim()) return;
        canalMix[r.name.trim()] = { pct: parseFloat(r.pct) / 100, leads: Math.round((formData.leads_target || 0) * parseFloat(r.pct) / 100) };
      });
      const row = {
        month: m, year: y,
        investment_target: parseFloat(formData.investment_target) || 0,
        leads_target: parseInt(formData.leads_target) || 0,
        cpmql_target: parseFloat(formData.cpmql_target) || 0,
        ef_target: parseFloat(formData.ef_target) || 0,
        ef_avg: parseFloat(formData.ef_avg) || 0,
        cr_rate: (parseFloat(formData.cr_rate) || 0) / 100,
        ra_rate: (parseFloat(formData.ra_rate) || 0) / 100,
        rr_rate: (parseFloat(formData.rr_rate) || 0) / 100,
        ass_rate: (parseFloat(formData.ass_rate) || 0) / 100,
        pace_q1_pct: (parseFloat(formData.pace_q1_pct) || 0) / 100,
        pace_q1_dia_limite: parseInt(formData.pace_q1_dia_limite) || 15,
        tier_mix: tierMix, periodo_mix: periodoMix, canal_mix: canalMix,
      };
      const { error } = await supabase.from("mix_goals").upsert(row, { onConflict: "month,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mix_goals_crm"] });
      queryClient.invalidateQueries({ queryKey: ["mix_goals"] });
      toast.success("Metas salvas com sucesso!");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar metas"),
  });

  const copyPrevMonth = async () => {
    let pm = m - 1, py = y;
    if (pm < 1) { pm = 12; py--; }
    const { data } = await supabase.from("mix_goals").select("*").eq("month", pm).eq("year", py).maybeSingle();
    if (!data) { toast.error("Nenhuma meta encontrada no mês anterior"); return; }
    setFormData({
      investment_target: data.investment_target, leads_target: data.leads_target, cpmql_target: data.cpmql_target,
      ef_target: data.ef_target, ef_avg: data.ef_avg,
      cr_rate: Math.round(Number(data.cr_rate) * 100), ra_rate: Math.round(Number(data.ra_rate) * 100),
      rr_rate: Math.round(Number(data.rr_rate) * 100), ass_rate: Math.round(Number(data.ass_rate) * 100),
      pace_q1_pct: Math.round(Number(data.pace_q1_pct) * 100), pace_q1_dia_limite: data.pace_q1_dia_limite,
    });
    const tm = (data.tier_mix as Record<string, any>) || {};
    setTierRows(Object.entries(tm).map(([name, v]) => ({ name, pct: (v.pct * 100).toFixed(0), cpmql: v.cpmql })));
    const pmx = (data.periodo_mix as Record<string, any>) || {};
    setPeriodoRows(Object.entries(pmx).map(([name, v]) => ({ name, pct: (v.pct * 100).toFixed(0) })));
    const cm = (data.canal_mix as Record<string, any>) || {};
    setCanalRows(Object.entries(cm).map(([name, v]) => ({ name, pct: (v.pct * 100).toFixed(0) })));
    toast.success("Dados do mês anterior copiados");
  };

  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    if (leadsQ.isLoading || opsQ.isLoading || goalsLoading) setShowSkeleton(true);
    else { const t = setTimeout(() => setShowSkeleton(false), 200); return () => clearTimeout(t); }
  }, [leadsQ.isLoading, opsQ.isLoading, goalsLoading]);

  if (showSkeleton) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <div className="mx-auto max-w-7xl p-4 lg:p-8 space-y-8"><FunnelSkeleton /></div>
      </div>
    );
  }

  const StatusDot = ({ status }: { status: string }) => (
    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: statusColor[status] }} />
  );
  const fmtDesvio = (d: number) => `${d >= 0 ? "+" : ""}${d.toFixed(1)}pp`;
  const sumPct = (rows: { pct: string }[]) => rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto max-w-7xl space-y-6 px-4 lg:px-8 py-8">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-body text-sm font-medium text-muted-foreground">Visualizar:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-36 border-border/50 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {months.map((mo) => <SelectItem key={mo.value} value={mo.value}>{mo.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-28 border-border/50 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {years.map((yr) => <SelectItem key={yr} value={yr}>{yr}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground hidden md:inline">Fonte: CRM (inbound)</span>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
              <Settings className="h-4 w-4" /> Configurar
            </Button>
          )}
        </div>

        {!goals ? (
          <Card className="flex flex-col items-center justify-center p-12 gap-4 border-border/50 bg-card">
            <p className="text-muted-foreground text-sm">Metas não configuradas para este mês</p>
            {isAdmin && (
              <Button onClick={() => setDialogOpen(true)} className="gap-2"><Settings className="h-4 w-4" /> Configurar</Button>
            )}
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Leads Comprados</p>
                <p className="text-2xl font-bold">{funnel.mql} <span className="text-sm text-muted-foreground font-normal">/ {leadsTarget}</span></p>
                <Progress value={Number(leadsTarget) > 0 ? Math.min((funnel.mql / Number(leadsTarget)) * 100, 100) : 0} className="h-2" />
                <p className="text-xs text-muted-foreground">{Number(leadsTarget) > 0 ? ((funnel.mql / Number(leadsTarget)) * 100).toFixed(0) : 0}%</p>
              </Card>
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">CPMQL Médio</p>
                <p className="text-2xl font-bold" style={{ color: statusColor[getCpmqlStatus(cpmqlMedio, Number(cpmqlTarget))] }}>
                  {fmtCurrency(cpmqlMedio)}
                </p>
                <p className="text-xs text-muted-foreground">Target: {fmtCurrency(Number(cpmqlTarget))}</p>
              </Card>
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Investimento</p>
                <p className="text-2xl font-bold">{fmtCurrency(investimento)}</p>
                <Progress value={Number(investTarget) > 0 ? Math.min((investimento / Number(investTarget)) * 100, 100) : 0} className="h-2" />
                <p className="text-xs text-muted-foreground">{Number(investTarget) > 0 ? ((investimento / Number(investTarget)) * 100).toFixed(0) : 0}% de {fmtCurrency(Number(investTarget))}</p>
              </Card>
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Meta</p>
                <p className="text-2xl font-bold" style={{ color: statusColor[metaStatus] }}>{fmtCurrency(metaRevenue)}</p>
                <Progress value={Math.min(metaPct, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">{metaPct.toFixed(0)}% de {fmtCurrency(Number(metaTarget))}</p>
              </Card>
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Pace</p>
                <p className="text-2xl font-bold">{funnel.mql} <span className="text-sm text-muted-foreground font-normal">/ {expectedLeads} esp.</span></p>
                <p className="text-sm font-semibold" style={{ color: statusColor[paceStatus] }}>{paceLabel}</p>
                <p className="text-xs text-muted-foreground">dia {currentDay}/30</p>
              </Card>
            </div>

            {/* Funnel SVG */}
            <Card className="p-4 lg:p-6 border-border/50 bg-card">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Funil</h3>
              {(() => {
                const FUNNEL_WIDTH = 700;
                const FUNNEL_CENTER = FUNNEL_WIDTH / 2;
                const STAGE_HEIGHT = 50;
                const GAP = 6;
                const svgStages = [
                  { key: "mql", label: "MQL", real: funnel.mql, expected: funnelExpected.mql, realRate: null as number | null, metaRate: null as number | null, topWidth: 680, bottomWidth: 560 },
                  { key: "sql", label: "SQL", real: funnel.sql, expected: funnelExpected.sql, realRate: funnel.mql > 0 ? Math.round((funnel.sql / funnel.mql) * 100) : 0, metaRate: Math.round(Number(goals?.cr_rate ?? 0) * 100), topWidth: 550, bottomWidth: 420 },
                  { key: "sal", label: "SAL", real: funnel.sal, expected: funnelExpected.sal, realRate: funnel.sql > 0 ? Math.round((funnel.sal / funnel.sql) * 100) : 0, metaRate: Math.round(Number(goals?.ra_rate ?? 0) * 100), topWidth: 410, bottomWidth: 290 },
                  { key: "ass", label: "ASS", real: funnel.ass, expected: funnelExpected.ass, realRate: funnel.sal > 0 ? Math.round((funnel.ass / funnel.sal) * 100) : 0, metaRate: Math.round(Number(goals?.ass_rate ?? 0) * 100), topWidth: 280, bottomWidth: 180 },
                ];
                const totalHeight = svgStages.length * STAGE_HEIGHT + (svgStages.length - 1) * GAP;
                return (
                  <svg viewBox={`0 -20 ${FUNNEL_WIDTH} ${totalHeight + 20}`} className="w-full max-w-3xl mx-auto">
                    <text x={FUNNEL_CENTER - 60} y={-6} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="300" letterSpacing="1.5">VALUE METRICS</text>
                    <text x={FUNNEL_CENTER + 60} y={-6} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontWeight="300" letterSpacing="1.5">CONVERSION RATES</text>
                    {svgStages.map((stage, i) => {
                      const yy = i * (STAGE_HEIGHT + GAP);
                      const halfTop = stage.topWidth / 2;
                      const halfBottom = stage.bottomWidth / 2;
                      const leftColor = getValueColor(stage.real, stage.expected);
                      const rightColor = stage.realRate !== null ? getConvColor(stage.realRate, stage.metaRate!) : leftColor;
                      const leftPoints = [
                        `${FUNNEL_CENTER - halfTop},${yy}`, `${FUNNEL_CENTER},${yy}`,
                        `${FUNNEL_CENTER},${yy + STAGE_HEIGHT}`, `${FUNNEL_CENTER - halfBottom},${yy + STAGE_HEIGHT}`,
                      ].join(" ");
                      const rightPoints = [
                        `${FUNNEL_CENTER},${yy}`, `${FUNNEL_CENTER + halfTop},${yy}`,
                        `${FUNNEL_CENTER + halfBottom},${yy + STAGE_HEIGHT}`, `${FUNNEL_CENTER},${yy + STAGE_HEIGHT}`,
                      ].join(" ");
                      return (
                        <g key={stage.label} className="cursor-pointer" onClick={() => handleStageClick(stage.key, stage.label)}>
                          <polygon points={leftPoints} fill={leftColor} opacity="0.9" />
                          <polygon points={rightPoints} fill={rightColor} opacity="0.9" />
                          <line x1={FUNNEL_CENTER} y1={yy} x2={FUNNEL_CENTER} y2={yy + STAGE_HEIGHT} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                          <text x={FUNNEL_CENTER - 20} y={yy + STAGE_HEIGHT / 2 + 5} textAnchor="end" fill="white" fontSize="13" fontWeight="500">{stage.real} / {stage.expected}</text>
                          <text x={FUNNEL_CENTER} y={yy + 14} textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600" letterSpacing="1">{stage.label}</text>
                          <text x={FUNNEL_CENTER + 20} y={yy + STAGE_HEIGHT / 2 + 5} textAnchor="start" fill="white" fontSize="13" fontWeight="500">{stage.realRate !== null ? `${stage.realRate}% / ${stage.metaRate}%` : "—"}</text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </Card>

            {/* Mix Tables */}
            <Tabs defaultValue="tier">
              <TabsList className="bg-muted/20">
                <TabsTrigger value="tier">Tier</TabsTrigger>
                <TabsTrigger value="periodo">Período (Urgência)</TabsTrigger>
                <TabsTrigger value="canal">Canal</TabsTrigger>
              </TabsList>

              {[
                { val: "tier", data: tierData, label: "Tier", withCpmql: true },
                { val: "periodo", data: periodoData, label: "Período", withCpmql: false },
                { val: "canal", data: canalData, label: "Canal", withCpmql: false },
              ].map((t) => (
                <TabsContent key={t.val} value={t.val}>
                  <Card className="border-border/50 bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                          <TableHead>{t.label}</TableHead>
                          <TableHead className="text-right">Leads Real</TableHead>
                          <TableHead className="text-right">% Real</TableHead>
                          <TableHead className="text-right">Leads Meta</TableHead>
                          <TableHead className="text-right">% Meta</TableHead>
                          <TableHead className="text-right">Desvio</TableHead>
                          {t.withCpmql && <TableHead className="text-right">CPMQL Real</TableHead>}
                          {t.withCpmql && <TableHead className="text-right">CPMQL Meta</TableHead>}
                          <TableHead className="text-center">●</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.data.map((r) => (
                          <TableRow key={r.label}>
                            <TableCell className="font-medium text-xs">{r.label}</TableCell>
                            <TableCell className="text-right">{r.realLeads}</TableCell>
                            <TableCell className="text-right">{r.realPct.toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{r.metaLeads}</TableCell>
                            <TableCell className="text-right">{r.metaPct.toFixed(1)}%</TableCell>
                            <TableCell className="text-right" style={{ color: statusColor[r.status] }}>{fmtDesvio(r.desvio)}</TableCell>
                            {t.withCpmql && <TableCell className="text-right">{fmtCurrency(r.cpmqlReal)}</TableCell>}
                            {t.withCpmql && <TableCell className="text-right">{fmtCurrency(r.metaCpmql)}</TableCell>}
                            <TableCell className="text-center"><StatusDot status={r.status} /></TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/10 font-semibold">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">{t.data.reduce((s, r) => s + r.realLeads, 0)}</TableCell>
                          <TableCell className="text-right">100%</TableCell>
                          <TableCell className="text-right">{t.data.reduce((s, r) => s + r.metaLeads, 0)}</TableCell>
                          <TableCell className="text-right">100%</TableCell>
                          <TableCell />
                          {t.withCpmql && <TableCell className="text-right">{fmtCurrency(cpmqlMedio)}</TableCell>}
                          {t.withCpmql && <TableCell className="text-right">{fmtCurrency(Number(cpmqlTarget))}</TableCell>}
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}

        {/* Settings Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl">Configurar Metas — {months.find((mo) => mo.value === selectedMonth)?.label} {selectedYear}</DialogTitle>
            </DialogHeader>

            <Tabs value={settingsTab} onValueChange={setSettingsTab}>
              <TabsList className="bg-muted/20 mb-4">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="tier">Tier</TabsTrigger>
                <TabsTrigger value="periodo">Período</TabsTrigger>
                <TabsTrigger value="canal">Canal</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: "investment_target", label: "Investimento (R$)" },
                    { key: "leads_target", label: "Leads Target" },
                    { key: "cpmql_target", label: "CPMQL Target (R$)" },
                    { key: "ef_target", label: "Meta (R$)" },
                    { key: "ef_avg", label: "E.F Médio por Fechamento (R$)" },
                    { key: "cr_rate", label: "MQL→SQL (%)" },
                    { key: "ra_rate", label: "SQL→SAL (%)" },
                    { key: "ass_rate", label: "SAL→ASS (%)" },
                    { key: "pace_q1_pct", label: "Pace % 1ª quinzena" },
                    { key: "pace_q1_dia_limite", label: "Pace dia limite" },
                  ].map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <Input type="number" value={formData[f.key] ?? ""} onChange={(e) => setFormData((p: any) => ({ ...p, [f.key]: e.target.value }))} className="bg-background border-border/50" />
                    </div>
                  ))}
                </div>
              </TabsContent>

              {[
                { val: "tier", rows: tierRows, setRows: setTierRows, label: "Tier", withCpmql: true },
                { val: "periodo", rows: periodoRows, setRows: setPeriodoRows, label: "Período", withCpmql: false },
                { val: "canal", rows: canalRows, setRows: setCanalRows, label: "Canal", withCpmql: false },
              ].map((t) => (
                <TabsContent key={t.val} value={t.val} className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead>{t.label}</TableHead>
                        <TableHead className="w-20">%</TableHead>
                        <TableHead className="w-20">Leads</TableHead>
                        {t.withCpmql && <TableHead className="w-28">CPMQL Target</TableHead>}
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {t.rows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell><Input value={r.name} onChange={(e) => { const c = [...t.rows]; c[i].name = e.target.value; t.setRows(c); }} className="bg-background border-border/50 h-8 text-xs" /></TableCell>
                          <TableCell><Input type="number" value={r.pct} onChange={(e) => { const c = [...t.rows]; c[i].pct = e.target.value; t.setRows(c); }} className="bg-background border-border/50 h-8 text-xs w-16" /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">{Math.round((formData.leads_target || 0) * (parseFloat(r.pct) || 0) / 100)}</TableCell>
                          {t.withCpmql && <TableCell><Input type="number" value={r.cpmql ?? ""} onChange={(e) => { const c = [...t.rows]; c[i].cpmql = e.target.value; t.setRows(c); }} className="bg-background border-border/50 h-8 text-xs w-24" /></TableCell>}
                          <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => t.setRows(t.rows.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" onClick={() => t.setRows([...t.rows, t.withCpmql ? { name: "", pct: "0", cpmql: "0" } : { name: "", pct: "0" }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Adicionar</Button>
                    <span className={`text-xs font-medium ${Math.abs(sumPct(t.rows) - 100) < 0.1 ? "text-green-500" : "text-red-500"}`}>Soma: {sumPct(t.rows).toFixed(0)}%</span>
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-between pt-4 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={copyPrevMonth} className="gap-1 text-xs">
                <Copy className="h-3 w-3" /> Copiar do mês anterior
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Leads drilldown */}
        <Dialog open={leadsDialogOpen} onOpenChange={setLeadsDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle>{leadsDialogStage} — {leadsDialogLeads.length} {leadsDialogStage === "ASS" ? "oportunidades" : "leads"}</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  {leadsDialogStage === "ASS" ? (
                    <>
                      <TableHead className="text-right">E.F</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead>Fechamento</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Tier</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Etapa</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadsDialogLeads.map((item: any) => {
                  if (leadsDialogStage === "ASS") {
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">{item.nome_oportunidade ?? "—"}</TableCell>
                        <TableCell className="text-xs">{item.lead?.empresa ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{fmtCurrency(Number(item.valor_ef) || 0)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtCurrency(Number(item.valor_fee) || 0)}</TableCell>
                        <TableCell className="text-xs">{item.data_fechamento_real ? new Date(item.data_fechamento_real).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      </TableRow>
                    );
                  }
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{item.empresa ?? "—"}</TableCell>
                      <TableCell className="text-xs">{item.tier ?? "—"}</TableCell>
                      <TableCell className="text-xs">{item.canal ?? "—"}</TableCell>
                      <TableCell className="text-xs">{item.etapa ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default MetaCrm;
