import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useProfilesList, profileLabel } from "@/hooks/useProfilesList";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: { id: string; full_name: string | null; email: string } | null;
  onDeleted: () => void;
}

interface Pending {
  leads: number;
  oportunidades: number;
  atividades: number;
  accounts: number;
}

export const DeleteUserDialog = ({ open, onOpenChange, user, onDeleted }: Props) => {
  const { toast } = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reassignTo, setReassignTo] = useState<string>("");

  // Lista para reatribuição: apenas Receitas, aprovados, excluindo o próprio
  const { profiles } = useProfilesList({ departamento: "Receitas" });
  const candidates = profiles.filter((p) => p.id !== user?.id);

  useEffect(() => {
    if (!open || !user) {
      setPending(null);
      setReassignTo("");
      return;
    }
    setLoading(true);
    (async () => {
      const [leadsRes, oportRes, ativRes, acctRes] = await Promise.all([
        supabase
          .from("crm_leads")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_id", user.id),
        supabase
          .from("crm_oportunidades")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_id", user.id),
        supabase
          .from("crm_atividades")
          .select("id", { count: "exact", head: true })
          .eq("usuario_id", user.id),
        supabase
          .from("accounts")
          .select("id", { count: "exact", head: true })
          .eq("account_manager_id", user.id),
      ]);
      setPending({
        leads: leadsRes.count ?? 0,
        oportunidades: oportRes.count ?? 0,
        atividades: ativRes.count ?? 0,
        accounts: acctRes.count ?? 0,
      });
      setLoading(false);
    })();
  }, [open, user]);

  if (!user) return null;
  const hasPending = pending && (pending.leads + pending.oportunidades + pending.atividades + pending.accounts) > 0;
  const requiresReassign = !!hasPending;

  const handleDelete = async () => {
    if (requiresReassign && !reassignTo) {
      toast({ title: "Selecione um substituto", variant: "destructive" });
      return;
    }
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: user.id, reassign_to: reassignTo || null },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário excluído", description: user.email });
      onDeleted();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !deleting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir usuário</DialogTitle>
          <DialogDescription>
            Esta ação é permanente. O usuário <strong>{user.full_name || user.email}</strong> perderá
            o acesso imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verificando dados vinculados...
            </div>
          ) : pending ? (
            <>
              {hasPending ? (
                <Alert variant="destructive" className="border-orange-500/40 bg-orange-500/5 text-orange-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs space-y-1">
                    <p>Este usuário é responsável por:</p>
                    <ul className="list-disc list-inside">
                      {pending.leads > 0 && <li>{pending.leads} lead(s)</li>}
                      {pending.oportunidades > 0 && <li>{pending.oportunidades} oportunidade(s)</li>}
                      {pending.atividades > 0 && <li>{pending.atividades} atividade(s)</li>}
                      {pending.accounts > 0 && <li>{pending.accounts} account(s)</li>}
                    </ul>
                    <p className="pt-1">Escolha quem assume esses registros antes de continuar.</p>
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Não há registros vinculados a este usuário. Exclusão segura.
                </p>
              )}

              {hasPending && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Reatribuir para</Label>
                  <Select value={reassignTo} onValueChange={setReassignTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável (Receitas)" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhum candidato disponível
                        </div>
                      ) : (
                        candidates.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {profileLabel(p)}
                            {p.cargo ? <span className="text-muted-foreground"> · {p.cargo}</span> : null}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || loading || (requiresReassign && !reassignTo)}
          >
            {deleting ? "Excluindo..." : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
