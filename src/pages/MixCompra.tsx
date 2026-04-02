import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import V4Header from "@/components/V4Header";
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
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { isPositive } from "@/utils/dataProcessor";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import FunnelSkeleton from "@/components/FunnelSkeleton";

// ── helpers ──

const parseDateBR = (d: string): Date | null => {
  if (!d) return null;
  if (d.includes("/")) {
    const [dd, mm, yyyy] = d.split("/");
    return new Date(+yyyy, +mm - 1, +dd);
  }
  return new Date(d);
};

const parseCurrency = (v: string | undefined): number => {
  if (!v || v === "" || v === "-") return 0;
  const s = v.toString().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(s) || 0;
};

const fmtCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const getFunnelStatus = (realPct: number, metaPct: number): "green" | "yellow" | "red" => {
  const diff = realPct - metaPct;
  if (diff >= -1) return "green";
  if (diff >= -4) return "yellow";
  return "red";
};

const getMixStatus = (realPct: number, metaPct: number): "green" | "yellow" | "red" => {
  const absDiff = Math.abs(realPct - metaPct);
  if (absDiff <= 5) return "green";
  if (absDiff <= 10) return "yellow";
  return "red";
};

const getCpmqlStatus = (real: number, meta: number): "green" | "yellow" | "red" => {
  if (real <= meta) return "green";
  if (real <= meta * 1.1) return "yellow";
  return "red";
};

const statusColor: Record<string, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
};

const calcExpectedLeads = (day: number, totalLeads: number, q1Pct: number, q1DiaLimite: number): number => {
  const daysInMonth = 30;
  if (day <= q1DiaLimite) {
    return Math.round(totalLeads * q1Pct * (day / q1DiaLimite));
  }
  const q1Leads = totalLeads * q1Pct;
  const q2Leads = totalLeads * (1 - q1Pct);
  const daysAfterLimit = day - q1DiaLimite;
  const daysRemaining = daysInMonth - q1DiaLimite;
  return Math.round(q1Leads + q2Leads * (daysAfterLimit / daysRemaining));
};

// ── Component ──

