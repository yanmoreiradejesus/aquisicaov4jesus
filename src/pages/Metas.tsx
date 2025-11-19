import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import V4Header from "@/components/V4Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

const Metas = () => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentDay = new Date().getDate();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [revenueGoal, setRevenueGoal] = useState("");
  const [contractsGoal, setContractsGoal] = useState("");
  const [mrrGoal, setMrrGoal] = useState("");

  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (goalData) {
      setRevenueGoal(goalData.revenue_goal.toString());
      setContractsGoal(goalData.contracts_goal.toString());
      setMrrGoal(goalData.mrr_goal.toString());
    } else {
      setRevenueGoal("");
      setContractsGoal("");
      setMrrGoal("");
    }
  }, [goalData]);

  const saveGoalsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("monthly_goals").upsert({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
        revenue_goal: parseFloat(revenueGoal) || 0,
        contracts_goal: parseInt(contractsGoal) || 0,
        mrr_goal: parseFloat(mrrGoal) || 0,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Metas salvas com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao salvar metas");
    },
  });

  const actualRevenue = 85000;
  const actualContracts = 12;
  const actualMRR = 45000;

  const daysInMonth = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate();
  const idealDailyRevenue = goalData ? parseFloat(goalData.revenue_goal.toString()) / daysInMonth : 0;
  const idealDailyContracts = goalData ? parseFloat(goalData.contracts_goal.toString()) / daysInMonth : 0;
  const idealAccumulatedRevenue = idealDailyRevenue * currentDay;
  const idealAccumulatedContracts = idealDailyContracts * currentDay;

  const revenueProgress = goalData ? (actualRevenue / parseFloat(goalData.revenue_goal.toString())) * 100 : 0;
  const contractsProgress = goalData ? (actualContracts / parseFloat(goalData.contracts_goal.toString())) * 100 : 0;
  const mrrProgress = goalData ? (actualMRR / parseFloat(goalData.mrr_goal.toString())) * 100 : 0;

  const revenueStatus = actualRevenue >= idealAccumulatedRevenue;
  const contractsStatus = actualContracts >= idealAccumulatedContracts;

  const funnelIdeal = [
    { stage: "MQL", ideal: 150, real: 145 },
    { stage: "C.R", ideal: 120, real: 115 },
    { stage: "R.A", ideal: 80, real: 78 },
    { stage: "R.R", ideal: 65, real: 62 },
    { stage: "ASS", ideal: 25, real: 22 },
  ];

  const months = [
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
        <div>
          <h1 className="mb-2 font-heading text-3xl lg:text-4xl font-bold text-foreground">METAS & ACOMPANHAMENTO</h1>
          <p className="font-body text-sm text-muted-foreground">Acompanhe o progresso das suas metas mensais</p>
        </div>

        <section className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 lg:p-8 transition-all duration-300 hover:shadow-lg">
          <h2 className="mb-6 font-body text-xl lg:text-2xl font-semibold text-foreground">DEFINIR METAS</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="border-border/50 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="border-border/50 bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Meta de Receita (R$)</label>
              <Input type="number" value={revenueGoal} onChange={(e) => setRevenueGoal(e.target.value)} className="border-border/50 bg-background" placeholder="0" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Meta de Contratos</label>
              <Input type="number" value={contractsGoal} onChange={(e) => setContractsGoal(e.target.value)} className="border-border/50 bg-background" placeholder="0" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Meta de MRR (R$)</label>
              <Input type="number" value={mrrGoal} onChange={(e) => setMrrGoal(e.target.value)} className="border-border/50 bg-background" placeholder="0" />
            </div>
          </div>
          <Button onClick={() => saveGoalsMutation.mutate()} className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveGoalsMutation.isPending}>
            {saveGoalsMutation.isPending ? "SALVANDO..." : "SALVAR META"}
          </Button>
        </section>

        {goalData && (
          <>
            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">META VS REALIZADO</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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

                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Meta de Contratos</p>
                  <p className="font-heading text-3xl font-bold text-foreground">{goalData.contracts_goal}</p>
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-body text-xs text-muted-foreground">Realizado</span>
                      <span className="font-body text-xs font-semibold text-foreground">{contractsProgress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full transition-all duration-500 bg-success" style={{ width: `${Math.min(contractsProgress, 100)}%` }} />
                    </div>
                    <p className="mt-2 font-body text-sm font-semibold text-success">{actualContracts}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    {contractsStatus ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
                    <span className={`font-body text-xs ${contractsStatus ? 'text-success' : 'text-destructive'}`}>
                      {contractsStatus ? 'À frente do ideal' : 'Abaixo do ideal'}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Meta de MRR</p>
                  <p className="font-heading text-3xl font-bold text-foreground">R$ {parseFloat(goalData.mrr_goal.toString()).toLocaleString('pt-BR')}</p>
                  <div className="mt-4">
                    <div className="flex justify-between mb-2">
                      <span className="font-body text-xs text-muted-foreground">Realizado</span>
                      <span className="font-body text-xs font-semibold text-foreground">{mrrProgress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                      <div className="h-full transition-all duration-500 bg-success" style={{ width: `${Math.min(mrrProgress, 100)}%` }} />
                    </div>
                    <p className="mt-2 font-body text-sm font-semibold text-success">R$ {actualMRR.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">IDEAL DO DIA</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

                <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
                  <p className="mb-2 font-body text-sm text-muted-foreground">Contratos - Ideal Diário</p>
                  <p className="font-heading text-2xl font-bold text-foreground">{idealDailyContracts.toFixed(2)}/dia</p>
                  <p className="mt-4 font-body text-sm text-muted-foreground">Ideal Acumulado (dia {currentDay})</p>
                  <p className="font-heading text-xl font-bold text-warning">{idealAccumulatedContracts.toFixed(0)}</p>
                  <p className="mt-2 font-body text-sm">
                    <span className="text-muted-foreground">Realizado: </span>
                    <span className="font-semibold text-foreground">{actualContracts}</span>
                  </p>
                  <p className="mt-1 font-body text-sm">
                    <span className="text-muted-foreground">Gap: </span>
                    <span className={`font-semibold ${actualContracts >= idealAccumulatedContracts ? 'text-success' : 'text-destructive'}`}>
                      {Math.abs(actualContracts - idealAccumulatedContracts).toFixed(0)}
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
