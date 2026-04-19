import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, Settings } from "lucide-react";
import { useGoogleSheetsData } from "@/hooks/useGoogleSheetsData";
import { filterLeads, calculateFunnelData } from "@/utils/dataProcessor";
import FunnelComparison from "@/components/FunnelComparison";
import FunnelSkeleton from "@/components/FunnelSkeleton";
const Metas = () => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentDay = new Date().getDate();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editableGoals, setEditableGoals] = useState<any[]>([]);
  const queryClient = useQueryClient();
  const months = [{
    value: 1,
    label: "Janeiro"
  }, {
    value: 2,
    label: "Fevereiro"
  }, {
    value: 3,
    label: "Março"
  }, {
    value: 4,
    label: "Abril"
  }, {
    value: 5,
    label: "Maio"
  }, {
    value: 6,
    label: "Junho"
  }, {
    value: 7,
    label: "Julho"
  }, {
    value: 8,
    label: "Agosto"
  }, {
    value: 9,
    label: "Setembro"
  }, {
    value: 10,
    label: "Outubro"
  }, {
    value: 11,
    label: "Novembro"
  }, {
    value: 12,
    label: "Dezembro"
  }];
  const {
    data: goalData
  } = useQuery({
    queryKey: ["goals", selectedMonth, selectedYear],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("monthly_goals").select("*").eq("month", parseInt(selectedMonth)).eq("year", parseInt(selectedYear)).maybeSingle();
      if (error) throw error;
      return data;
    }
  });
  const {
    data: allGoalsData
  } = useQuery({
    queryKey: ["all_goals", selectedYear],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("monthly_goals").select("*").eq("year", parseInt(selectedYear)).order("month", {
        ascending: true
      });
      if (error) throw error;
      return data || [];
    }
  });
  useEffect(() => {
    if (allGoalsData) {
      const goalsMap = new Map(allGoalsData.map(g => [g.month, g]));
      const initialGoals = months.map(m => ({
        month: m.value,
        revenue_goal: goalsMap.get(m.value)?.revenue_goal || 0,
        cpmql_target: goalsMap.get(m.value)?.cpmql_target || 0,
        investment_target: goalsMap.get(m.value)?.investment_target || 0,
        mql_to_cr_rate: goalsMap.get(m.value)?.mql_to_cr_rate || 80,
        cr_to_ra_rate: goalsMap.get(m.value)?.cr_to_ra_rate || 67,
        ra_to_rr_rate: goalsMap.get(m.value)?.ra_to_rr_rate || 81,
        rr_to_ass_rate: goalsMap.get(m.value)?.rr_to_ass_rate || 38
      }));
      setEditableGoals(initialGoals);
    }
  }, [allGoalsData]);
  const saveAllGoalsMutation = useMutation({
    mutationFn: async () => {
      const goalsToUpsert = editableGoals.map(goal => ({
        month: goal.month,
        year: parseInt(selectedYear),
        revenue_goal: parseFloat(goal.revenue_goal.toString()) || 0,
        cpmql_target: parseFloat(goal.cpmql_target.toString()) || 0,
        investment_target: parseFloat(goal.investment_target.toString()) || 0,
        contracts_goal: 0,
        mrr_goal: 0,
        mql_to_cr_rate: parseFloat(goal.mql_to_cr_rate.toString()) || 80,
        cr_to_ra_rate: parseFloat(goal.cr_to_ra_rate.toString()) || 67,
        ra_to_rr_rate: parseFloat(goal.ra_to_rr_rate.toString()) || 81,
        rr_to_ass_rate: parseFloat(goal.rr_to_ass_rate.toString()) || 38
      }));
      const {
        error
      } = await supabase.from("monthly_goals").upsert(goalsToUpsert, {
        onConflict: "month,year"
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["goals"]
      });
      queryClient.invalidateQueries({
        queryKey: ["all_goals"]
      });
      toast.success("Metas salvas com sucesso!");
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Erro ao salvar metas");
    }
  });
  const updateGoalField = (monthValue: number, field: string, value: string) => {
    setEditableGoals(prev => prev.map(g => g.month === monthValue ? {
      ...g,
      [field]: value
    } : g));
  };

  // Buscar dados reais da planilha
  const {
    data: sheetsData,
    isLoading: dataLoading
  } = useGoogleSheetsData();

  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (dataLoading) {
      setShowSkeleton(true);
    } else {
      const timer = setTimeout(() => {
        setShowSkeleton(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dataLoading]);

  const isLoading = dataLoading || showSkeleton;

  // Calcular dados reais do período selecionado
  const realFunnelData = useMemo(() => {
    if (!sheetsData?.leads) return {
      mql: 0,
      cr: 0,
      ra: 0,
      rr: 0,
      ass: 0,
      faturamentoTotal: 0
    };
    const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).toISOString().split('T')[0];
    const filters = {
      startDate,
      endDate,
      canal: "all",
      tier: "all",
      urgency: "all",
      cargo: "all",
      periodo: "all",
      emailType: "all",
      hasDescription: "all"
    };
    const filteredLeads = filterLeads(sheetsData.leads, filters);
    return calculateFunnelData(filteredLeads, filters, sheetsData.leads);
  }, [sheetsData, selectedMonth, selectedYear]);
  const actualRevenue = realFunnelData.faturamentoTotal;
  const actualContracts = realFunnelData.ass;
  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  const idealDailyRevenue = goalData ? parseFloat(goalData.revenue_goal.toString()) / daysInMonth : 0;
  const idealAccumulatedRevenue = idealDailyRevenue * currentDay;
  const revenueProgress = goalData ? actualRevenue / parseFloat(goalData.revenue_goal.toString()) * 100 : 0;
  const revenueStatus = actualRevenue >= idealAccumulatedRevenue;

  // Calcular funil ideal baseado nas taxas de conversão, CPMQL e investimento
  const mqlToCrealRate = goalData?.mql_to_cr_rate || 80;
  const crToRaRealRate = goalData?.cr_to_ra_rate || 67;
  const raToRrRealRate = goalData?.ra_to_rr_rate || 81;
  const rrToAssRealRate = goalData?.rr_to_ass_rate || 38;

  // Calcular MQL ideal baseado no investimento dividido pelo CPMQL alvo
  const cpmqlTarget = goalData?.cpmql_target || 0;
  const investmentTarget = goalData?.investment_target || 0;
  const idealMqlTotal = cpmqlTarget > 0 ? Math.round(investmentTarget / cpmqlTarget) : 0;
  
  // Ajustar para proporcional ao dia do mês se estiver visualizando o mês atual
  const isCurrentMonth = parseInt(selectedMonth) === currentMonth && parseInt(selectedYear) === currentYear;
  const proportionFactor = isCurrentMonth ? (currentDay / daysInMonth) : 1;
  
  const idealMql = Math.round(idealMqlTotal * proportionFactor);
  const idealFunnelData = {
    mql: idealMql,
    cr: Math.round(idealMql * (mqlToCrealRate / 100)),
    ra: Math.round(idealMql * (mqlToCrealRate / 100) * (crToRaRealRate / 100)),
    rr: Math.round(idealMql * (mqlToCrealRate / 100) * (crToRaRealRate / 100) * (raToRrRealRate / 100)),
    ass: Math.round(idealMql * (mqlToCrealRate / 100) * (crToRaRealRate / 100) * (raToRrRealRate / 100) * (rrToAssRealRate / 100))
  };
  const monthsSelect = [{
    value: "1",
    label: "Janeiro"
  }, {
    value: "2",
    label: "Fevereiro"
  }, {
    value: "3",
    label: "Março"
  }, {
    value: "4",
    label: "Abril"
  }, {
    value: "5",
    label: "Maio"
  }, {
    value: "6",
    label: "Junho"
  }, {
    value: "7",
    label: "Julho"
  }, {
    value: "8",
    label: "Agosto"
  }, {
    value: "9",
    label: "Setembro"
  }, {
    value: "10",
    label: "Outubro"
  }, {
    value: "11",
    label: "Novembro"
  }, {
    value: "12",
    label: "Dezembro"
  }];
  const years = ["2024", "2025", "2026"];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background animate-fade-in">
        <div className="mx-auto max-w-7xl p-4 lg:p-8 space-y-8">
          <FunnelSkeleton />
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-background">
      
      <main className="container mx-auto max-w-7xl space-y-8 px-4 lg:px-8 py-8">

        <section className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-4">
            <label className="font-body text-sm font-medium text-muted-foreground">Visualizar:</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40 border-border/50 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {monthsSelect.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32 border-border/50 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </section>

        {goalData && <>
            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">META VS REALIZADO</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Meta de Receita Adicionada  </p>
                  <p className="font-heading text-3xl font-bold text-foreground">R$ {parseFloat(goalData.revenue_goal.toString()).toLocaleString('pt-BR')}</p>
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-body text-xs text-muted-foreground">Realizado</span>
                      <span className="font-body text-xs font-semibold text-foreground">R$ {actualRevenue.toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500" style={{
                    width: `${Math.min(revenueProgress, 100)}%`
                  }} />
                    </div>
                    <p className="mt-2 font-body text-xs text-right">
                      <span className={revenueStatus ? 'text-success' : 'text-warning'}>
                        {revenueProgress.toFixed(1)}% da meta
                      </span>
                    </p>
                    <p className="mt-2 font-body text-sm flex items-center gap-2">
                      {revenueStatus ? <>
                          <TrendingUp className="h-4 w-4 text-success" />
                          <span className="text-success font-semibold">À frente do ideal do dia</span>
                        </> : <>
                          
                          
                        </>}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Meta de Investimento em Broker  </p>
                  <p className="font-heading text-3xl font-bold text-foreground">R$ {parseFloat(goalData.investment_target.toString()).toLocaleString('pt-BR')}</p>
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-body text-xs text-muted-foreground">Realizado</span>
                      <span className="font-body text-xs font-semibold text-foreground">R$ {('investimentoTotal' in realFunnelData ? realFunnelData.investimentoTotal : 0).toLocaleString('pt-BR')}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full bg-gradient-to-r from-warning to-warning/80 transition-all duration-500" style={{
                    width: `${Math.min(('investimentoTotal' in realFunnelData ? realFunnelData.investimentoTotal : 0) / parseFloat(goalData.investment_target.toString()) * 100, 100)}%`
                  }} />
                    </div>
                    <p className="mt-2 font-body text-xs text-right">
                      <span className="text-muted-foreground">
                        {(('investimentoTotal' in realFunnelData ? realFunnelData.investimentoTotal : 0) / parseFloat(goalData.investment_target.toString()) * 100).toFixed(1)}% da meta
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">PACE IDEAL   </h2>
              <div className="grid grid-cols-1 gap-6">
                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Pace Ideal (dia {currentDay})</p>
                  <p className="font-heading text-2xl font-bold text-warning">R$ {idealAccumulatedRevenue.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2
                })}</p>
                  <p className="mt-2 font-body text-sm">
                    <span className="text-muted-foreground">Realizado: </span>
                    <span className="font-semibold text-foreground">R$ {actualRevenue.toLocaleString('pt-BR')}</span>
                  </p>
                  <p className="mt-1 font-body text-sm">
                    <span className="text-muted-foreground">Gap: </span>
                    <span className={`font-semibold ${actualRevenue >= idealAccumulatedRevenue ? 'text-success' : 'text-destructive'}`}>
                      R$ {Math.abs(actualRevenue - idealAccumulatedRevenue).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}
                    </span>
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">FUNIL            </h2>
              <FunnelComparison idealData={idealFunnelData} realData={realFunnelData} targetRates={{
            mql_to_cr_rate: mqlToCrealRate,
            cr_to_ra_rate: crToRaRealRate,
            ra_to_rr_rate: raToRrRealRate,
            rr_to_ass_rate: rrToAssRealRate
          }} />
            </section>
          </>}

        <div className="flex justify-center pt-8 pb-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[hsl(0,84.2%,60.2%)] text-white hover:bg-[hsl(0,84.2%,50%)]">
                <Settings className="mr-2 h-4 w-4" />
                DEFINIR METAS
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl text-foreground">Definir Metas Anuais</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <label className="font-body text-sm font-medium text-muted-foreground">Ano:</label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-32 border-border/50 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border z-50">
                      {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead className="font-body text-foreground">Mês</TableHead>
                        <TableHead className="font-body text-foreground">Meta de Receita (R$)</TableHead>
                        <TableHead className="font-body text-foreground">CPMQL Alvo (R$)</TableHead>
                        <TableHead className="font-body text-foreground">Investimento (R$)</TableHead>
                        <TableHead className="font-body text-foreground">MQL → CR (%)</TableHead>
                        <TableHead className="font-body text-foreground">CR → RA (%)</TableHead>
                        <TableHead className="font-body text-foreground">RA → RR (%)</TableHead>
                        <TableHead className="font-body text-foreground">RR → ASS (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editableGoals.map((goal, index) => <TableRow key={goal.month} className="hover:bg-muted/5">
                          <TableCell className="font-body text-foreground font-medium">
                            {months.find(m => m.value === goal.month)?.label}
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={goal.revenue_goal} onChange={e => updateGoalField(goal.month, 'revenue_goal', e.target.value)} className="h-9 border-border/50 bg-background" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={goal.cpmql_target} onChange={e => updateGoalField(goal.month, 'cpmql_target', e.target.value)} className="h-9 border-border/50 bg-background" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={goal.investment_target} onChange={e => updateGoalField(goal.month, 'investment_target', e.target.value)} className="h-9 border-border/50 bg-background" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={goal.mql_to_cr_rate} onChange={e => updateGoalField(goal.month, 'mql_to_cr_rate', e.target.value)} className="h-9 border-border/50 bg-background" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={goal.cr_to_ra_rate} onChange={e => updateGoalField(goal.month, 'cr_to_ra_rate', e.target.value)} className="h-9 border-border/50 bg-background" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={goal.ra_to_rr_rate} onChange={e => updateGoalField(goal.month, 'ra_to_rr_rate', e.target.value)} className="h-9 border-border/50 bg-background" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" value={goal.rr_to_ass_rate} onChange={e => updateGoalField(goal.month, 'rr_to_ass_rate', e.target.value)} className="h-9 border-border/50 bg-background" />
                          </TableCell>
                        </TableRow>)}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={() => saveAllGoalsMutation.mutate()} className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveAllGoalsMutation.isPending}>
                    {saveAllGoalsMutation.isPending ? "SALVANDO..." : "SALVAR METAS"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>;
};
export default Metas;