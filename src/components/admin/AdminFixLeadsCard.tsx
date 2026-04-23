import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Check, Loader2, Pencil, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SuspectLead {
  id: string;
  nome: string;
  empresa: string | null;
  email: string | null;
  telefone: string | null;
  created_at: string;
}

export const AdminFixLeadsCard = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<SuspectLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const fetchSuspects = async () => {
    setLoading(true);
    // Fetch all and filter client-side (no functional index)
    const { data, error } = await supabase
      .from("crm_leads")
      .select("id, nome, empresa, email, telefone, created_at")
      .not("empresa", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const suspects = (data ?? []).filter(
      (l: any) =>
        l.nome && l.empresa &&
        l.nome.toLowerCase().trim() === l.empresa.toLowerCase().trim(),
    ) as SuspectLead[];
    setLeads(suspects);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuspects();
  }, []);

  const startEdit = (lead: SuspectLead) => {
    setEditingId(lead.id);
    setEditValue(lead.nome);
  };

  const saveEdit = async (id: string) => {
    if (!editValue.trim()) return;
    setSaving(id);
    const { error } = await supabase
      .from("crm_leads")
      .update({ nome: editValue.trim() })
      .eq("id", id);
    setSaving(null);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Nome atualizado" });
    setEditingId(null);
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Leads suspeitos (nome = empresa)
            <Badge variant="outline" className="ml-1 border-orange-500/40 text-orange-500">
              {leads.length}
            </Badge>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={fetchSuspects} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Atualizar</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Leads onde o campo <code>nome</code> é igual ao <code>empresa</code> — possivelmente importados com a coluna errada.
          Edite manualmente ou use o modo "Atualizar existentes" no diálogo de importação para corrigir em massa.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-muted-foreground p-6 text-sm">Carregando...</p>
        ) : leads.length === 0 ? (
          <p className="text-muted-foreground p-6 text-sm flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            Nenhum lead suspeito encontrado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome (atual)</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    {editingId === l.id ? (
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(l.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-8"
                      />
                    ) : (
                      <span className="font-medium text-foreground">{l.nome}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.empresa}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{l.email ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{l.telefone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {editingId === l.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={saving === l.id}>
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => saveEdit(l.id)} disabled={saving === l.id}>
                          {saving === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => startEdit(l)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
