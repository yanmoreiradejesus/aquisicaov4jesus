import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import V4Header from "@/components/V4Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Bar, BarChart, Legend } from "recharts";
import { TrendingUp, Target, DollarSign, FileText } from "lucide-react";

const Metas = () => {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [revenueGoal, setRevenueGoal] = useState("");
  const [contractsGoal, setContractsGoal] = useState("");
  const [mrrGoal, setMrrGoal] = useState("");

  const queryClient = useQueryClient();

  // Fetch goals
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
    }
  }, [goalData]);

  // Save goals mutation
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

  // Mock data for results - será substituído por dados reais
  const actualRevenue = 85000;
  const actualContracts = 12;
  const actualMRR = 45000;
  const avgTicket = actualRevenue / actualContracts;

  const revenueProgress = goalData ? (actualRevenue / parseFloat(goalData.revenue_goal.toString())) * 100 : 0;
  const contractsProgress = goalData ? (actualContracts / parseFloat(goalData.contracts_goal.toString())) * 100 : 0;
  const mrrProgress = goalData ? (actualMRR / parseFloat(goalData.mrr_goal.toString())) * 100 : 0;

  // Mock daily evolution data
  const dailyData = [
    { dia: 1, receita: 0, contratos: 0 },
    { dia: 5, receita: 12000, contratos: 2 },
    { dia: 10, receita: 28000, contratos: 4 },
    { dia: 15, receita: 52000, contratos: 8 },
    { dia: 20, receita: 75000, contratos: 11 },
    { dia: 25, receita: 85000, contratos: 12 },
  ];

  const months = [
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

  return (
    <div className="min-h-screen bg-background">
      <V4Header />
      
      <main className="container mx-auto px-6 py-8">
        {/* Goal Definition Section */}
        <section className="mb-12 rounded-sm border border-primary/30 bg-card p-8">
          <h2 className="mb-6 font-heading text-3xl text-primary">DEFINIR METAS</h2>
          
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Mês</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="border-primary/30 bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Ano</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="border-primary/30 bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Meta de Receita (R$)</label>
              <Input
                type="number"
                value={revenueGoal}
                onChange={(e) => setRevenueGoal(e.target.value)}
                placeholder="100000"
                className="border-primary/30 bg-input"
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Meta de Contratos</label>
              <Input
                type="number"
                value={contractsGoal}
                onChange={(e) => setContractsGoal(e.target.value)}
                placeholder="15"
                className="border-primary/30 bg-input"
              />
            </div>
            
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Meta de MRR (R$)</label>
              <Input
                type="number"
                value={mrrGoal}
                onChange={(e) => setMrrGoal(e.target.value)}
                placeholder="50000"
                className="border-primary/30 bg-input"
              />
            </div>
          </div>
          
          <Button 
            onClick={() => saveGoalsMutation.mutate()}
            className="mt-6 bg-primary font-heading text-lg tracking-wider text-primary-foreground hover:bg-primary/90"
            disabled={saveGoalsMutation.isPending}
          >
            {saveGoalsMutation.isPending ? "SALVANDO..." : "SALVAR META"}
          </Button>
        </section>

        {/* Results Section */}
        <section className="mb-12">
          <h2 className="mb-6 font-heading text-3xl text-primary">RESULTADOS DO MÊS</h2>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-sm border border-primary/30 bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-sm tracking-wider text-foreground">RECEITA REAL</h3>
              </div>
              <p className="font-heading text-4xl text-primary">
                R$ {actualRevenue.toLocaleString("pt-BR")}
              </p>
            </div>
            
            <div className="rounded-sm border border-primary/30 bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-sm tracking-wider text-foreground">CONTRATOS</h3>
              </div>
              <p className="font-heading text-4xl text-primary">{actualContracts}</p>
            </div>
            
            <div className="rounded-sm border border-primary/30 bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-sm tracking-wider text-foreground">MRR</h3>
              </div>
              <p className="font-heading text-4xl text-primary">
                R$ {actualMRR.toLocaleString("pt-BR")}
              </p>
            </div>
            
            <div className="rounded-sm border border-primary/30 bg-card p-6">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h3 className="font-heading text-sm tracking-wider text-foreground">TICKET MÉDIO</h3>
              </div>
              <p className="font-heading text-4xl text-primary">
                R$ {avgTicket.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </section>

        {/* Goal Achievement Section */}
        {goalData && (
          <section className="mb-12">
            <h2 className="mb-6 font-heading text-3xl text-primary">ATINGIMENTO DE META</h2>
            
            <div className="space-y-6">
              <div className="rounded-sm border border-primary/30 bg-card p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-heading text-lg text-foreground">META DE RECEITA</h3>
                  <span className="font-heading text-2xl text-primary">
                    {revenueProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-500 ${
                      revenueProgress >= 100 ? "bg-success" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(revenueProgress, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  R$ {actualRevenue.toLocaleString("pt-BR")} de R${" "}
                  {Number(goalData.revenue_goal).toLocaleString("pt-BR")}
                </p>
              </div>
              
              <div className="rounded-sm border border-primary/30 bg-card p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-heading text-lg text-foreground">META DE CONTRATOS</h3>
                  <span className="font-heading text-2xl text-primary">
                    {contractsProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-500 ${
                      contractsProgress >= 100 ? "bg-success" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(contractsProgress, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {actualContracts} de {goalData.contracts_goal} contratos
                </p>
              </div>
              
              <div className="rounded-sm border border-primary/30 bg-card p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-heading text-lg text-foreground">META DE MRR</h3>
                  <span className="font-heading text-2xl text-primary">
                    {mrrProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all duration-500 ${
                      mrrProgress >= 100 ? "bg-success" : "bg-primary"
                    }`}
                    style={{ width: `${Math.min(mrrProgress, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  R$ {actualMRR.toLocaleString("pt-BR")} de R${" "}
                  {Number(goalData.mrr_goal).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Daily Evolution Section */}
        <section>
          <h2 className="mb-6 font-heading text-3xl text-primary">EVOLUÇÃO DIÁRIA</h2>
          
          <div className="rounded-sm border border-primary/30 bg-card p-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="dia" 
                  stroke="hsl(var(--foreground))"
                  style={{ fontSize: "12px", fontFamily: "Montserrat" }}
                  label={{ value: "Dia do Mês", position: "insideBottom", offset: -5 }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="hsl(var(--foreground))"
                  style={{ fontSize: "12px", fontFamily: "Montserrat" }}
                  label={{ value: "Receita (R$)", angle: -90, position: "insideLeft" }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--foreground))"
                  style={{ fontSize: "12px", fontFamily: "Montserrat" }}
                  label={{ value: "Contratos", angle: 90, position: "insideRight" }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--primary))",
                    borderRadius: "4px"
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontFamily: "Montserrat", fontSize: "12px" }} />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="receita" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  name="Receita (R$)"
                  dot={{ fill: "hsl(var(--primary))", r: 5 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="contratos" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Contratos"
                  dot={{ fill: "hsl(var(--success))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Metas;
