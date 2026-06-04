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

interface MiniProps {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  color: string;
}

const MiniChart = ({ title, subtitle, data, color }: MiniProps) => (
  <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/5 p-4">
    <div className="mb-2">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-[11px] text-muted-foreground">{subtitle}</div>
    </div>
    <div className="h-[200px] w-full">
      {data.length === 0 ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Sem dados
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
            />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </div>
);

export const SDRPerformanceChart = ({ rows, profiles }: Props) => {
  const named = rows.map((r) => ({ ...r, name: firstName(nameOf(r.userId, profiles)) }));

  const topBy = <K extends keyof SDRStats>(key: K) =>
    [...named]
      .sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0))
      .slice(0, 5)
      .map((r) => ({ name: r.name, value: Number(r[key]) || 0 }))
      .filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <MiniChart
        title="Tentativas"
        subtitle="Top 5 SDRs (VoIP)"
        data={topBy("ligacoes")}
        color="hsl(var(--primary) / 0.4)"
      />
      <MiniChart
        title="Conectadas ≥1s"
        subtitle="Top 5 SDRs"
        data={topBy("ligacoesConectadas")}
        color="hsl(var(--primary) / 0.7)"
      />
      <MiniChart
        title="Reuniões realizadas"
        subtitle="Top 5 SDRs"
        data={topBy("reunioesRealizadas")}
        color="hsl(var(--primary))"
      />
    </div>
  );
};
