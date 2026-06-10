import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Cpu, Download, RefreshCw } from "lucide-react";

type TenantRow = {
  tenant_id: string | null;
  client_name: string | null;
  client_slug: string | null;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_brl: number;
};
type BreakdownRow = {
  day: string;
  function_name: string;
  user_id: string | null;
  user_name: string | null;
  model: string;
  provider: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_brl: number;
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const fmtUSD = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR").format(v || 0);

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminConsumoIA() {
  const { isSuperAdminV4, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [selectedTenant, setSelectedTenant] = useState<string>("__all__");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(false);

  const startIso = useMemo(() => new Date(start + "T00:00:00").toISOString(), [start]);
  const endIso = useMemo(() => new Date(end + "T23:59:59").toISOString(), [end]);

  const load = async () => {
    setLoading(true);
    try {
      const tRes = await supabase.rpc("get_ai_usage_by_tenant", {
        p_start: startIso,
        p_end: endIso,
      });
      setTenants(((tRes.data as TenantRow[]) || []).map((r) => ({
        ...r,
        cost_usd: Number(r.cost_usd),
        cost_brl: Number(r.cost_brl),
      })));

      const bRes = await supabase.rpc("get_ai_usage_breakdown", {
        p_tenant: selectedTenant === "__all__" ? null : selectedTenant,
        p_start: startIso,
        p_end: endIso,
      });
      setBreakdown(((bRes.data as BreakdownRow[]) || []).map((r) => ({
        ...r,
        cost_usd: Number(r.cost_usd),
        cost_brl: Number(r.cost_brl),
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdminV4) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdminV4, start, end, selectedTenant]);

  const totals = useMemo(() => {
    return tenants.reduce(
      (acc, r) => {
        acc.calls += Number(r.calls);
        acc.in += Number(r.input_tokens);
        acc.out += Number(r.output_tokens);
        acc.tot += Number(r.total_tokens);
        acc.usd += Number(r.cost_usd);
        acc.brl += Number(r.cost_brl);
        return acc;
      },
      { calls: 0, in: 0, out: 0, tot: 0, usd: 0, brl: 0 },
    );
  }, [tenants]);

  const exportCsv = () => {
    const header = ["dia", "funcao", "usuario", "modelo", "provider", "chamadas", "input_tokens", "output_tokens", "total_tokens", "custo_usd", "custo_brl"];
    const rows = breakdown.map((r) => [
      r.day,
      r.function_name,
      r.user_name || r.user_id || "",
      r.model,
      r.provider,
      r.calls,
      r.input_tokens,
      r.output_tokens,
      r.total_tokens,
      r.cost_usd.toFixed(6),
      r.cost_brl.toFixed(4),
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consumo-ia_${start}_a_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) return null;
  if (!isSuperAdminV4) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito a super admins</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Admin
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cpu className="h-6 w-6" /> Consumo de IA por subconta
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!breakdown.length}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Subconta</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {tenants
                    .filter((t) => t.tenant_id)
                    .map((t) => (
                      <SelectItem key={t.tenant_id!} value={t.tenant_id!}>
                        {t.client_name || t.client_slug || t.tenant_id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Chamadas</p><p className="text-2xl font-bold">{fmtNum(totals.calls)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tokens entrada</p><p className="text-2xl font-bold">{fmtNum(totals.in)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tokens saída</p><p className="text-2xl font-bold">{fmtNum(totals.out)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo USD</p><p className="text-2xl font-bold">{fmtUSD(totals.usd)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Custo BRL</p><p className="text-2xl font-bold">{fmtBRL(totals.brl)}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Ranking por subconta</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subconta</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Tokens (in/out)</TableHead>
                  <TableHead className="text-right">Custo USD</TableHead>
                  <TableHead className="text-right">Custo BRL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
                )}
                {tenants.map((r) => (
                  <TableRow
                    key={r.tenant_id || "null"}
                    className="cursor-pointer"
                    onClick={() => setSelectedTenant(r.tenant_id || "__all__")}
                  >
                    <TableCell className="font-medium">
                      {r.client_name || r.client_slug || <span className="text-muted-foreground">(sem tenant)</span>}
                    </TableCell>
                    <TableCell className="text-right">{fmtNum(Number(r.calls))}</TableCell>
                    <TableCell className="text-right text-xs">{fmtNum(Number(r.input_tokens))} / {fmtNum(Number(r.output_tokens))}</TableCell>
                    <TableCell className="text-right">{fmtUSD(Number(r.cost_usd))}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(Number(r.cost_brl))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Detalhe {selectedTenant === "__all__" ? "(todas subcontas)" : ""} — dia × função × usuário × modelo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                  <TableHead className="text-right">BRL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breakdown.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                )}
                {breakdown.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{r.day}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline">{r.function_name}</Badge></TableCell>
                    <TableCell className="text-xs">{r.user_name || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-xs">{r.model}</TableCell>
                    <TableCell className="text-right text-xs">{fmtNum(Number(r.calls))}</TableCell>
                    <TableCell className="text-right text-xs">{fmtNum(Number(r.total_tokens))}</TableCell>
                    <TableCell className="text-right text-xs">{fmtUSD(Number(r.cost_usd))}</TableCell>
                    <TableCell className="text-right text-xs font-medium">{fmtBRL(Number(r.cost_brl))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
