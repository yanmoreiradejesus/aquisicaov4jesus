import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import V4Header from "@/components/V4Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
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
  const avgTicket = actualRevenue / actualContracts;

  const revenueProgress = goalData ? (actualRevenue / parseFloat(goalData.revenue_goal.toString())) * 100 : 0;
  const contractsProgress = goalData ? (actualContracts / parseFloat(goalData.contracts_goal.toString())) * 100 : 0;
  const mrrProgress = goalData ? (actualMRR / parseFloat(goalData.mrr_goal.toString())) * 100 : 0;

  const dailyData = [
    { dia: 1, receita: 0, contratos: 0 },
    { dia: 5, receita: 12000, contratos: 2 },
    { dia: 10, receita: 28000, contratos: 4 },
    { dia: 15, receita: 52000, contratos: 8 },
    { dia: 20, receita: 75000, contratos: 11 },
    { dia: 25, receita: 85000, contratos: 12 },
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
              <Input type="number" value={revenueGoal} onChange={(e) => setRevenueGoal(e.target.value)} className="border-border/50 bg-background" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Meta de Contratos</label>
              <Input type="number" value={contractsGoal} onChange={(e) => setContractsGoal(e.target.value)} className="border-border/50 bg-background" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">Meta de MRR (R$)</label>
              <Input type="number" value={mrrGoal} onChange={(e) => setMrrGoal(e.target.value)} className="border-border/50 bg-background" />
            </div>
          </div>
          <Button onClick={() => saveGoalsMutation.mutate()} className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveGoalsMutation.isPending}>
            {saveGoalsMutation.isPending ? "SALVANDO..." : "SALVAR META"}
          </Button>
        </section>

        <section className="space-y-6">
          <h2 className="font-body text-xl lg:text-2xl font-semibold text-foreground">EVOLUÇÃO DIÁRIA</h2>
          <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "0.75rem" }} />
                <Legend />
                <Bar yAxisId="left" dataKey="receita" fill="hsl(var(--primary))" name="Receita (R$)" />
                <Bar yAxisId="right" dataKey="contratos" fill="hsl(var(--success))" name="Contratos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Metas;
