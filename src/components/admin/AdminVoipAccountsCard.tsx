import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Phone, Plus, Trash2, Pencil } from "lucide-react";

interface VoipAccount {
  id: string;
  user_id: string;
  provider: string;
  operador_id: string;
  apelido: string | null;
  ativo: boolean;
  agent_id: string | null;
}

interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string;
}

export const AdminVoipAccountsCard = () => {
  const [accounts, setAccounts] = useState<VoipAccount[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // form
  const [userId, setUserId] = useState("");
  const [provider, setProvider] = useState("api4com");
  const [operadorId, setOperadorId] = useState("");
  const [apelido, setApelido] = useState("");
  const [agentId, setAgentId] = useState("");
  const [ativo, setAtivo] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const [accRes, profRes] = await Promise.all([
      supabase.from("voip_accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").eq("approved", true).order("full_name"),
    ]);
    setAccounts((accRes.data ?? []) as VoipAccount[]);
    setProfiles((profRes.data ?? []) as ProfileLite[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const resetForm = () => {
    setEditingId(null);
    setUserId("");
    setProvider("api4com");
    setOperadorId("");
    setApelido("");
    setAgentId("");
    setAtivo(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (acc: VoipAccount) => {
    setEditingId(acc.id);
    setUserId(acc.user_id);
    setProvider(acc.provider);
    setOperadorId(acc.operador_id);
    setApelido(acc.apelido ?? "");
    setAgentId(acc.agent_id ?? "");
    setAtivo(acc.ativo);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!userId || !operadorId.trim()) {
      toast.error("Selecione um usuário e informe o Operador ID");
      return;
    }
    if (provider === "3cplus" && !agentId.trim()) {
      toast.error("Para 3CPlus, informe também o Agent ID");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      provider,
      operador_id: operadorId.trim(),
      apelido: apelido.trim() || null,
      agent_id: provider === "3cplus" ? agentId.trim() : null,
      ativo,
    };
    const { error } = editingId
      ? await supabase.from("voip_accounts").update(payload).eq("id", editingId)
      : await supabase.from("voip_accounts").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success(editingId ? "Conta VoIP atualizada" : "Conta VoIP cadastrada");
    setDialogOpen(false);
    resetForm();
    fetchAll();
  };

  const toggleAtivo = async (acc: VoipAccount) => {
    const { error } = await supabase
      .from("voip_accounts")
      .update({ ativo: !acc.ativo })
      .eq("id", acc.id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta VoIP?")) return;
    const { error } = await supabase.from("voip_accounts").delete().eq("id", id);
    if (error) {
      toast.error("Erro", { description: error.message });
      return;
    }
    toast.success("Conta excluída");
    fetchAll();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4" /> Contas VoIP da equipe
        </CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar conta
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-muted-foreground p-6">Carregando...</p>
        ) : accounts.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm">
            Nenhuma conta cadastrada. Clique em "Adicionar conta" para mapear o operador_id de um vendedor.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Operador ID (Ramal)</TableHead>
                <TableHead>Agent ID (3CPlus)</TableHead>
                <TableHead>Apelido</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => {
                const p = profileMap.get(acc.user_id);
                return (
                  <TableRow key={acc.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {p?.full_name || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p?.email || acc.user_id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{acc.provider}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{acc.operador_id}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {acc.agent_id || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {acc.apelido || "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={acc.ativo} onCheckedChange={() => toggleAtivo(acc)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(acc.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar conta VoIP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Usuário *</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email} {p.full_name ? `(${p.email})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api4com">api4com</SelectItem>
                  <SelectItem value="3cplus">3cplus</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operador ID (Ramal) *</Label>
              <Input
                value={operadorId}
                onChange={(e) => setOperadorId(e.target.value)}
                placeholder={provider === "3cplus" ? "Ex: 7777 (ramal SIP)" : "Ex: login/ramal do operador no painel da API4com"}
              />
              <p className="text-xs text-muted-foreground">
                {provider === "3cplus"
                  ? "Ramal SIP usado para discar (ex: 7777, 9999)."
                  : "Identificador que vem no payload do webhook (campo \"operador\")."}
              </p>
            </div>
            {provider === "3cplus" && (
              <div className="space-y-2">
                <Label>Agent ID 3CPlus *</Label>
                <Input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Ex: 198934"
                />
                <p className="text-xs text-muted-foreground">
                  ID interno do usuário na 3CPlus. Encontre na URL ao editar o usuário no painel (ex: /users/<b>198934</b>/edit). É o que vem nos webhooks de chamada.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Apelido (opcional)</Label>
              <Input
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="Ex: Ramal SDR João"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch checked={ativo} onCheckedChange={setAtivo} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
