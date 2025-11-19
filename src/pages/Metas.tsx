import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import V4Header from "@/components/V4Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Settings } from "lucide-react";

const Metas = () => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentDay = new Date().getDate();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editableGoals, setEditableGoals] = useState<any[]>([]);

  const queryClient = useQueryClient();

  const months = [
    { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" }, { value: 3, label: "Março" },
    { value: 4, label: "Abril" }, { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
    { value: 7, label: "Julho" }, { value: 8, label: "Agosto" }, { value: 9, label: "Setembro" },
    { value: 10, label: "Outubro" }, { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
  ];

  const { data: goalData } = useQuery({
    queryKey: ["goals", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("month", parseInt(selectedMonth))
        .eq("year", parseInt(selectedYear))
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: allGoalsData } = useQuery({
    queryKey: ["all_goals", selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("year", parseInt(selectedYear))
        .order("month", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (allGoalsData) {
      const goalsMap = new Map(allGoalsData.map(g => [g.month, g]));
      const initialGoals = months.map(m => ({
        month: m.value,
        revenue_goal: goalsMap.get(m.value)?.revenue_goal || 0,
        mql_to_cr_rate: goalsMap.get(m.value)?.mql_to_cr_rate || 80,
        cr_to_ra_rate: goalsMap.get(m.value)?.cr_to_ra_rate || 67,
        ra_to_rr_rate: goalsMap.get(m.value)?.ra_to_rr_rate || 81,
        rr_to_ass_rate: goalsMap.get(m.value)?.rr_to_ass_rate || 38,
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
        contracts_goal: 0,
        mrr_goal: 0,
        mql_to_cr_rate: parseFloat(goal.mql_to_cr_rate.toString()) || 80,
        cr_to_ra_rate: parseFloat(goal.cr_to_ra_rate.toString()) || 67,
        ra_to_rr_rate: parseFloat(goal.ra_to_rr_rate.toString()) || 81,
        rr_to_ass_rate: parseFloat(goal.rr_to_ass_rate.toString()) || 38,
      }));

      const { error } = await supabase.from("monthly_goals").upsert(goalsToUpsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["all_goals"] });
      toast.success("Metas salvas com sucesso!");
      setIsDialogOpen(false);
    },
    onError: () => {
      toast.error("Erro ao salvar metas");
    },
  });

  const updateGoalField = (monthValue: number, field: string, value: string) => {
    setEditableGoals(prev => 
      prev.map(g => g.month === monthValue ? { ...g, [field]: value } : g)
    );
  };

  const actualRevenue = 85000;
  const actualContracts = 12;

  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  const idealDailyRevenue = goalData ? parseFloat(goalData.revenue_goal.toString()) / daysInMonth : 0;
  const idealAccumulatedRevenue = idealDailyRevenue * currentDay;

  const revenueProgress = goalData ? (actualRevenue / parseFloat(goalData.revenue_goal.toString())) * 100 : 0;
  const revenueStatus = actualRevenue >= idealAccumulatedRevenue;

  const mqlToCrealRate = goalData?.mql_to_cr_rate || 80;
  const crToRaRealRate = goalData?.cr_to_ra_rate || 67;
  const raToRrRealRate = goalData?.ra_to_rr_rate || 81;
  const rrToAssRealRate = goalData?.rr_to_ass_rate || 38;

  const funnelIdeal = [
    { stage: "MQL", ideal: 150, real: 145 },
    { stage: "C.R", ideal: Math.round(150 * (mqlToCrealRate / 100)), real: 115 },
    { stage: "R.A", ideal: Math.round(150 * (mqlToCrealRate / 100) * (crToRaRealRate / 100)), real: 78 },
    { stage: "R.R", ideal: Math.round(150 * (mqlToCrealRate / 100) * (crToRaRealRate / 100) * (raToRrRealRate / 100)), real: 62 },
    { stage: "ASS", ideal: Math.round(150 * (mqlToCrealRate / 100) * (crToRaRealRate / 100) * (raToRrRealRate / 100) * (rrToAssRealRate / 100)), real: 22 },
  ];

  const monthsSelect = [
    { value: "1", label: "Janeiro" }, { value: "2", label: "Fevereiro" }, { value: "3", label: "Março" },
    { value: "4", label: "Abril" }, { value: "5", label: "Maio" }, { value: "6", label: "Junho" },
    { value: "7", label: "Julho" }, { value: "8", label: "Agosto" }, { value: "9", label: "Setembro" },
    { value: "10", label: "Outubro" }, { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];

  const years = ["2024", "2025", "2026"];

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      
      <main className="container mx-auto max-w-7xl space-y-8 px-4 lg:px-8 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 font-heading text-3xl lg:text-4xl font-bold text-foreground">METAS & ACOMPANHAMENTO</h1>
            <p className="font-body text-sm text-muted-foreground">Acompanhe o progresso das suas metas mensais</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
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
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead className="font-body text-foreground">Mês</TableHead>
                        <TableHead className="font-body text-foreground">Meta de Receita (R$)</TableHead>
                        <TableHead className="font-body text-foreground">MQL → CR (%)</TableHead>
                        <TableHead className="font-body text-foreground">CR → RA (%)</TableHead>
                        <TableHead className="font-body text-foreground">RA → RR (%)</TableHead>
                        <TableHead className="font-body text-foreground">RR → ASS (%)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editableGoals.map((goal, index) => (
                        <TableRow key={goal.month} className="hover:bg-muted/5">
                          <TableCell className="font-body text-foreground font-medium">
                            {months.find(m => m.value === goal.month)?.label}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={goal.revenue_goal}
                              onChange={(e) => updateGoalField(goal.month, 'revenue_goal', e.target.value)}
                              className="h-9 border-border/50 bg-background"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={goal.mql_to_cr_rate}
                              onChange={(e) => updateGoalField(goal.month, 'mql_to_cr_rate', e.target.value)}
                              className="h-9 border-border/50 bg-background"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={goal.cr_to_ra_rate}
                              onChange={(e) => updateGoalField(goal.month, 'cr_to_ra_rate', e.target.value)}
                              className="h-9 border-border/50 bg-background"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={goal.ra_to_rr_rate}
                              onChange={(e) => updateGoalField(goal.month, 'ra_to_rr_rate', e.target.value)}
                              className="h-9 border-border/50 bg-background"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={goal.rr_to_ass_rate}
                              onChange={(e) => updateGoalField(goal.month, 'rr_to_ass_rate', e.target.value)}
                              className="h-9 border-border/50 bg-background"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => saveAllGoalsMutation.mutate()} 
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={saveAllGoalsMutation.isPending}
                  >
                    {saveAllGoalsMutation.isPending ? "SALVANDO..." : "SALVAR METAS"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <section className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 lg:p-8">
          <div className="mb-6 flex items-center gap-4">
            <label className="font-body text-sm font-medium text-muted-foreground">Visualizar:</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40 border-border/50 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {monthsSelect.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32 border-border/50 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-50">
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {goalData && (
          <>
            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">META VS REALIZADO</h2>
              <div className="grid grid-cols-1 gap-6">
                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Meta de Receita</p>
                  <p className="font-heading text-3xl font-bold text-foreground">R$ {parseFloat(goalData.revenue_goal.toString()).toLocaleString('pt-BR')}</p>
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-body text-xs text-muted-foreground">Realizado</span>
                      <span className="font-body text-xs font-semibold text-foreground">{revenueProgress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full transition-all duration-500 bg-success" style={{ width: `${Math.min(revenueProgress, 100)}%` }} />
                    </div>
                    <p className="mt-2 font-body text-sm font-semibold text-success">R$ {actualRevenue.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {revenueStatus ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                    <span className={`font-body text-xs ${revenueStatus ? 'text-success' : 'text-destructive'}`}>
                      {revenueStatus ? 'À frente do ideal' : 'Abaixo do ideal'}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">IDEAL DO DIA</h2>
              <div className="grid grid-cols-1 gap-6">
                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Receita - Ideal Diário</p>
                  <p className="font-heading text-2xl font-bold text-foreground">R$ {idealDailyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/dia</p>
                  <p className="mt-4 font-body text-sm text-muted-foreground">Ideal Acumulado (dia {currentDay})</p>
                  <p className="font-heading text-xl font-bold text-warning">R$ {idealAccumulatedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <p className="mt-2 font-body text-sm">
                    <span className="text-muted-foreground">Realizado: </span>
                    <span className="font-semibold text-foreground">R$ {actualRevenue.toLocaleString('pt-BR')}</span>
                  </p>
                  <p className="mt-1 font-body text-sm">
                    <span className="text-muted-foreground">Gap: </span>
                    <span className={`font-semibold ${actualRevenue >= idealAccumulatedRevenue ? 'text-success' : 'text-destructive'}`}>
                      R$ {Math.abs(actualRevenue - idealAccumulatedRevenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">FUNIL IDEAL VS FUNIL REAL</h2>
              <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={funnelIdeal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="stage" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                    <Legend />
                    <Bar dataKey="ideal" fill="hsl(var(--primary))" name="Funil Ideal" />
                    <Bar dataKey="real" fill="hsl(var(--success))" name="Funil Real" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Metas;
