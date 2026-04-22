import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Phone, Trash2, Plus, Loader2 } from "lucide-react";

interface VoipAccount {
  id: string;
  provider: string;
  operador_id: string;
  apelido: string | null;
  ativo: boolean;
}

interface Props {
  userId: string;
}

export const VoipAccountsCard = ({ userId }: Props) => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<VoipAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("api4com");
  const [operadorId, setOperadorId] = useState("");
  const [apelido, setApelido] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("voip_accounts" as any)
      .select("id, provider, operador_id, apelido, ativo")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (!error && data) setAccounts(data as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [userId]);

  const handleAdd = async () => {
    const op = operadorId.trim();
    if (!op) {
      toast({ title: "Informe o ID do operador", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("voip_accounts" as any).insert({
      user_id: userId,
      provider,
      operador_id: op,
      apelido: apelido.trim() || null,
    });
    setAdding(false);
    if (error) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
      return;
    }
    setOperadorId("");
    setApelido("");
    toast({ title: "Operador vinculado" });
    load();
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    const { error } = await supabase
      .from("voip_accounts" as any)
      .update({ ativo })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ativo } : a)));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("voip_accounts" as any).delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
      return;
    }
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    toast({ title: "Operador removido" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" /> Telefonia (VoIP)
        </CardTitle>
        <CardDescription>
          Vincule o seu identificador de operador no provedor de telefonia para que as ligações
          apareçam atribuídas a você no CRM.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-xs text-muted-foreground border border-dashed border-border/40 rounded-lg px-3 py-4 text-center">
            Nenhum operador vinculado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-background/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {a.provider}
                    </span>
                    <span className="text-sm font-mono">{a.operador_id}</span>
                    {a.apelido && (
                      <span className="text-xs text-muted-foreground">· {a.apelido}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={a.ativo}
                    onCheckedChange={(v) => toggleAtivo(a.id, v)}
                    aria-label="Ativo"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-border/40 pt-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Provedor</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api4com">API4com</SelectItem>
                  <SelectItem value="3cplus">3CPlus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ID do operador / ramal</Label>
              <Input
                value={operadorId}
                onChange={(e) => setOperadorId(e.target.value)}
                placeholder="Ex.: 1001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Apelido (opcional)</Label>
              <Input
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="Ex.: Ramal escritório"
              />
            </div>
          </div>
          <Button onClick={handleAdd} disabled={adding} size="sm">
            {adding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Vincular operador
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
