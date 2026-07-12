import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccountsList, healthBand, SQUAD_LABEL, type SquadKey } from "@/hooks/useAccounts";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";

const fmtBRL = (v?: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Number(v));

const SQUADS: SquadKey[] = ["strikers", "fenix", "saber"];

function SummaryCards({ accounts }: { accounts: ReturnType<typeof useAccountsList>["data"] }) {
  const list = accounts ?? [];
  const mrrTotal = list.reduce((acc, a) => acc + (Number(a.effective_mrr) || 0), 0);
  const count = list.length;
  const buckets = list.reduce(
    (acc, a) => {
      const s = a.health_score;
      if (s == null) acc.none++;
      else if (s >= 70) acc.green++;
      else if (s >= 40) acc.yellow++;
      else acc.red++;
      return acc;
    },
    { green: 0, yellow: 0, red: 0, none: 0 },
  );

  const Card = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) => (
    <div className="rounded-2xl border border-border/40 bg-surface-1/40 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="mt-1.5 font-display text-xl font-semibold tracking-[-0.01em] text-foreground">{value}</div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card label="MRR total" value={fmtBRL(mrrTotal)} />
      <Card label="Contas ativas" value={count} />
      <Card
        label="Saúde"
        value={
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />{buckets.green}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />{buckets.yellow}</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />{buckets.red}</span>
            {buckets.none > 0 && <span className="inline-flex items-center gap-1 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-muted-foreground/60" />{buckets.none}</span>}
          </div>
        }
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Card label="Margem média" value={<span className="text-muted-foreground">—</span>} hint="Disponível com a integração eKyte" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Disponível com a integração eKyte</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default function AccountsList() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SquadKey>("strikers");
  const { data: all = [], isLoading } = useAccountsList();
  const { profiles } = useProfilesList({});
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p) => m.set(p.id, profileLabel(p)));
    return m;
  }, [profiles]);

  const bySquad = useMemo(() => {
    const map: Record<SquadKey, typeof all> = { strikers: [], fenix: [], saber: [] };
    all.forEach((a) => {
      if (a.squad && map[a.squad]) map[a.squad].push(a);
    });
    return map;
  }, [all]);

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 lg:px-8 py-6 lg:py-10 animate-fade-in max-w-6xl mx-auto">
        <div className="mb-6">
          <p className="text-[10px] font-semibold text-muted-foreground tracking-[0.2em] uppercase mb-1">Revenue</p>
          <h1 className="font-display text-[28px] lg:text-[34px] font-semibold text-foreground tracking-[-0.02em]">
            Gestão de Contas
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Contas operacionais por squad — saúde, MRR e responsáveis.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as SquadKey)} className="space-y-5">
          <TabsList>
            {SQUADS.map((s) => (
              <TabsTrigger key={s} value={s}>
                {SQUAD_LABEL[s]} ({bySquad[s].length})
              </TabsTrigger>
            ))}
          </TabsList>

          {SQUADS.map((s) => {
            const rows = bySquad[s];
            return (
              <TabsContent key={s} value={s} className="space-y-5 mt-4">
                <SummaryCards accounts={rows} />

                <div className="rounded-2xl border border-border/40 bg-surface-1/40 overflow-hidden">
                  {isLoading ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
                  ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Nenhuma conta atribuída ao squad {SQUAD_LABEL[s]}.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead className="w-[110px]">Saúde</TableHead>
                          <TableHead>Account</TableHead>
                          <TableHead>GT</TableHead>
                          <TableHead className="text-right">MRR</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((a) => {
                          const h = healthBand(a.health_score);
                          return (
                            <TableRow
                              key={a.id}
                              className="cursor-pointer hover:bg-surface-2/40"
                              onClick={() => navigate(`/comercial/accounts/${a.id}`)}
                            >
                              <TableCell className="font-medium text-foreground">{a.cliente_nome}</TableCell>
                              <TableCell>
                                <span className="inline-flex items-center gap-2 text-[12px] text-foreground/80">
                                  <span className={`h-2 w-2 rounded-full ${h.dot}`} />
                                  {a.health_score ?? "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-foreground/80">{nameById.get(a.account_manager_id ?? "") ?? "—"}</TableCell>
                              <TableCell className="text-foreground/80">{nameById.get(a.gt_id ?? "") ?? "—"}</TableCell>
                              <TableCell className="text-right tabular-nums text-foreground">{fmtBRL(a.mrr)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </div>
  );
}
