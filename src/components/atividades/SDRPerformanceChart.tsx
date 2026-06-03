import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SDRStats } from "@/utils/atividadesCalculator";
import type { ProfileLite } from "@/hooks/useProfilesList";
import { profileLabel } from "@/hooks/useProfilesList";

interface Props {
  rows: SDRStats[];
  profiles: ProfileLite[];
}

const nameOf = (id: string, profiles: ProfileLite[]) =>
  profileLabel(profiles.find((p) => p.id === id) ?? null) || "—";

const firstName = (full: string) => full.split(" ")[0];

export const SDRPerformanceChart = ({ rows, profiles }: Props) => {
  const data = rows.slice(0, 10).map((r) => ({
    name: firstName(nameOf(r.userId, profiles)),
    Ligações: r.ligacoes,
    "Reun. Agend.": r.reunioesAgendadas,
    "Reun. Real.": r.reunioesRealizadas,
  }));

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/40 p-6 text-center text-sm text-muted-foreground">
        Sem dados para exibir no gráfico.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/5 p-4 lg:p-6">
      <div className="mb-3">
        <div className="text-sm font-semibold text-foreground">Performance por SDR</div>
        <div className="text-xs text-muted-foreground">Top 10 — ligações, reuniões agendadas e realizadas</div>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
            />
            <Bar dataKey="Ligações" fill="hsl(var(--primary) / 0.45)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Reun. Agend." fill="hsl(var(--primary) / 0.75)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Reun. Real." fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
