import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import V4Header from "@/components/V4Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, AlertTriangle, AlertCircle, Plus, Trash2, Copy } from "lucide-react";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { filterLeads, calculateFunnelData, isPositive } from "@/utils/dataProcessor";
import { useAuth } from "@/hooks/useAuth";
import FunnelSkeleton from "@/components/FunnelSkeleton";

// Parse currency string from sheets
const parseCurrency = (val: string | undefined): number => {
  if (!val || val === "" || val === "-") return 0;
  const str = val.toString().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(str) || 0;
};

const formatCurrency = (val: number) =>
  `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const formatPct = (val: number) => `${(val * 100).toFixed(1)}%`;

type MixEntry = { pct: number; leads: number; cpmql?: number };

const MixCompra = () => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentDay = new Date().getDate();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const months = [
    { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" },
    { value: "3", label: "Março" }, { value: "4", label: "Abril" },
    { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
    { value: "7", label: "Julho" }, { value: "8", label: "Agosto" },
    { value: "9", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];
  const years = ["2024", "2025", "2026"];

  // Fetch mix_goals
  const { data: mixGoal } = useQuery({
    queryKey: ["mix-goals", selectedMonth, selectedYear],
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

  // Fetch previous month for "copy"
  const { data: prevMixGoal } = useQuery({
    queryKey: ["mix-goals-prev", selectedMonth, selectedYear],
    queryFn: async () => {
      const prevM = parseInt(selectedMonth) === 1 ? 12 : parseInt(selectedMonth) - 1;
      const prevY = parseInt(selectedMonth) === 1 ? parseInt(selectedYear) - 1 : parseInt(selectedYear);
      const { data, error } = await supabase
        .from("mix_goals").select("*").eq("month", prevM).eq("year", prevY).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Sheets data
  const { data: sheetsData, isLoading: dataLoading } = useGoogleSheetsData();

  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    if (dataLoading) setShowSkeleton(true);
    else {
      const t = setTimeout(() => setShowSkeleton(false), 300);
      return () => clearTimeout(t);
    }
  }, [dataLoading]);
  const isLoading = dataLoading || showSkeleton;

  // Filter leads for selected month
  const filteredLeads = useMemo(() => {
    if (!sheetsData?.leads) return [];
    const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split("T")[0];
    return filterLeads(sheetsData.leads, {
      startDate, endDate, canal: "all", tier: "all", urgency: "all", cargo: "all", periodo: "all", emailType: "all", hasDescription: "all",
    });
  }, [sheetsData, selectedMonth, selectedYear]);

  // Funnel data
  const funnelData = useMemo(() => {
    if (!sheetsData?.leads) return { mql: 0, cr: 0, ra: 0, rr: 0, ass: 0, investimentoTotal: 0, cplMedio: 0, faturamentoTotal: 0 };
    const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString().split("T")[0];
    const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split("T")[0];
    const filters = { startDate, endDate, canal: "all", tier: "all", urgency: "all", cargo: "all", periodo: "all", emailType: "all", hasDescription: "all" };
    return calculateFunnelData(filteredLeads, filters, sheetsData.leads);
  }, [filteredLeads, sheetsData, selectedMonth, selectedYear]);

  // Real mix breakdowns
  const realTierMix = useMemo(() => {
    const map: Record<string, { leads: number; totalCpmql: number }> = {};
    filteredLeads.forEach((l) => {
      const tier = (l.TIER || "").trim();
      if (!tier) return;
      if (!map[tier]) map[tier] = { leads: 0, totalCpmql: 0 };
      map[tier].leads++;
      map[tier].totalCpmql += parseCurrency(l.CPMQL);
    });
    return map;
  }, [filteredLeads]);

  const realPeriodoMix = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const p = (l["PERÍODO DE COMPRA"] || "").trim();
      if (!p) return;
      map[p] = (map[p] || 0) + 1;
    });
    return map;
  }, [filteredLeads]);

  const realCanalMix = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const c = (l.CANAL || "").trim();
      if (!c) return;
      map[c] = (map[c] || 0) + 1;
    });
    return map;
  }, [filteredLeads]);

  // Parse mix goal JSON safely
  const tierMixGoal = (mixGoal?.tier_mix as Record<string, MixEntry>) || {};
  const periodoMixGoal = (mixGoal?.periodo_mix as Record<string, MixEntry>) || {};
  const canalMixGoal = (mixGoal?.canal_mix as Record<string, MixEntry>) || {};

  const totalLeads = filteredLeads.length;
  const leadsTarget = mixGoal?.leads_target || 52;
  const cpmqlTarget = mixGoal?.cpmql_target || 865;
  const investmentTarget = mixGoal?.investment_target || 45000;
  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  const paceQ1Pct = mixGoal?.pace_q1_pct || 0.7;
  const paceQ1DiaLimite = mixGoal?.pace_q1_dia_limite || 15;
  const isCurrentMonth = parseInt(selectedMonth) === currentMonth && parseInt(selectedYear) === currentYear;

  // Pace calculation
  const paceLeadsExpected = isCurrentMonth && currentDay <= paceQ1DiaLimite
    ? Math.round(leadsTarget * paceQ1Pct * (currentDay / paceQ1DiaLimite))
    : isCurrentMonth
    ? Math.round(leadsTarget * (currentDay / daysInMonth))
    : leadsTarget;
  const paceOk = totalLeads >= paceLeadsExpected;

  // Alerts
  const alerts: { type: "red" | "yellow"; msg: string }[] = [];
  if (mixGoal) {
    if (funnelData.cplMedio > cpmqlTarget) alerts.push({ type: "red", msg: `CPMQL médio (${formatCurrency(funnelData.cplMedio)}) está acima do target (${formatCurrency(cpmqlTarget)})` });

    // Tier deviations
    Object.entries(tierMixGoal).forEach(([tier, goal]) => {
      const realLeads = realTierMix[tier]?.leads || 0;
      const realPct = totalLeads > 0 ? realLeads / totalLeads : 0;
      const dev = Math.abs(realPct - goal.pct);
      if (dev > 0.06) alerts.push({ type: "yellow", msg: `Tier "${tier}" com desvio de ${(dev * 100).toFixed(1)}pp da meta` });
    });

    if (!paceOk && isCurrentMonth) alerts.push({ type: "yellow", msg: `Pace fora do ritmo: ${totalLeads} leads (esperado ${paceLeadsExpected})` });

    // Funnel rates below 80% of goal
    const goalCR = mixGoal.cr_rate || 0.76;
    const goalRA = mixGoal.ra_rate || 0.68;
    const goalRR = mixGoal.rr_rate || 0.78;
    const goalASS = mixGoal.ass_rate || 0.34;
    const realCR = totalLeads > 0 ? funnelData.cr / totalLeads : 0;
    const realRA = funnelData.cr > 0 ? funnelData.ra / funnelData.cr : 0;
    const realRR = funnelData.ra > 0 ? funnelData.rr / funnelData.ra : 0;
    const realASS = funnelData.rr > 0 ? funnelData.ass / funnelData.rr : 0;

    if (realCR < goalCR * 0.8 && totalLeads > 0) alerts.push({ type: "red", msg: `Taxa CR (${(realCR * 100).toFixed(1)}%) abaixo de 80% da meta (${(goalCR * 100).toFixed(1)}%)` });
    if (realRA < goalRA * 0.8 && funnelData.cr > 0) alerts.push({ type: "red", msg: `Taxa RA (${(realRA * 100).toFixed(1)}%) abaixo de 80% da meta (${(goalRA * 100).toFixed(1)}%)` });
    if (realRR < goalRR * 0.8 && funnelData.ra > 0) alerts.push({ type: "red", msg: `Taxa RR (${(realRR * 100).toFixed(1)}%) abaixo de 80% da meta (${(goalRR * 100).toFixed(1)}%)` });
    if (realASS < goalASS * 0.8 && funnelData.rr > 0) alerts.push({ type: "red", msg: `Taxa ASS (${(realASS * 100).toFixed(1)}%) abaixo de 80% da meta (${(goalASS * 100).toFixed(1)}%)` });
  }

  // Semaphore helper
  const semaphore = (realPct: number, goalPct: number) => {
    const dev = Math.abs(realPct - goalPct);
    if (dev <= 0.03) return "text-[#10b981]"; // green
    if (dev <= 0.06) return "text-[#f59e0b]"; // yellow
    return "text-[#ef4444]"; // red
  };

  const semaphoreDot = (realPct: number, goalPct: number) => {
    const dev = Math.abs(realPct - goalPct);
    if (dev <= 0.03) return "bg-[#10b981]";
    if (dev <= 0.06) return "bg-[#f59e0b]";
    return "bg-[#ef4444]";
  };

  // Funnel table rows
  const funnelRows = mixGoal ? [
    { stage: "MQL", real: funnelData.mql, meta: leadsTarget, rateReal: 1, rateMeta: 1 },
    { stage: "CR", real: funnelData.cr, meta: Math.round(leadsTarget * (mixGoal.cr_rate || 0.76)), rateReal: totalLeads > 0 ? funnelData.cr / totalLeads : 0, rateMeta: mixGoal.cr_rate || 0.76 },
    { stage: "RA", real: funnelData.ra, meta: Math.round(leadsTarget * (mixGoal.cr_rate || 0.76) * (mixGoal.ra_rate || 0.68)), rateReal: funnelData.cr > 0 ? funnelData.ra / funnelData.cr : 0, rateMeta: mixGoal.ra_rate || 0.68 },
    { stage: "RR", real: funnelData.rr, meta: Math.round(leadsTarget * (mixGoal.cr_rate || 0.76) * (mixGoal.ra_rate || 0.68) * (mixGoal.rr_rate || 0.78)), rateReal: funnelData.ra > 0 ? funnelData.rr / funnelData.ra : 0, rateMeta: mixGoal.rr_rate || 0.78 },
    { stage: "ASS", real: funnelData.ass, meta: Math.round(leadsTarget * (mixGoal.cr_rate || 0.76) * (mixGoal.ra_rate || 0.68) * (mixGoal.rr_rate || 0.78) * (mixGoal.ass_rate || 0.34)), rateReal: funnelData.rr > 0 ? funnelData.ass / funnelData.rr : 0, rateMeta: mixGoal.ass_rate || 0.34 },
  ] : [];

  // ---- Settings Dialog State ----
  const [editGeneral, setEditGeneral] = useState<any>({});
  const [editTier, setEditTier] = useState<{ name: string; pct: number; leads: number; cpmql: number }[]>([]);
  const [editPeriodo, setEditPeriodo] = useState<{ name: string; pct: number; leads: number }[]>([]);
  const [editCanal, setEditCanal] = useState<{ name: string; pct: number; leads: number }[]>([]);

  useEffect(() => {
    if (isDialogOpen && mixGoal) {
      setEditGeneral({
        investment_target: mixGoal.investment_target,
        leads_target: mixGoal.leads_target,
        cpmql_target: mixGoal.cpmql_target,
        ef_target: mixGoal.ef_target,
        ef_avg: mixGoal.ef_avg,
        cr_rate: (mixGoal.cr_rate || 0) * 100,
        ra_rate: (mixGoal.ra_rate || 0) * 100,
        rr_rate: (mixGoal.rr_rate || 0) * 100,
        ass_rate: (mixGoal.ass_rate || 0) * 100,
        pace_q1_pct: (mixGoal.pace_q1_pct || 0) * 100,
        pace_q1_dia_limite: mixGoal.pace_q1_dia_limite,
      });
      setEditTier(Object.entries(tierMixGoal).map(([name, v]) => ({
        name, pct: v.pct * 100, leads: v.leads, cpmql: v.cpmql || 0,
      })));
      setEditPeriodo(Object.entries(periodoMixGoal).map(([name, v]) => ({
        name, pct: v.pct * 100, leads: v.leads,
      })));
      setEditCanal(Object.entries(canalMixGoal).map(([name, v]) => ({
        name, pct: v.pct * 100, leads: v.leads,
      })));
    } else if (isDialogOpen && !mixGoal) {
      setEditGeneral({
        investment_target: 45000, leads_target: 52, cpmql_target: 865,
        ef_target: 157000, ef_avg: 22392,
        cr_rate: 76, ra_rate: 68, rr_rate: 78, ass_rate: 34,
        pace_q1_pct: 70, pace_q1_dia_limite: 15,
      });
      setEditTier([]);
      setEditPeriodo([]);
      setEditCanal([]);
    }
  }, [isDialogOpen, mixGoal]);

  const updateTierLeads = (idx: number, newPct: number) => {
    setEditTier((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, pct: newPct, leads: Math.round((editGeneral.leads_target || 52) * newPct / 100) } : t
      )
    );
  };

  const updatePeriodoLeads = (idx: number, newPct: number) => {
    setEditPeriodo((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, pct: newPct, leads: Math.round((editGeneral.leads_target || 52) * newPct / 100) } : t
      )
    );
  };

  const updateCanalLeads = (idx: number, newPct: number) => {
    setEditCanal((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, pct: newPct, leads: Math.round((editGeneral.leads_target || 52) * newPct / 100) } : t
      )
    );
  };

  const tierPctSum = editTier.reduce((s, t) => s + t.pct, 0);
  const periodoPctSum = editPeriodo.reduce((s, t) => s + t.pct, 0);
  const canalPctSum = editCanal.reduce((s, t) => s + t.pct, 0);

  const copyFromPrev = () => {
    if (!prevMixGoal) {
      toast.error("Nenhuma meta encontrada no mês anterior");
      return;
    }
    setEditGeneral({
      investment_target: prevMixGoal.investment_target,
      leads_target: prevMixGoal.leads_target,
      cpmql_target: prevMixGoal.cpmql_target,
      ef_target: prevMixGoal.ef_target,
      ef_avg: prevMixGoal.ef_avg,
      cr_rate: (prevMixGoal.cr_rate || 0) * 100,
      ra_rate: (prevMixGoal.ra_rate || 0) * 100,
      rr_rate: (prevMixGoal.rr_rate || 0) * 100,
      ass_rate: (prevMixGoal.ass_rate || 0) * 100,
      pace_q1_pct: (prevMixGoal.pace_q1_pct || 0) * 100,
      pace_q1_dia_limite: prevMixGoal.pace_q1_dia_limite,
    });
    const prevTier = (prevMixGoal.tier_mix as Record<string, MixEntry>) || {};
    setEditTier(Object.entries(prevTier).map(([name, v]) => ({ name, pct: v.pct * 100, leads: v.leads, cpmql: v.cpmql || 0 })));
    const prevPeriodo = (prevMixGoal.periodo_mix as Record<string, MixEntry>) || {};
    setEditPeriodo(Object.entries(prevPeriodo).map(([name, v]) => ({ name, pct: v.pct * 100, leads: v.leads })));
    const prevCanal = (prevMixGoal.canal_mix as Record<string, MixEntry>) || {};
    setEditCanal(Object.entries(prevCanal).map(([name, v]) => ({ name, pct: v.pct * 100, leads: v.leads })));
    toast.success("Dados copiados do mês anterior");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tierObj: Record<string, MixEntry> = {};
      editTier.forEach((t) => { tierObj[t.name] = { pct: t.pct / 100, leads: t.leads, cpmql: t.cpmql }; });
      const periodoObj: Record<string, MixEntry> = {};
      editPeriodo.forEach((t) => { periodoObj[t.name] = { pct: t.pct / 100, leads: t.leads }; });
      const canalObj: Record<string, MixEntry> = {};
      editCanal.forEach((t) => { canalObj[t.name] = { pct: t.pct / 100, leads: t.leads }; });

      const payload = {
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        investment_target: parseFloat(editGeneral.investment_target) || 0,
        leads_target: parseInt(editGeneral.leads_target) || 0,
        cpmql_target: parseFloat(editGeneral.cpmql_target) || 0,
        ef_target: parseFloat(editGeneral.ef_target) || 0,
        ef_avg: parseFloat(editGeneral.ef_avg) || 0,
        cr_rate: (parseFloat(editGeneral.cr_rate) || 0) / 100,
        ra_rate: (parseFloat(editGeneral.ra_rate) || 0) / 100,
        rr_rate: (parseFloat(editGeneral.rr_rate) || 0) / 100,
        ass_rate: (parseFloat(editGeneral.ass_rate) || 0) / 100,
        pace_q1_pct: (parseFloat(editGeneral.pace_q1_pct) || 0) / 100,
        pace_q1_dia_limite: parseInt(editGeneral.pace_q1_dia_limite) || 15,
        tier_mix: tierObj,
        periodo_mix: periodoObj,
        canal_mix: canalObj,
      };

      const { error } = await supabase.from("mix_goals").upsert(payload, { onConflict: "month,year" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mix-goals"] });
      toast.success("Metas salvas com sucesso!");
      setIsDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar metas"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <V4Header />
        <div className="mx-auto max-w-7xl p-4 lg:p-8 space-y-8"><FunnelSkeleton /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      <main className="container mx-auto max-w-7xl space-y-6 lg:space-y-8 px-4 lg:px-8 py-8">

        {/* Top bar: month/year selector + settings */}
        <section className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <label className="font-body text-sm font-medium text-muted-foreground">Visualizar:</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40 border-border/50 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32 border-border/50 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto gap-2">
                    <Settings className="h-4 w-4" /> Configurar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
                  <DialogHeader>
                    <DialogTitle className="font-heading text-xl text-foreground">
                      Configurar Mix — {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                    </DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue="geral" className="mt-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="geral">Geral</TabsTrigger>
                      <TabsTrigger value="tier">Tier</TabsTrigger>
                      <TabsTrigger value="periodo">Período</TabsTrigger>
                      <TabsTrigger value="canal">Canal</TabsTrigger>
                    </TabsList>

                    {/* Geral */}
                    <TabsContent value="geral" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { key: "investment_target", label: "Investimento Target (R$)" },
                          { key: "leads_target", label: "Leads Target" },
                          { key: "cpmql_target", label: "CPMQL Target (R$)" },
                          { key: "ef_target", label: "E.F Target (R$)" },
                          { key: "ef_avg", label: "E.F Médio (R$)" },
                          { key: "cr_rate", label: "CR (%)" },
                          { key: "ra_rate", label: "RA (%)" },
                          { key: "rr_rate", label: "RR (%)" },
                          { key: "ass_rate", label: "ASS (%)" },
                          { key: "pace_q1_pct", label: "Pace % 1ª Quinzena" },
                          { key: "pace_q1_dia_limite", label: "Dia Limite" },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
                            <Input
                              type="number"
                              value={editGeneral[key] ?? ""}
                              onChange={(e) => setEditGeneral((p: any) => ({ ...p, [key]: e.target.value }))}
                              className="bg-background border-border/50"
                            />
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    {/* Tier */}
                    <TabsContent value="tier" className="space-y-4 mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Tier</TableHead><TableHead>% </TableHead><TableHead>Leads</TableHead><TableHead>CPMQL</TableHead><TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editTier.map((t, i) => (
                            <TableRow key={i} className="hover:bg-muted/5">
                              <TableCell>
                                <Input value={t.name} onChange={(e) => setEditTier((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="bg-background border-border/50" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={t.pct} onChange={(e) => updateTierLeads(i, parseFloat(e.target.value) || 0)} className="bg-background border-border/50 w-20" />
                              </TableCell>
                              <TableCell className="text-muted-foreground">{t.leads}</TableCell>
                              <TableCell>
                                <Input type="number" value={t.cpmql} onChange={(e) => setEditTier((p) => p.map((x, j) => j === i ? { ...x, cpmql: parseFloat(e.target.value) || 0 } : x))} className="bg-background border-border/50 w-24" />
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setEditTier((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" onClick={() => setEditTier((p) => [...p, { name: "", pct: 0, leads: 0, cpmql: 0 }])}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
                        <span className={`text-sm font-medium ${Math.abs(tierPctSum - 100) < 0.5 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                          Soma: {tierPctSum.toFixed(1)}%
                        </span>
                      </div>
                    </TabsContent>

                    {/* Período */}
                    <TabsContent value="periodo" className="space-y-4 mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Período</TableHead><TableHead>%</TableHead><TableHead>Leads</TableHead><TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editPeriodo.map((t, i) => (
                            <TableRow key={i} className="hover:bg-muted/5">
                              <TableCell>
                                <Input value={t.name} onChange={(e) => setEditPeriodo((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="bg-background border-border/50" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={t.pct} onChange={(e) => updatePeriodoLeads(i, parseFloat(e.target.value) || 0)} className="bg-background border-border/50 w-20" />
                              </TableCell>
                              <TableCell className="text-muted-foreground">{t.leads}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setEditPeriodo((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" onClick={() => setEditPeriodo((p) => [...p, { name: "", pct: 0, leads: 0 }])}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
                        <span className={`text-sm font-medium ${Math.abs(periodoPctSum - 100) < 0.5 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                          Soma: {periodoPctSum.toFixed(1)}%
                        </span>
                      </div>
                    </TabsContent>

                    {/* Canal */}
                    <TabsContent value="canal" className="space-y-4 mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Canal</TableHead><TableHead>%</TableHead><TableHead>Leads</TableHead><TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editCanal.map((t, i) => (
                            <TableRow key={i} className="hover:bg-muted/5">
                              <TableCell>
                                <Input value={t.name} onChange={(e) => setEditCanal((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className="bg-background border-border/50" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" value={t.pct} onChange={(e) => updateCanalLeads(i, parseFloat(e.target.value) || 0)} className="bg-background border-border/50 w-20" />
                              </TableCell>
                              <TableCell className="text-muted-foreground">{t.leads}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => setEditCanal((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between">
                        <Button variant="outline" size="sm" onClick={() => setEditCanal((p) => [...p, { name: "", pct: 0, leads: 0 }])}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</Button>
                        <span className={`text-sm font-medium ${Math.abs(canalPctSum - 100) < 0.5 ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                          Soma: {canalPctSum.toFixed(1)}%
                        </span>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="flex gap-3 mt-6 justify-end">
                    <Button variant="outline" size="sm" onClick={copyFromPrev} className="gap-2">
                      <Copy className="h-3.5 w-3.5" /> Copiar do mês anterior
                    </Button>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={() => saveMutation.mutate()} className="bg-[hsl(0,84.2%,60.2%)] text-white hover:bg-[hsl(0,84.2%,50%)]">
                      Salvar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </section>

        {/* No goals configured */}
        {!mixGoal && (
          <Card className="p-8 text-center border-border/50 bg-gradient-to-br from-card to-muted/5">
            <p className="text-muted-foreground mb-4">Metas não configuradas para este mês</p>
            {isAdmin && (
              <Button onClick={() => setIsDialogOpen(true)} className="bg-[hsl(0,84.2%,60.2%)] text-white hover:bg-[hsl(0,84.2%,50%)]">
                <Settings className="h-4 w-4 mr-2" /> Configurar Metas
              </Button>
            )}
          </Card>
        )}

        {mixGoal && (
          <>
            {/* KPIs */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Leads */}
              <Card className="p-5 border-border/50 bg-gradient-to-br from-card to-muted/5">
                <p className="text-xs text-muted-foreground mb-1">Leads Comprados</p>
                <p className="font-heading text-2xl font-bold text-foreground">{totalLeads} <span className="text-sm font-normal text-muted-foreground">/ {leadsTarget}</span></p>
                <Progress value={Math.min((totalLeads / leadsTarget) * 100, 100)} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">{((totalLeads / leadsTarget) * 100).toFixed(1)}%</p>
              </Card>

              {/* CPMQL */}
              <Card className="p-5 border-border/50 bg-gradient-to-br from-card to-muted/5">
                <p className="text-xs text-muted-foreground mb-1">CPMQL Médio</p>
                <p className={`font-heading text-2xl font-bold ${funnelData.cplMedio <= cpmqlTarget ? "text-[#10b981]" : "text-[#ef4444]"}`}>
                  {formatCurrency(funnelData.cplMedio)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Target: {formatCurrency(cpmqlTarget)}</p>
              </Card>

              {/* Investimento */}
              <Card className="p-5 border-border/50 bg-gradient-to-br from-card to-muted/5">
                <p className="text-xs text-muted-foreground mb-1">Investimento</p>
                <p className="font-heading text-2xl font-bold text-foreground">{formatCurrency(funnelData.investimentoTotal)}</p>
                <Progress value={Math.min((funnelData.investimentoTotal / investmentTarget) * 100, 100)} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">{((funnelData.investimentoTotal / investmentTarget) * 100).toFixed(1)}% de {formatCurrency(investmentTarget)}</p>
              </Card>

              {/* Pace */}
              <Card className="p-5 border-border/50 bg-gradient-to-br from-card to-muted/5">
                <p className="text-xs text-muted-foreground mb-1">Pace</p>
                {isCurrentMonth ? (
                  <>
                    <p className={`font-heading text-2xl font-bold ${paceOk ? "text-[#10b981]" : "text-[#f59e0b]"}`}>
                      {totalLeads} <span className="text-sm font-normal text-muted-foreground">/ {paceLeadsExpected} esperado</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {paceOk ? "Ritmo adequado" : "Abaixo do ritmo"} — dia {currentDay}/{daysInMonth}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Apenas para mês atual</p>
                )}
              </Card>
            </section>

            {/* Alerts */}
            {alerts.length > 0 && (
              <section className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className={`flex items-center gap-3 rounded-lg border p-3 ${a.type === "red" ? "border-[#ef4444]/30 bg-[#ef4444]/5" : "border-[#f59e0b]/30 bg-[#f59e0b]/5"}`}>
                    {a.type === "red" ? <AlertCircle className="h-4 w-4 text-[#ef4444] shrink-0" /> : <AlertTriangle className="h-4 w-4 text-[#f59e0b] shrink-0" />}
                    <span className={`text-sm ${a.type === "red" ? "text-[#ef4444]" : "text-[#f59e0b]"}`}>{a.msg}</span>
                  </div>
                ))}
              </section>
            )}

            {/* Funnel Real vs Meta */}
            <section className="space-y-4">
              <h2 className="font-body text-lg font-semibold text-foreground">FUNIL REAL VS META</h2>
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead className="text-foreground">Etapa</TableHead>
                      <TableHead className="text-foreground text-right">Realizado</TableHead>
                      <TableHead className="text-foreground text-right">Meta</TableHead>
                      <TableHead className="text-foreground text-right">Taxa Real</TableHead>
                      <TableHead className="text-foreground text-right">Taxa Meta</TableHead>
                      <TableHead className="text-foreground text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnelRows.map((row) => (
                      <TableRow key={row.stage} className="hover:bg-muted/5">
                        <TableCell className="font-medium text-foreground">{row.stage}</TableCell>
                        <TableCell className="text-right text-foreground">{row.real}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.meta}</TableCell>
                        <TableCell className="text-right text-foreground">{row.stage === "MQL" ? "—" : formatPct(row.rateReal)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.stage === "MQL" ? "—" : formatPct(row.rateMeta)}</TableCell>
                        <TableCell className="text-center">
                          {row.stage === "MQL" ? (
                            <div className={`w-3 h-3 rounded-full mx-auto ${row.real >= row.meta ? "bg-[#10b981]" : "bg-[#ef4444]"}`} />
                          ) : (
                            <div className={`w-3 h-3 rounded-full mx-auto ${semaphoreDot(row.rateReal, row.rateMeta)}`} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            {/* Mix por Tier */}
            <MixTable
              title="MIX POR TIER"
              goalEntries={tierMixGoal}
              realMap={realTierMix}
              totalLeads={totalLeads}
              showCpmql
              semaphore={semaphore}
              semaphoreDot={semaphoreDot}
            />

            {/* Mix por Período */}
            <MixTable
              title="MIX POR PERÍODO"
              goalEntries={periodoMixGoal}
              realMap={realPeriodoMix}
              totalLeads={totalLeads}
              semaphore={semaphore}
              semaphoreDot={semaphoreDot}
            />

            {/* Mix por Canal */}
            <MixTable
              title="MIX POR CANAL"
              goalEntries={canalMixGoal}
              realMap={realCanalMix}
              totalLeads={totalLeads}
              semaphore={semaphore}
              semaphoreDot={semaphoreDot}
            />
          </>
        )}
      </main>
    </div>
  );
};

// Reusable mix comparison table
interface MixTableProps {
  title: string;
  goalEntries: Record<string, MixEntry>;
  realMap: Record<string, number | { leads: number; totalCpmql: number }>;
  totalLeads: number;
  showCpmql?: boolean;
  semaphore: (r: number, g: number) => string;
  semaphoreDot: (r: number, g: number) => string;
}

const MixTable = ({ title, goalEntries, realMap, totalLeads, showCpmql, semaphoreDot }: MixTableProps) => {
  // Combine all keys from goal and real
  const allKeys = Array.from(new Set([...Object.keys(goalEntries), ...Object.keys(realMap)]));

  const getReal = (key: string) => {
    // Try case-insensitive match
    const realKey = Object.keys(realMap).find((k) => k.toLowerCase() === key.toLowerCase()) || key;
    const val = realMap[realKey];
    if (typeof val === "number") return { leads: val, cpmql: 0 };
    if (val && typeof val === "object") return { leads: val.leads, cpmql: val.totalCpmql / (val.leads || 1) };
    return { leads: 0, cpmql: 0 };
  };

  return (
    <section className="space-y-4">
      <h2 className="font-body text-lg font-semibold text-foreground">{title}</h2>
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/10 hover:bg-muted/10">
              <TableHead className="text-foreground">{title.split(" ").pop()}</TableHead>
              <TableHead className="text-foreground text-right">Leads Real</TableHead>
              <TableHead className="text-foreground text-right">% Real</TableHead>
              <TableHead className="text-foreground text-right">Leads Meta</TableHead>
              <TableHead className="text-foreground text-right">% Meta</TableHead>
              <TableHead className="text-foreground text-right">Desvio</TableHead>
              {showCpmql && <TableHead className="text-foreground text-right">CPMQL Real</TableHead>}
              {showCpmql && <TableHead className="text-foreground text-right">CPMQL Meta</TableHead>}
              <TableHead className="text-foreground text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allKeys.map((key) => {
              const real = getReal(key);
              const goal = goalEntries[key] || { pct: 0, leads: 0, cpmql: 0 };
              const realPct = totalLeads > 0 ? real.leads / totalLeads : 0;
              const deviation = realPct - goal.pct;
              return (
                <TableRow key={key} className="hover:bg-muted/5">
                  <TableCell className="font-medium text-foreground">{key}</TableCell>
                  <TableCell className="text-right text-foreground">{real.leads}</TableCell>
                  <TableCell className="text-right text-foreground">{(realPct * 100).toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-muted-foreground">{goal.leads}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(goal.pct * 100).toFixed(1)}%</TableCell>
                  <TableCell className={`text-right font-medium ${Math.abs(deviation) <= 0.03 ? "text-[#10b981]" : Math.abs(deviation) <= 0.06 ? "text-[#f59e0b]" : "text-[#ef4444]"}`}>
                    {deviation >= 0 ? "+" : ""}{(deviation * 100).toFixed(1)}pp
                  </TableCell>
                  {showCpmql && <TableCell className="text-right text-foreground">R$ {real.cpmql.toFixed(0)}</TableCell>}
                  {showCpmql && <TableCell className="text-right text-muted-foreground">R$ {(goal.cpmql || 0).toFixed(0)}</TableCell>}
                  <TableCell className="text-center">
                    <div className={`w-3 h-3 rounded-full mx-auto ${semaphoreDot(realPct, goal.pct)}`} />
                  </TableCell>
                  {/* Progress bar row */}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
};

export default MixCompra;