const MixCompra = () => {
  const now = new Date();
  const currentDay = now.getDate();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [dialogOpen, setDialogOpen] = useState(false);

  const months = [
    { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
    { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
    { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];
  const years = ["2024", "2025", "2026"];

  // ── Data ──
  const { data: sheetsData, isLoading: sheetsLoading } = useGoogleSheetsData();

  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ["mix_goals", selectedMonth, selectedYear],
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

  // ── Filter leads by month/year ──
  const filteredLeads = useMemo(() => {
    if (!sheetsData?.leads) return [];
    const m = parseInt(selectedMonth);
    const y = parseInt(selectedYear);
    return sheetsData.leads.filter((l) => {
      const d = parseDateBR(l.DATA);
      return d && d.getMonth() + 1 === m && d.getFullYear() === y;
    });
  }, [sheetsData, selectedMonth, selectedYear]);

  // ── Funnel counts ──
  const funnel = useMemo(() => {
    const mql = filteredLeads.length;
    const cr = filteredLeads.filter((l) => isPositive(l["C.R"])).length;
    const ra = filteredLeads.filter((l) => isPositive(l["R.A"])).length;
    const rr = filteredLeads.filter((l) => isPositive(l["R.R"])).length;
    const ass = filteredLeads.filter((l) => isPositive(l.ASS) || (l["DATA DA ASSINATURA"] && l["DATA DA ASSINATURA"].trim() !== "")).length;
    return { mql, cr, ra, rr, ass };
  }, [filteredLeads]);

  // ── KPI calcs ──
  const investimento = useMemo(() => filteredLeads.reduce((s, l) => s + parseCurrency(l.CPMQL), 0), [filteredLeads]);
  const cpmqlMedio = funnel.mql > 0 ? investimento / funnel.mql : 0;

  const leadsTarget = goals?.leads_target ?? 0;
  const cpmqlTarget = goals?.cpmql_target ?? 0;
  const investTarget = goals?.investment_target ?? 0;
  const q1Pct = goals?.pace_q1_pct ?? 0.7;
  const q1DiaLimite = goals?.pace_q1_dia_limite ?? 15;

  const isCurrentMonth = parseInt(selectedMonth) === now.getMonth() + 1 && parseInt(selectedYear) === now.getFullYear();
  const expectedLeads = isCurrentMonth ? calcExpectedLeads(currentDay, leadsTarget, Number(q1Pct), Number(q1DiaLimite)) : leadsTarget;

  const paceStatus = funnel.mql >= expectedLeads ? "green" : funnel.mql >= expectedLeads * 0.85 ? "yellow" : "red";
  const paceLabel = paceStatus === "green" ? "Adiantado" : paceStatus === "yellow" ? "No ritmo" : "Atrasado";

  // ── Funnel meta ──
  const funnelMeta = useMemo(() => {
    if (!goals) return { mql: 0, cr: 0, ra: 0, rr: 0, ass: 0 };
    const mql = leadsTarget;
    const cr = Math.round(mql * Number(goals.cr_rate ?? 0.76));
    const ra = Math.round(cr * Number(goals.ra_rate ?? 0.68));
    const rr = Math.round(ra * Number(goals.rr_rate ?? 0.78));
    const ass = Math.round(rr * Number(goals.ass_rate ?? 0.34));
    return { mql, cr, ra, rr, ass };
  }, [goals, leadsTarget]);

  // ── Mix tables ──
  const normalize = (s: string) => (s || "").toLowerCase().trim();

  const tierData = useMemo(() => {
    const tierMix = (goals?.tier_mix as Record<string, { pct: number; leads: number; cpmql: number }>) || {};
    const realCounts: Record<string, { count: number; cpmqlSum: number }> = {};
    filteredLeads.forEach((l) => {
      const k = normalize(l.TIER);
      if (!k) return;
      if (!realCounts[k]) realCounts[k] = { count: 0, cpmqlSum: 0 };
      realCounts[k].count++;
      realCounts[k].cpmqlSum += parseCurrency(l.CPMQL);
    });
    const allKeys = new Set([
      ...Object.keys(tierMix).map(normalize),
      ...Object.keys(realCounts),
    ]);
    const total = funnel.mql;
    return Array.from(allKeys).map((k) => {
      const metaEntry = Object.entries(tierMix).find(([mk]) => normalize(mk) === k);
      const metaPct = metaEntry ? metaEntry[1].pct * 100 : 0;
      const metaLeads = metaEntry ? metaEntry[1].leads : 0;
      const metaCpmql = metaEntry ? metaEntry[1].cpmql : 0;
      const real = realCounts[k] || { count: 0, cpmqlSum: 0 };
      const realPct = total > 0 ? (real.count / total) * 100 : 0;
      const cpmqlReal = real.count > 0 ? real.cpmqlSum / real.count : 0;
      const label = metaEntry ? metaEntry[0] : k;
      return { label, realLeads: real.count, realPct, metaLeads, metaPct, desvio: realPct - metaPct, cpmqlReal, metaCpmql, status: getStatus(realPct, metaPct), cpmqlStatus: getCpmqlStatus(cpmqlReal, metaCpmql) };
    }).sort((a, b) => b.metaPct - a.metaPct);
  }, [filteredLeads, goals, funnel.mql]);

  const periodoData = useMemo(() => {
    const periodoMix = (goals?.periodo_mix as Record<string, { pct: number; leads: number }>) || {};
    const realCounts: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const k = normalize(l["PERÍODO DE COMPRA"]);
      if (!k) return;
      realCounts[k] = (realCounts[k] || 0) + 1;
    });
    const allKeys = new Set([...Object.keys(periodoMix).map(normalize), ...Object.keys(realCounts)]);
    const total = funnel.mql;
    return Array.from(allKeys).map((k) => {
      const metaEntry = Object.entries(periodoMix).find(([mk]) => normalize(mk) === k);
      const metaPct = metaEntry ? metaEntry[1].pct * 100 : 0;
      const metaLeads = metaEntry ? metaEntry[1].leads : 0;
      const real = realCounts[k] || 0;
      const realPct = total > 0 ? (real / total) * 100 : 0;
      const label = metaEntry ? metaEntry[0] : k;
      return { label, realLeads: real, realPct, metaLeads, metaPct, desvio: realPct - metaPct, status: getStatus(realPct, metaPct) };
    }).sort((a, b) => b.metaPct - a.metaPct);
  }, [filteredLeads, goals, funnel.mql]);

  const canalData = useMemo(() => {
    const canalMix = (goals?.canal_mix as Record<string, { pct: number; leads: number }>) || {};
    const realCounts: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const k = normalize(l.CANAL);
      if (!k) return;
      realCounts[k] = (realCounts[k] || 0) + 1;
    });
    const allKeys = new Set([...Object.keys(canalMix).map(normalize), ...Object.keys(realCounts)]);
    const total = funnel.mql;
    return Array.from(allKeys).map((k) => {
      const metaEntry = Object.entries(canalMix).find(([mk]) => normalize(mk) === k);
      const metaPct = metaEntry ? metaEntry[1].pct * 100 : 0;
      const metaLeads = metaEntry ? metaEntry[1].leads : 0;
      const real = realCounts[k] || 0;
      const realPct = total > 0 ? (real / total) * 100 : 0;
      const label = metaEntry ? metaEntry[0] : k;
      return { label, realLeads: real, realPct, metaLeads, metaPct, desvio: realPct - metaPct, status: getStatus(realPct, metaPct) };
    }).sort((a, b) => b.metaPct - a.metaPct);
  }, [filteredLeads, goals, funnel.mql]);

  // ── Settings dialog state ──
  const [settingsTab, setSettingsTab] = useState("geral");
  const [formData, setFormData] = useState<any>({});
  const [tierRows, setTierRows] = useState<any[]>([]);
  const [periodoRows, setPeriodoRows] = useState<any[]>([]);
  const [canalRows, setCanalRows] = useState<any[]>([]);

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
      setTierRows([]);
      setPeriodoRows([]);
      setCanalRows([]);
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
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
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
        tier_mix: tierMix,
        periodo_mix: periodoMix,
        canal_mix: canalMix,
      };
      const { error } = await supabase.from("mix_goals").upsert(row, { onConflict: "month,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mix_goals"] });
      toast.success("Metas salvas com sucesso!");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar metas"),
  });

  const copyPrevMonth = async () => {
    let pm = parseInt(selectedMonth) - 1;
    let py = parseInt(selectedYear);
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

  // ── Skeleton ──
  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    if (sheetsLoading || goalsLoading) setShowSkeleton(true);
    else { const t = setTimeout(() => setShowSkeleton(false), 300); return () => clearTimeout(t); }
  }, [sheetsLoading, goalsLoading]);

  if (showSkeleton) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <V4Header />
        <div className="mx-auto max-w-7xl p-4 lg:p-8 space-y-8"><FunnelSkeleton /></div>
      </div>
    );
  }

  // ── Render helpers ──
  const StatusDot = ({ status }: { status: string }) => (
    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: statusColor[status] }} />
  );

  const fmtDesvio = (d: number) => {
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d.toFixed(1)}pp`;
  };

  const funnelStages = [
    { key: "mql", label: "MQL", rate: null, metaRate: null },
    { key: "cr", label: "C.R", rate: funnel.mql > 0 ? (funnel.cr / funnel.mql) * 100 : 0, metaRate: Number(goals?.cr_rate ?? 0) * 100 },
    { key: "ra", label: "R.A", rate: funnel.cr > 0 ? (funnel.ra / funnel.cr) * 100 : 0, metaRate: Number(goals?.ra_rate ?? 0) * 100 },
    { key: "rr", label: "R.R", rate: funnel.ra > 0 ? (funnel.rr / funnel.ra) * 100 : 0, metaRate: Number(goals?.rr_rate ?? 0) * 100 },
    { key: "ass", label: "ASS", rate: funnel.rr > 0 ? (funnel.ass / funnel.rr) * 100 : 0, metaRate: Number(goals?.ass_rate ?? 0) * 100 },
  ];

  const sumPct = (rows: { pct: string }[]) => rows.reduce((s, r) => s + (parseFloat(r.pct) || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      <main className="container mx-auto max-w-7xl space-y-6 px-4 lg:px-8 py-8">

        {/* ── Header row ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-body text-sm font-medium text-muted-foreground">Visualizar:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-36 border-border/50 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-28 border-border/50 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
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
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Settings className="h-4 w-4" /> Configurar
              </Button>
            )}
          </Card>
        ) : (
          <>
            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Leads */}
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Leads Comprados</p>
                <p className="text-2xl font-bold">{funnel.mql} <span className="text-sm text-muted-foreground font-normal">/ {leadsTarget}</span></p>
                <Progress value={leadsTarget > 0 ? Math.min((funnel.mql / leadsTarget) * 100, 100) : 0} className="h-2" />
                <p className="text-xs text-muted-foreground">{leadsTarget > 0 ? ((funnel.mql / leadsTarget) * 100).toFixed(0) : 0}%</p>
              </Card>

              {/* CPMQL */}
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">CPMQL Médio</p>
                <p className="text-2xl font-bold" style={{ color: statusColor[getCpmqlStatus(cpmqlMedio, Number(cpmqlTarget))] }}>
                  {fmtCurrency(cpmqlMedio)}
                </p>
                <p className="text-xs text-muted-foreground">Target: {fmtCurrency(Number(cpmqlTarget))}</p>
              </Card>

              {/* Investimento */}
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Investimento</p>
                <p className="text-2xl font-bold">{fmtCurrency(investimento)}</p>
                <Progress value={Number(investTarget) > 0 ? Math.min((investimento / Number(investTarget)) * 100, 100) : 0} className="h-2" />
                <p className="text-xs text-muted-foreground">{Number(investTarget) > 0 ? ((investimento / Number(investTarget)) * 100).toFixed(0) : 0}% de {fmtCurrency(Number(investTarget))}</p>
              </Card>

              {/* Pace */}
              <Card className="p-4 border-border/50 bg-card space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Pace</p>
                <p className="text-2xl font-bold">{funnel.mql} <span className="text-sm text-muted-foreground font-normal">/ {expectedLeads} esp.</span></p>
                <p className="text-sm font-semibold" style={{ color: statusColor[paceStatus] }}>{paceLabel}</p>
                <p className="text-xs text-muted-foreground">dia {currentDay}/30</p>
              </Card>
            </div>

            {/* ── Funnel ── */}
            <Card className="p-4 lg:p-6 border-border/50 bg-card space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Funil</h3>
              {/* Meta line */}
              <div className="flex items-center flex-wrap gap-1 text-sm">
                <span className="font-medium text-muted-foreground">Meta:</span>
                {funnelStages.map((s, i) => (
                  <span key={s.key} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
                    <span className="px-2 py-0.5 rounded bg-muted/30 text-foreground text-xs font-medium">
                      {funnelMeta[s.key as keyof typeof funnelMeta]} {s.label}
                      {s.metaRate !== null && ` (${s.metaRate.toFixed(0)}%)`}
                    </span>
                  </span>
                ))}
              </div>
              {/* Real line */}
              <div className="flex items-center flex-wrap gap-1 text-sm">
                <span className="font-medium text-muted-foreground">Real:</span>
                {funnelStages.map((s, i) => {
                  const st = s.rate !== null && s.metaRate !== null ? getStatus(s.rate, s.metaRate) : "green";
                  return (
                    <span key={s.key} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground mx-1">→</span>}
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: s.rate !== null ? `${statusColor[st]}20` : undefined,
                          color: s.rate !== null ? statusColor[st] : undefined,
                          border: s.rate !== null ? `1px solid ${statusColor[st]}40` : undefined,
                        }}
                      >
                        {funnel[s.key as keyof typeof funnel]} {s.label}
                        {s.rate !== null && ` (${s.rate.toFixed(0)}%)`}
                      </span>
                    </span>
                  );
                })}
              </div>
            </Card>

            {/* ── Mix Tables ── */}
            <Tabs defaultValue="tier">
              <TabsList className="bg-muted/20">
                <TabsTrigger value="tier">Tier</TabsTrigger>
                <TabsTrigger value="periodo">Período</TabsTrigger>
                <TabsTrigger value="canal">Canal</TabsTrigger>
              </TabsList>

              <TabsContent value="tier">
                <Card className="border-border/50 bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead>Tier</TableHead>
                        <TableHead className="text-right">Leads Real</TableHead>
                        <TableHead className="text-right">% Real</TableHead>
                        <TableHead className="text-right">Leads Meta</TableHead>
                        <TableHead className="text-right">% Meta</TableHead>
                        <TableHead className="text-right">Desvio</TableHead>
                        <TableHead className="text-right">CPMQL Real</TableHead>
                        <TableHead className="text-right">CPMQL Meta</TableHead>
                        <TableHead className="text-center">●</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tierData.map((r) => (
                        <TableRow key={r.label}>
                          <TableCell className="font-medium text-xs">{r.label}</TableCell>
                          <TableCell className="text-right">{r.realLeads}</TableCell>
                          <TableCell className="text-right">{r.realPct.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{r.metaLeads}</TableCell>
                          <TableCell className="text-right">{r.metaPct.toFixed(1)}%</TableCell>
                          <TableCell className="text-right" style={{ color: statusColor[r.status] }}>{fmtDesvio(r.desvio)}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(r.cpmqlReal)}</TableCell>
                          <TableCell className="text-right">{fmtCurrency(r.metaCpmql)}</TableCell>
                          <TableCell className="text-center"><StatusDot status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/10 font-semibold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{tierData.reduce((s, r) => s + r.realLeads, 0)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell className="text-right">{tierData.reduce((s, r) => s + r.metaLeads, 0)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell />
                        <TableCell className="text-right">{fmtCurrency(cpmqlMedio)}</TableCell>
                        <TableCell className="text-right">{fmtCurrency(Number(cpmqlTarget))}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="periodo">
                <Card className="border-border/50 bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Leads Real</TableHead>
                        <TableHead className="text-right">% Real</TableHead>
                        <TableHead className="text-right">Leads Meta</TableHead>
                        <TableHead className="text-right">% Meta</TableHead>
                        <TableHead className="text-right">Desvio</TableHead>
                        <TableHead className="text-center">●</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periodoData.map((r) => (
                        <TableRow key={r.label}>
                          <TableCell className="font-medium text-xs">{r.label}</TableCell>
                          <TableCell className="text-right">{r.realLeads}</TableCell>
                          <TableCell className="text-right">{r.realPct.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{r.metaLeads}</TableCell>
                          <TableCell className="text-right">{r.metaPct.toFixed(1)}%</TableCell>
                          <TableCell className="text-right" style={{ color: statusColor[r.status] }}>{fmtDesvio(r.desvio)}</TableCell>
                          <TableCell className="text-center"><StatusDot status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/10 font-semibold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{periodoData.reduce((s, r) => s + r.realLeads, 0)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell className="text-right">{periodoData.reduce((s, r) => s + r.metaLeads, 0)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell /><TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="canal">
                <Card className="border-border/50 bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead>Canal</TableHead>
                        <TableHead className="text-right">Leads Real</TableHead>
                        <TableHead className="text-right">% Real</TableHead>
                        <TableHead className="text-right">Leads Meta</TableHead>
                        <TableHead className="text-right">% Meta</TableHead>
                        <TableHead className="text-right">Desvio</TableHead>
                        <TableHead className="text-center">●</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {canalData.map((r) => (
                        <TableRow key={r.label}>
                          <TableCell className="font-medium text-xs">{r.label}</TableCell>
                          <TableCell className="text-right">{r.realLeads}</TableCell>
                          <TableCell className="text-right">{r.realPct.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">{r.metaLeads}</TableCell>
                          <TableCell className="text-right">{r.metaPct.toFixed(1)}%</TableCell>
                          <TableCell className="text-right" style={{ color: statusColor[r.status] }}>{fmtDesvio(r.desvio)}</TableCell>
                          <TableCell className="text-center"><StatusDot status={r.status} /></TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/10 font-semibold">
                        <TableCell>TOTAL</TableCell>
                        <TableCell className="text-right">{canalData.reduce((s, r) => s + r.realLeads, 0)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell className="text-right">{canalData.reduce((s, r) => s + r.metaLeads, 0)}</TableCell>
                        <TableCell className="text-right">100%</TableCell>
                        <TableCell /><TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* ── Settings Dialog ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-xl">Configurar Metas — {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}</DialogTitle>
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
                    { key: "ef_target", label: "E.F Target (R$)" },
                    { key: "ef_avg", label: "E.F Médio por Fechamento (R$)" },
                    { key: "cr_rate", label: "CR (%)" },
                    { key: "ra_rate", label: "RA (%)" },
                    { key: "rr_rate", label: "RR (%)" },
                    { key: "ass_rate", label: "ASS (%)" },
                    { key: "pace_q1_pct", label: "Pace % 1ª quinzena" },
                    { key: "pace_q1_dia_limite", label: "Pace dia limite" },
                  ].map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <Input
                        type="number"
                        value={formData[f.key] ?? ""}
                        onChange={(e) => setFormData((p: any) => ({ ...p, [f.key]: e.target.value }))}
                        className="bg-background border-border/50"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Tier tab */}
              <TabsContent value="tier" className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead>Tier</TableHead>
                      <TableHead className="w-20">%</TableHead>
                      <TableHead className="w-20">Leads</TableHead>
                      <TableHead className="w-28">CPMQL Target</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tierRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Input value={r.name} onChange={(e) => { const c = [...tierRows]; c[i].name = e.target.value; setTierRows(c); }} className="bg-background border-border/50 h-8 text-xs" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={r.pct} onChange={(e) => { const c = [...tierRows]; c[i].pct = e.target.value; setTierRows(c); }} className="bg-background border-border/50 h-8 text-xs w-16" />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {Math.round((formData.leads_target || 0) * (parseFloat(r.pct) || 0) / 100)}
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={r.cpmql} onChange={(e) => { const c = [...tierRows]; c[i].cpmql = e.target.value; setTierRows(c); }} className="bg-background border-border/50 h-8 text-xs w-24" />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTierRows(tierRows.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => setTierRows([...tierRows, { name: "", pct: "0", cpmql: "0" }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Adicionar tier</Button>
                  <span className={`text-xs font-medium ${Math.abs(sumPct(tierRows) - 100) < 0.1 ? "text-green-500" : "text-red-500"}`}>Soma: {sumPct(tierRows).toFixed(0)}%</span>
                </div>
              </TabsContent>

              {/* Período tab */}
              <TabsContent value="periodo" className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead>Período</TableHead>
                      <TableHead className="w-20">%</TableHead>
                      <TableHead className="w-20">Leads</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periodoRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell><Input value={r.name} onChange={(e) => { const c = [...periodoRows]; c[i].name = e.target.value; setPeriodoRows(c); }} className="bg-background border-border/50 h-8 text-xs" /></TableCell>
                        <TableCell><Input type="number" value={r.pct} onChange={(e) => { const c = [...periodoRows]; c[i].pct = e.target.value; setPeriodoRows(c); }} className="bg-background border-border/50 h-8 text-xs w-16" /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{Math.round((formData.leads_target || 0) * (parseFloat(r.pct) || 0) / 100)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPeriodoRows(periodoRows.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => setPeriodoRows([...periodoRows, { name: "", pct: "0" }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Adicionar período</Button>
                  <span className={`text-xs font-medium ${Math.abs(sumPct(periodoRows) - 100) < 0.1 ? "text-green-500" : "text-red-500"}`}>Soma: {sumPct(periodoRows).toFixed(0)}%</span>
                </div>
              </TabsContent>

              {/* Canal tab */}
              <TabsContent value="canal" className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead>Canal</TableHead>
                      <TableHead className="w-20">%</TableHead>
                      <TableHead className="w-20">Leads</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {canalRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell><Input value={r.name} onChange={(e) => { const c = [...canalRows]; c[i].name = e.target.value; setCanalRows(c); }} className="bg-background border-border/50 h-8 text-xs" /></TableCell>
                        <TableCell><Input type="number" value={r.pct} onChange={(e) => { const c = [...canalRows]; c[i].pct = e.target.value; setCanalRows(c); }} className="bg-background border-border/50 h-8 text-xs w-16" /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{Math.round((formData.leads_target || 0) * (parseFloat(r.pct) || 0) / 100)}</TableCell>
                        <TableCell><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCanalRows(canalRows.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => setCanalRows([...canalRows, { name: "", pct: "0" }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Adicionar canal</Button>
                  <span className={`text-xs font-medium ${Math.abs(sumPct(canalRows) - 100) < 0.1 ? "text-green-500" : "text-red-500"}`}>Soma: {sumPct(canalRows).toFixed(0)}%</span>
                </div>
              </TabsContent>
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
      </main>
    </div>
  );
};

export default MixCompra;
