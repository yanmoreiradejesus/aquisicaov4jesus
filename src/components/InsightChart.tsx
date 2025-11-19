import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface InsightChartProps {
  title: string;
  data: any[];
  dataKey: string;
  xAxisKey: string;
}

const InsightChart = ({ title, data, dataKey, xAxisKey }: InsightChartProps) => {
  return (
    <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card to-muted/5 p-6 transition-all duration-300 hover:shadow-lg">
      <h3 className="mb-6 font-body text-lg font-semibold text-foreground">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis 
            dataKey={xAxisKey} 
            stroke="hsl(var(--muted-foreground))" 
            style={{ fontSize: "12px", fontFamily: "Montserrat" }}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: "12px", fontFamily: "Montserrat" }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.75rem"
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend wrapperStyle={{ fontFamily: "Montserrat", fontSize: "12px" }} />
          <Bar dataKey={dataKey} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default InsightChart;
