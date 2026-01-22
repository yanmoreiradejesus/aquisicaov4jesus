import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { SegmentPerformance } from "@/utils/insightsCalculator";

interface PerformanceBarChartProps {
  title: string;
  data: SegmentPerformance[];
  metric: "conversionRate" | "leads" | "revenue" | "roas";
}

const PerformanceBarChart = ({ title, data, metric }: PerformanceBarChartProps) => {
  const formatValue = (value: number): string => {
    switch (metric) {
      case "conversionRate":
        return `${value.toFixed(1)}%`;
      case "revenue":
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        }).format(value);
      case "roas":
        return `${value.toFixed(1)}x`;
      default:
        return value.toString();
    }
  };

  const getMetricLabel = (): string => {
    switch (metric) {
      case "conversionRate":
        return "Taxa de Conversão";
      case "leads":
        return "Leads";
      case "revenue":
        return "Receita";
      case "roas":
        return "ROAS";
      default:
        return "";
    }
  };

  // Get color based on value (for conversion rate)
  const getBarColor = (value: number): string => {
    if (metric === "conversionRate") {
      if (value >= 20) return "hsl(142, 76%, 36%)"; // green
      if (value >= 10) return "hsl(45, 93%, 47%)"; // yellow
      if (value >= 5) return "hsl(24, 95%, 53%)"; // orange
      return "hsl(0, 84%, 60%)"; // red
    }
    return "hsl(var(--primary))";
  };

  // Prepare data for chart (limit to top 10)
  const chartData = data.slice(0, 10).map((item) => ({
    name: item.segment.length > 15 ? item.segment.substring(0, 15) + "..." : item.segment,
    fullName: item.segment,
    value: item[metric],
    leads: item.leads,
    ass: item.ass,
  }));

  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 transition-all duration-300 hover:shadow-lg">
      <h3 className="mb-2 font-body text-lg font-semibold text-foreground">{title}</h3>
      <p className="mb-4 text-xs text-muted-foreground">{getMetricLabel()}</p>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: "11px", fontFamily: "Montserrat" }}
            tickFormatter={(value) => formatValue(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: "11px", fontFamily: "Montserrat" }}
            width={100}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem",
              fontSize: "12px",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
            formatter={(value: number, _name: string, props: any) => [
              <span key="value">
                {formatValue(value)}
                <br />
                <span style={{ fontSize: "10px", opacity: 0.7 }}>
                  ({props.payload.leads} leads, {props.payload.ass} contratos)
                </span>
              </span>,
              getMetricLabel(),
            ]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border/30 pt-4">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Total Leads</p>
          <p className="text-lg font-bold text-foreground">
            {data.reduce((sum, d) => sum + d.leads, 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Total Contratos</p>
          <p className="text-lg font-bold text-foreground">
            {data.reduce((sum, d) => sum + d.ass, 0)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Conversão Média</p>
          <p className="text-lg font-bold text-foreground">
            {data.length > 0
              ? (
                  (data.reduce((sum, d) => sum + d.ass, 0) /
                    data.reduce((sum, d) => sum + d.leads, 0)) *
                  100
                ).toFixed(1)
              : 0}
            %
          </p>
        </div>
      </div>
    </div>
  );
};

export default PerformanceBarChart;
